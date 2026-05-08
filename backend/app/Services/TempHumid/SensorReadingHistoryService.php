<?php

declare(strict_types=1);

namespace App\Services\TempHumid;

use App\Models\TempHumid\Sensor;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Symfony\Component\HttpFoundation\StreamedResponse;
use Throwable;

class SensorReadingHistoryService
{
    /**
     * @return array{status: int, body: array<string, mixed>}
     */
    public function history(string $areaId, string $fromRaw, string $toRaw): array
    {
        $sensor = Sensor::query()
            ->where('Area ID', $areaId)
            ->first();

        if (! $sensor) {
            return ['status' => 404, 'body' => ['message' => 'Sensor not found.']];
        }

        $chipId = $this->normalizeChipId($sensor->chipId());
        $from = $fromRaw . ' 00:00:00';
        $to = $toRaw . ' 23:59:59.999';

        $rows = DB::connection('temphumid')
            ->table('TempHumid_Calib_Log')
            ->where('Chip ID', $chipId)
            ->where('Day_Time', '>=', $from)
            ->where('Day_Time', '<=', $to)
            ->whereNotNull('Temperature')
            ->whereNotNull('Humidity')
            ->orderBy('Day_Time')
            ->get(['Day_Time', 'Temperature', 'Humidity', 'Heat Index']);

        $limitsHistory = $this->fetchLimitsHistory([$areaId], $from, $to);
        $limitRows = $limitsHistory[$areaId] ?? [];
        $fallbackLimits = $this->sensorFallbackLimits($sensor);

        $data = $rows->map(function (object $row) use ($limitRows, $fallbackLimits): array {
            $limits = $this->resolveLimitsAtTime($limitRows, $row->Day_Time) ?? $fallbackLimits;

            return $this->formatReading($row, $limits);
        });

        $currentLimits = $limitRows !== [] ? end($limitRows) : $fallbackLimits;

        return [
            'status' => 200,
            'body' => [
                'data' => $data,
                'meta' => [
                    'areaId' => $areaId,
                    'chipId' => $chipId,
                    'lineName' => $sensor->lineName(),
                    'from' => $fromRaw,
                    'to' => $toRaw,
                    'count' => $data->count(),
                    'limits' => $this->formatLimits($currentLimits),
                ],
            ],
        ];
    }

    /**
     * @param  string[]  $areaIds
     * @return array{status: int, body: array<string, mixed>}
     */
    public function batchHistory(array $areaIds, string $fromRaw, string $toRaw): array
    {
        $from = $fromRaw . ' 00:00:00';
        $to = $toRaw . ' 23:59:59.999';
        $aggregation = $this->resolveAggregation($fromRaw, $toRaw);
        $resolution = $aggregation['resolution'];

        $sensors = Sensor::query()
            ->whereIn('Area ID', $areaIds)
            ->get();

        if ($sensors->isEmpty()) {
            return ['status' => 404, 'body' => ['message' => 'No sensors found for the given areaIds.']];
        }

        $chipIds = [];
        $chipToArea = [];
        foreach ($sensors as $sensor) {
            $normalized = $this->normalizeChipId($sensor->chipId());
            $chipIds[] = $normalized;
            $chipToArea[$normalized] = $sensor->areaId();
        }

        $limitsHistory = $this->fetchLimitsHistory($areaIds, $from, $to);
        $result = [];

        foreach ($sensors as $sensor) {
            $areaId = $sensor->areaId();
            $limitRows = $limitsHistory[$areaId] ?? [];
            $currentLimits = $limitRows !== [] ? end($limitRows) : $this->sensorFallbackLimits($sensor);

            $result[$areaId] = [
                'lineName' => $sensor->lineName(),
                'limits' => $this->formatLimits($currentLimits),
                'readings' => [],
            ];
        }

        $totalReadings = 0;

        if ($resolution === 'raw') {
            $rows = DB::connection('temphumid')
                ->table('TempHumid_Calib_Log')
                ->whereIn('Chip ID', $chipIds)
                ->where('Day_Time', '>=', $from)
                ->where('Day_Time', '<=', $to)
                ->whereNotNull('Temperature')
                ->whereNotNull('Humidity')
                ->orderBy('Day_Time')
                ->get(['Chip ID', 'Day_Time', 'Temperature', 'Humidity', 'Heat Index']);
        } else {
            $bucketExpr = $this->bucketExpression($resolution);
            $placeholders = implode(',', array_fill(0, count($chipIds), '?'));
            $sql = "
                SELECT
                    [Chip ID],
                    {$bucketExpr} AS bucket,
                    AVG([Temperature]) AS Temperature,
                    AVG([Humidity]) AS Humidity,
                    AVG([Heat Index]) AS [Heat Index]
                FROM [TempHumid_Calib_Log]
                WHERE [Chip ID] IN ({$placeholders})
                  AND [Day_Time] >= ?
                  AND [Day_Time] <= ?
                  AND [Temperature] IS NOT NULL
                  AND [Humidity] IS NOT NULL
                GROUP BY [Chip ID], {$bucketExpr}
                ORDER BY [Chip ID], bucket
            ";

            $rows = collect(DB::connection('temphumid')->select($sql, array_merge($chipIds, [$from, $to])));
        }

        $sensorsByArea = $sensors->keyBy(fn (Sensor $sensor): string => $sensor->areaId());

        foreach ($rows as $row) {
            $normalized = $this->normalizeChipId($row->{'Chip ID'});
            $areaId = $chipToArea[$normalized] ?? null;

            if ($areaId === null) {
                continue;
            }

            $sensor = $sensorsByArea->get($areaId);

            if (! $sensor instanceof Sensor) {
                continue;
            }

            $limitRows = $limitsHistory[$areaId] ?? [];
            $dayTime = $resolution === 'raw' ? $row->Day_Time : $row->bucket;
            $limits = $this->resolveLimitsAtTime($limitRows, $dayTime) ?? $this->sensorFallbackLimits($sensor);

            $result[$areaId]['readings'][] = $this->formatReading((object) [
                'Day_Time' => $dayTime,
                'Temperature' => $row->Temperature,
                'Humidity' => $row->Humidity,
                'Heat Index' => $row->{'Heat Index'},
            ], $limits);
            $totalReadings++;
        }

        return [
            'status' => 200,
            'body' => [
                'data' => $result,
                'meta' => [
                    'from' => $fromRaw,
                    'to' => $toRaw,
                    'totalReadings' => $totalReadings,
                    'sensorCount' => count($result),
                    'resolution' => $resolution,
                ],
            ],
        ];
    }

    /**
     * @param  string[]  $areaIds
     */
    public function exportRaw(array $areaIds, string $fromRaw, string $toRaw): StreamedResponse
    {
        $from = $fromRaw . ' 00:00:00';
        $to = $toRaw . ' 23:59:59.999';

        return response()->stream(function () use ($areaIds, $from, $to, $fromRaw, $toRaw): void {
            try {
                $sensors = Sensor::query()
                    ->whereIn('Area ID', $areaIds)
                    ->get();

                if ($sensors->isEmpty()) {
                    echo json_encode(['type' => 'error', 'message' => 'No sensors found.']) . "\n";
                    flush();

                    return;
                }

                $chipIds = [];
                $chipToArea = [];
                foreach ($sensors as $sensor) {
                    $normalized = $this->normalizeChipId($sensor->chipId());
                    $chipIds[] = $normalized;
                    $chipToArea[$normalized] = $sensor->areaId();
                }

                $limitsHistory = $this->fetchLimitsHistory($areaIds, $from, $to);
                $sensorMeta = [];

                foreach ($sensors as $sensor) {
                    $areaId = $sensor->areaId();
                    $limitRows = $limitsHistory[$areaId] ?? [];
                    $currentLimits = $limitRows !== [] ? end($limitRows) : $this->sensorFallbackLimits($sensor);

                    $sensorMeta[$areaId] = [
                        'areaId' => $areaId,
                        'lineName' => $sensor->lineName(),
                        'limits' => $this->formatLimits($currentLimits),
                        '_fallback' => $this->sensorFallbackLimits($sensor),
                    ];
                }

                echo json_encode([
                    'type' => 'meta',
                    'from' => $fromRaw,
                    'to' => $toRaw,
                    'sensors' => array_map(
                        fn (array $meta): array => [
                            'areaId' => $meta['areaId'],
                            'lineName' => $meta['lineName'],
                            'limits' => $meta['limits'],
                        ],
                        array_values($sensorMeta)
                    ),
                ]) . "\n";
                flush();

                $cursor = DB::connection('temphumid')
                    ->table('TempHumid_Calib_Log')
                    ->whereIn('Chip ID', $chipIds)
                    ->where('Day_Time', '>=', $from)
                    ->where('Day_Time', '<=', $to)
                    ->whereNotNull('Temperature')
                    ->whereNotNull('Humidity')
                    ->orderBy('Chip ID')
                    ->orderBy('Day_Time')
                    ->select(['Chip ID', 'Day_Time', 'Temperature', 'Humidity', 'Heat Index'])
                    ->cursor();

                $totalRows = 0;
                foreach ($cursor as $row) {
                    $normalized = $this->normalizeChipId($row->{'Chip ID'});
                    $areaId = $chipToArea[$normalized] ?? null;

                    if ($areaId === null) {
                        continue;
                    }

                    $meta = $sensorMeta[$areaId];
                    $limitRows = $limitsHistory[$areaId] ?? [];
                    $limits = $this->resolveLimitsAtTime($limitRows, $row->Day_Time) ?? $meta['_fallback'];
                    $reading = $this->formatReading($row, $limits);

                    echo json_encode([
                        'type' => 'row',
                        'areaId' => $areaId,
                        'dayTime' => $reading['dayTime'],
                        'temperature' => $reading['temperature'],
                        'humidity' => $reading['humidity'],
                        'heatIndex' => $reading['heatIndex'],
                        'tempUL' => $reading['tempUL'],
                        'tempLL' => $reading['tempLL'],
                        'humidUL' => $reading['humidUL'],
                        'humidLL' => $reading['humidLL'],
                    ]) . "\n";

                    $totalRows++;

                    if ($totalRows % 500 === 0) {
                        flush();
                    }
                }

                echo json_encode(['type' => 'end', 'totalRows' => $totalRows]) . "\n";
                flush();
            } catch (Throwable $exception) {
                Log::error('SensorReadingHistoryService::exportRaw failed', ['error' => $exception->getMessage()]);
                echo json_encode(['type' => 'error', 'message' => 'Export failed: ' . $exception->getMessage()]) . "\n";
                flush();
            }
        }, 200, [
            'Content-Type' => 'application/x-ndjson',
            'X-Accel-Buffering' => 'no',
            'Cache-Control' => 'no-cache',
            'Transfer-Encoding' => 'chunked',
        ]);
    }

    private function normalizeChipId(string $chipId): string
    {
        return '0x' . strtoupper(substr($chipId, 2));
    }

    /**
     * @return array{resolution: string, days: int}
     */
    private function resolveAggregation(string $from, string $to): array
    {
        $days = (int) ceil((strtotime($to) - strtotime($from)) / 86400);

        if ($days <= 30) {
            return ['resolution' => 'thirty_min', 'days' => $days];
        }

        if ($days <= 60) {
            return ['resolution' => 'hourly', 'days' => $days];
        }

        if ($days <= 120) {
            return ['resolution' => 'three_hour', 'days' => $days];
        }

        if ($days <= 180) {
            return ['resolution' => 'six_hour', 'days' => $days];
        }

        if ($days <= 365) {
            return ['resolution' => 'twelve_hour', 'days' => $days];
        }

        return ['resolution' => 'daily', 'days' => $days];
    }

    private function bucketExpression(string $resolution): string
    {
        return match ($resolution) {
            'thirty_min' => "DATEADD(minute, (DATEDIFF(minute, 0, [Day_Time]) / 30) * 30, 0)",
            'hourly' => "DATEADD(hour, DATEDIFF(hour, 0, [Day_Time]), 0)",
            'three_hour' => "DATEADD(hour, (DATEDIFF(hour, 0, [Day_Time]) / 3) * 3, 0)",
            'six_hour' => "DATEADD(hour, (DATEDIFF(hour, 0, [Day_Time]) / 6) * 6, 0)",
            'twelve_hour' => "DATEADD(hour, (DATEDIFF(hour, 0, [Day_Time]) / 12) * 12, 0)",
            default => "DATEADD(day, DATEDIFF(day, 0, [Day_Time]), 0)",
        };
    }

    /**
     * @param  string[]  $areaIds
     * @return array<string, array<int, object>>
     */
    private function fetchLimitsHistory(array $areaIds, string $from, string $to): array
    {
        if ($areaIds === []) {
            return [];
        }

        $rows = DB::connection('temphumid')
            ->table('TempHumid_Limits_Log')
            ->whereIn('Area ID', $areaIds)
            ->where('changed_at', '<=', $to)
            ->orderBy('Area ID')
            ->orderBy('changed_at')
            ->orderBy('ID')
            ->get(['Area ID', 'Temp_Upper_Limit', 'Temp_Lower_Limit', 'Humid_Upper_Limit', 'Humid_Lower_Limit', 'changed_at']);

        $map = [];
        foreach ($rows as $row) {
            $map[$row->{'Area ID'}][] = $row;
        }

        return $map;
    }

    /**
     * @param  array<int, object>  $limitRows
     */
    private function resolveLimitsAtTime(array $limitRows, string $dayTime): ?object
    {
        if ($limitRows === []) {
            return null;
        }

        $resolved = $limitRows[0];

        foreach ($limitRows as $row) {
            if ($row->changed_at <= $dayTime) {
                $resolved = $row;
                continue;
            }

            break;
        }

        return $resolved;
    }

    private function sensorFallbackLimits(Sensor $sensor): object
    {
        return (object) [
            'Temp_Upper_Limit' => $sensor->getAttribute('Temp_Upper_Limit'),
            'Temp_Lower_Limit' => $sensor->getAttribute('Temp_Lower_Limit'),
            'Humid_Upper_Limit' => $sensor->getAttribute('Humid_Upper_Limit'),
            'Humid_Lower_Limit' => $sensor->getAttribute('Humid_Lower_Limit'),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function formatReading(object $row, object $limits): array
    {
        return [
            'dayTime' => $row->Day_Time,
            'temperature' => round((float) $row->Temperature, 2),
            'humidity' => round((float) $row->Humidity, 2),
            'heatIndex' => $row->{'Heat Index'} !== null ? round((float) $row->{'Heat Index'}, 2) : null,
            'tempUL' => $limits->Temp_Upper_Limit,
            'tempLL' => $limits->Temp_Lower_Limit,
            'humidUL' => $limits->Humid_Upper_Limit,
            'humidLL' => $limits->Humid_Lower_Limit,
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function formatLimits(object $limits): array
    {
        return [
            'tempUL' => $limits->Temp_Upper_Limit,
            'tempLL' => $limits->Temp_Lower_Limit,
            'humidUL' => $limits->Humid_Upper_Limit,
            'humidLL' => $limits->Humid_Lower_Limit,
        ];
    }
}
