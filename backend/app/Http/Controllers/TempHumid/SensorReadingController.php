<?php

declare(strict_types=1);

namespace App\Http\Controllers\TempHumid;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Symfony\Component\HttpFoundation\StreamedResponse;
use Throwable;

class SensorReadingController extends Controller
{
    /**
     * Normalize a Chip ID to consistent format: 0x + uppercase hex digits.
     * e.g. "0xb64bb2" → "0xB64BB2", "0X19AF26" → "0x19AF26"
     */
    private function normalizeChipId(string $chipId): string
    {
        return '0x' . strtoupper(substr($chipId, 2));
    }

    /**
     * Determine aggregation resolution based on day range.
     *
     * ≤ 30 days  → thirty_min  (1 point per 30 minutes)
     * ≤ 60 days  → hourly      (1 point per hour)
     * ≤ 120 days → three_hour  (1 point per 3 hours)
     * ≤ 180 days → six_hour    (1 point per 6 hours)
     * ≤ 365 days → twelve_hour (1 point per 12 hours)
     * >  365 days → daily      (1 point per day)
     */
    private function resolveAggregation(string $from, string $to): array
    {
        $days = (int) ceil(
            (strtotime($to) - strtotime($from)) / 86400
        );

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

    /**
     * Fetch historically accurate limits for a set of areaIds over a date range.
     */
    private function fetchLimitsHistory(array $areaIds, string $from, string $to): array
    {
        if (empty($areaIds)) {
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
     * Given an ordered list of limit rows (asc by changed_at) for one sensor,
     * return the limits that were active at $dayTime.
     */
    private function resolveLimitsAtTime(array $limitRows, string $dayTime): ?object
    {
        if (empty($limitRows)) {
            return null;
        }

        $resolved = $limitRows[0];

        foreach ($limitRows as $row) {
            if ($row->changed_at <= $dayTime) {
                $resolved = $row;
            } else {
                break;
            }
        }

        return $resolved;
    }

    /**
     * GET /api/temphumid/sensors/{areaId}/readings/history
     */
    public function history(Request $request, string $areaId): JsonResponse
    {
        $request->validate([
            'from' => ['required', 'date_format:Y-m-d'],
            'to'   => ['required', 'date_format:Y-m-d', 'after_or_equal:from'],
        ]);

        try {
            $sensor = DB::connection('temphumid')
                ->table('Temp_Logger_Chip_ID')
                ->where('Area ID', $areaId)
                ->first();

            if (! $sensor) {
                return response()->json(['message' => 'Sensor not found.'], 404);
            }

            $chipId  = $this->normalizeChipId($sensor->{'Chip ID'});
            $fromRaw = $request->query('from');
            $toRaw   = $request->query('to');
            $from    = $fromRaw . ' 00:00:00';
            $to      = $toRaw   . ' 23:59:59.999';

            $rows = DB::connection('temphumid')
                ->table('TempHumid_Calib_Log')
                ->where('Chip ID', $chipId)
                ->where('Day_Time', '>=', $from)
                ->where('Day_Time', '<=', $to)
                ->whereNotNull('Temperature')
                ->whereNotNull('Humidity')
                ->orderBy('Day_Time')
                ->get(['Day_Time', 'Temperature', 'Humidity', 'Heat Index']);

            $limitsHistory  = $this->fetchLimitsHistory([$areaId], $from, $to);
            $limitRows      = $limitsHistory[$areaId] ?? [];
            $fallbackLimits = (object) [
                'Temp_Upper_Limit'  => $sensor->Temp_Upper_Limit,
                'Temp_Lower_Limit'  => $sensor->Temp_Lower_Limit,
                'Humid_Upper_Limit' => $sensor->Humid_Upper_Limit,
                'Humid_Lower_Limit' => $sensor->Humid_Lower_Limit,
            ];

            $data = $rows->map(function ($row) use ($limitRows, $fallbackLimits) {
                $lim = $this->resolveLimitsAtTime($limitRows, $row->Day_Time) ?? $fallbackLimits;
                return [
                    'dayTime'     => $row->Day_Time,
                    'temperature' => round((float) $row->Temperature, 2),
                    'humidity'    => round((float) $row->Humidity,    2),
                    'heatIndex'   => $row->{'Heat Index'} !== null ? round((float) $row->{'Heat Index'}, 2) : null,
                    'tempUL'      => $lim->Temp_Upper_Limit,
                    'tempLL'      => $lim->Temp_Lower_Limit,
                    'humidUL'     => $lim->Humid_Upper_Limit,
                    'humidLL'     => $lim->Humid_Lower_Limit,
                ];
            });

            $currentLim = ! empty($limitRows) ? end($limitRows) : $fallbackLimits;

            return response()->json([
                'data' => $data,
                'meta' => [
                    'areaId'   => $areaId,
                    'chipId'   => $chipId,
                    'lineName' => $sensor->{'Line Name'},
                    'from'     => $fromRaw,
                    'to'       => $toRaw,
                    'count'    => $data->count(),
                    'limits'   => [
                        'tempUL'  => $currentLim->Temp_Upper_Limit,
                        'tempLL'  => $currentLim->Temp_Lower_Limit,
                        'humidUL' => $currentLim->Humid_Upper_Limit,
                        'humidLL' => $currentLim->Humid_Lower_Limit,
                    ],
                ],
            ], 200);

        } catch (Throwable $e) {
            Log::error('SensorReadingController::history failed', ['areaId' => $areaId, 'error' => $e->getMessage()]);
            return response()->json(['message' => 'Failed to fetch sensor history.'], 500);
        }
    }

    /**
     * GET /api/temphumid/sensors/readings/history/batch
     */
    public function batchHistory(Request $request): JsonResponse
    {
        $request->validate([
            'areaIds'   => ['required', 'array', 'min:1'],
            'areaIds.*' => ['required', 'string'],
            'from'      => ['required', 'date_format:Y-m-d'],
            'to'        => ['required', 'date_format:Y-m-d', 'after_or_equal:from'],
        ]);

        try {
            $areaIds = $request->query('areaIds');
            $fromRaw = $request->query('from');
            $toRaw   = $request->query('to');
            $from    = $fromRaw . ' 00:00:00';
            $to      = $toRaw   . ' 23:59:59.999';

            $agg        = $this->resolveAggregation($fromRaw, $toRaw);
            $resolution = $agg['resolution'];

            $sensors = DB::connection('temphumid')
                ->table('Temp_Logger_Chip_ID')
                ->whereIn('Area ID', $areaIds)
                ->get();

            if ($sensors->isEmpty()) {
                return response()->json(['message' => 'No sensors found for the given areaIds.'], 404);
            }

            $chipIds    = [];
            $chipToArea = [];
            foreach ($sensors as $sensor) {
                $normalized              = $this->normalizeChipId($sensor->{'Chip ID'});
                $chipIds[]               = $normalized;
                $chipToArea[$normalized] = $sensor->{'Area ID'};
            }

            $limitsHistory = $this->fetchLimitsHistory($areaIds, $from, $to);

            $result = [];
            foreach ($sensors as $sensor) {
                $areaId     = $sensor->{'Area ID'};
                $limitRows  = $limitsHistory[$areaId] ?? [];
                $currentLim = ! empty($limitRows) ? end($limitRows) : null;

                $result[$areaId] = [
                    'lineName' => $sensor->{'Line Name'},
                    'limits'   => [
                        'tempUL'  => $currentLim ? $currentLim->Temp_Upper_Limit  : $sensor->Temp_Upper_Limit,
                        'tempLL'  => $currentLim ? $currentLim->Temp_Lower_Limit  : $sensor->Temp_Lower_Limit,
                        'humidUL' => $currentLim ? $currentLim->Humid_Upper_Limit : $sensor->Humid_Upper_Limit,
                        'humidLL' => $currentLim ? $currentLim->Humid_Lower_Limit : $sensor->Humid_Lower_Limit,
                    ],
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

                foreach ($rows as $row) {
                    $normalized = $this->normalizeChipId($row->{'Chip ID'});
                    $areaId     = $chipToArea[$normalized] ?? null;
                    if ($areaId === null) continue;

                    $limitRows = $limitsHistory[$areaId] ?? [];
                    $sensor    = $sensors->firstWhere('Area ID', $areaId);
                    $fallback  = (object) [
                        'Temp_Upper_Limit'  => $sensor->Temp_Upper_Limit,
                        'Temp_Lower_Limit'  => $sensor->Temp_Lower_Limit,
                        'Humid_Upper_Limit' => $sensor->Humid_Upper_Limit,
                        'Humid_Lower_Limit' => $sensor->Humid_Lower_Limit,
                    ];

                    $lim = $this->resolveLimitsAtTime($limitRows, $row->Day_Time) ?? $fallback;

                    $result[$areaId]['readings'][] = [
                        'dayTime'     => $row->Day_Time,
                        'temperature' => round((float) $row->Temperature, 2),
                        'humidity'    => round((float) $row->Humidity,    2),
                        'heatIndex'   => $row->{'Heat Index'} !== null ? round((float) $row->{'Heat Index'}, 2) : null,
                        'tempUL'      => $lim->Temp_Upper_Limit,
                        'tempLL'      => $lim->Temp_Lower_Limit,
                        'humidUL'     => $lim->Humid_Upper_Limit,
                        'humidLL'     => $lim->Humid_Lower_Limit,
                    ];
                    $totalReadings++;
                }

            } else {
                $bucketExpr = match ($resolution) {
                    'thirty_min'  => "DATEADD(minute, (DATEDIFF(minute, 0, [Day_Time]) / 30) * 30, 0)",
                    'hourly'      => "DATEADD(hour,    DATEDIFF(hour,   0, [Day_Time]),        0)",
                    'three_hour'  => "DATEADD(hour,   (DATEDIFF(hour,  0, [Day_Time]) / 3)  * 3,  0)",
                    'six_hour'    => "DATEADD(hour,   (DATEDIFF(hour,  0, [Day_Time]) / 6)  * 6,  0)",
                    'twelve_hour' => "DATEADD(hour,   (DATEDIFF(hour,  0, [Day_Time]) / 12) * 12, 0)",
                    'daily'       => "DATEADD(day,     DATEDIFF(day,   0, [Day_Time]),        0)",
                    default       => "DATEADD(day,     DATEDIFF(day,   0, [Day_Time]),        0)",
                };

                $placeholders = implode(',', array_fill(0, count($chipIds), '?'));
                $sql = "
                    SELECT
                        [Chip ID],
                        {$bucketExpr}          AS bucket,
                        AVG([Temperature])     AS Temperature,
                        AVG([Humidity])        AS Humidity,
                        AVG([Heat Index])      AS [Heat Index]
                    FROM [TempHumid_Calib_Log]
                    WHERE [Chip ID] IN ({$placeholders})
                      AND [Day_Time] >= ?
                      AND [Day_Time] <= ?
                      AND [Temperature] IS NOT NULL
                      AND [Humidity]    IS NOT NULL
                    GROUP BY [Chip ID], {$bucketExpr}
                    ORDER BY [Chip ID], bucket
                ";

                $bindings = array_merge($chipIds, [$from, $to]);
                $rows     = DB::connection('temphumid')->select($sql, $bindings);

                foreach ($rows as $row) {
                    $normalized = $this->normalizeChipId($row->{'Chip ID'});
                    $areaId     = $chipToArea[$normalized] ?? null;
                    if ($areaId === null) continue;

                    $limitRows = $limitsHistory[$areaId] ?? [];
                    $sensor    = $sensors->firstWhere('Area ID', $areaId);
                    $fallback  = (object) [
                        'Temp_Upper_Limit'  => $sensor->Temp_Upper_Limit,
                        'Temp_Lower_Limit'  => $sensor->Temp_Lower_Limit,
                        'Humid_Upper_Limit' => $sensor->Humid_Upper_Limit,
                        'Humid_Lower_Limit' => $sensor->Humid_Lower_Limit,
                    ];

                    $lim = $this->resolveLimitsAtTime($limitRows, $row->bucket) ?? $fallback;

                    $result[$areaId]['readings'][] = [
                        'dayTime'     => $row->bucket,
                        'temperature' => round((float) $row->Temperature, 2),
                        'humidity'    => round((float) $row->Humidity,    2),
                        'heatIndex'   => $row->{'Heat Index'} !== null ? round((float) $row->{'Heat Index'}, 2) : null,
                        'tempUL'      => $lim->Temp_Upper_Limit,
                        'tempLL'      => $lim->Temp_Lower_Limit,
                        'humidUL'     => $lim->Humid_Upper_Limit,
                        'humidLL'     => $lim->Humid_Lower_Limit,
                    ];
                    $totalReadings++;
                }
            }

            return response()->json([
                'data' => $result,
                'meta' => [
                    'from'          => $fromRaw,
                    'to'            => $toRaw,
                    'totalReadings' => $totalReadings,
                    'sensorCount'   => count($result),
                    'resolution'    => $resolution,
                ],
            ], 200);

        } catch (Throwable $e) {
            Log::error('SensorReadingController::batchHistory failed', ['areaIds' => $request->query('areaIds'), 'error' => $e->getMessage()]);
            return response()->json(['message' => 'Failed to fetch batch sensor history.'], 500);
        }
    }

    /**
     * GET /api/temphumid/sensors/readings/export
     *
     * Streams ALL raw readings for the requested sensors and date range as
     * newline-delimited JSON (NDJSON). NEVER aggregates — always every row
     * from TempHumid_Calib_Log regardless of how large the date range is.
     *
     * Used exclusively by the dashboard Export button. Completely bypasses
     * resolveAggregation() so the user always gets every individual reading.
     *
     * Uses cursor() to iterate one DB row at a time — PHP memory stays flat
     * even for year-long exports with millions of rows.
     *
     * NDJSON protocol (one JSON object per newline):
     *
     *   Line 1 — metadata:
     *     {"type":"meta","from":"2025-01-01","to":"2025-12-31","sensors":[
     *       {"areaId":"P1F1-02","lineName":"SMT","limits":{"tempUL":28,"tempLL":22,"humidUL":85,"humidLL":45}},
     *       ...
     *     ]}
     *
     *   Data lines (one per reading):
     *     {"type":"row","areaId":"P1F1-02","dayTime":"2025-03-20 08:00:01",
     *      "temperature":24.5,"humidity":60.2,"heatIndex":null,
     *      "tempUL":28,"tempLL":22,"humidUL":85,"humidLL":45}
     *
     *   Final line:
     *     {"type":"end","totalRows":1823456}
     *
     * Register BEFORE the {areaId} route in routes/api.php:
     *   Route::get('sensors/readings/export', [SensorReadingController::class, 'exportRaw']);
     *
     * Query params:
     *   ?areaIds[]=P1F1-04&areaIds[]=P1F1-02   (required, at least one)
     *   ?from=2025-01-01                         (required, Y-m-d)
     *   ?to=2025-12-31                           (required, Y-m-d)
     */
    public function exportRaw(Request $request): StreamedResponse
    {
        $request->validate([
            'areaIds'   => ['required', 'array', 'min:1'],
            'areaIds.*' => ['required', 'string'],
            'from'      => ['required', 'date_format:Y-m-d'],
            'to'        => ['required', 'date_format:Y-m-d', 'after_or_equal:from'],
        ]);

        $areaIds = $request->query('areaIds');
        $fromRaw = $request->query('from');
        $toRaw   = $request->query('to');
        $from    = $fromRaw . ' 00:00:00';
        $to      = $toRaw   . ' 23:59:59.999';

        return response()->stream(function () use ($areaIds, $from, $to, $fromRaw, $toRaw) {
            try {
                // ── Fetch sensors ─────────────────────────────────────────────
                $sensors = DB::connection('temphumid')
                    ->table('Temp_Logger_Chip_ID')
                    ->whereIn('Area ID', $areaIds)
                    ->get();

                if ($sensors->isEmpty()) {
                    echo json_encode(['type' => 'error', 'message' => 'No sensors found.']) . "\n";
                    flush();
                    return;
                }

                // Build lookups
                $chipIds    = [];
                $chipToArea = [];
                foreach ($sensors as $sensor) {
                    $normalized              = $this->normalizeChipId($sensor->{'Chip ID'});
                    $chipIds[]               = $normalized;
                    $chipToArea[$normalized] = $sensor->{'Area ID'};
                }

                // ── Fetch limits history ──────────────────────────────────────
                $limitsHistory = $this->fetchLimitsHistory($areaIds, $from, $to);

                // Build per-sensor meta (current limits + fallback for resolveLimitsAtTime)
                $sensorMeta = [];
                foreach ($sensors as $sensor) {
                    $areaId     = $sensor->{'Area ID'};
                    $limitRows  = $limitsHistory[$areaId] ?? [];
                    $currentLim = ! empty($limitRows) ? end($limitRows) : null;

                    $sensorMeta[$areaId] = [
                        'areaId'    => $areaId,
                        'lineName'  => $sensor->{'Line Name'},
                        'limits'    => [
                            'tempUL'  => $currentLim ? $currentLim->Temp_Upper_Limit  : $sensor->Temp_Upper_Limit,
                            'tempLL'  => $currentLim ? $currentLim->Temp_Lower_Limit  : $sensor->Temp_Lower_Limit,
                            'humidUL' => $currentLim ? $currentLim->Humid_Upper_Limit : $sensor->Humid_Upper_Limit,
                            'humidLL' => $currentLim ? $currentLim->Humid_Lower_Limit : $sensor->Humid_Lower_Limit,
                        ],
                        '_fallback' => (object) [
                            'Temp_Upper_Limit'  => $sensor->Temp_Upper_Limit,
                            'Temp_Lower_Limit'  => $sensor->Temp_Lower_Limit,
                            'Humid_Upper_Limit' => $sensor->Humid_Upper_Limit,
                            'Humid_Lower_Limit' => $sensor->Humid_Lower_Limit,
                        ],
                    ];
                }

                // ── Stream metadata line ──────────────────────────────────────
                $metaSensors = array_map(
                    fn ($m) => ['areaId' => $m['areaId'], 'lineName' => $m['lineName'], 'limits' => $m['limits']],
                    array_values($sensorMeta)
                );

                echo json_encode([
                    'type'    => 'meta',
                    'from'    => $fromRaw,
                    'to'      => $toRaw,
                    'sensors' => $metaSensors,
                ]) . "\n";
                flush();

                // ── Stream raw rows via cursor() ──────────────────────────────
                // cursor() is a lazy generator — fetches one row at a time from
                // the PDO driver so 10M rows won't exhaust PHP memory.
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

                $totalRows  = 0;
                $flushEvery = 500; // push buffered output to the client every N rows

                foreach ($cursor as $row) {
                    $normalized = $this->normalizeChipId($row->{'Chip ID'});
                    $areaId     = $chipToArea[$normalized] ?? null;
                    if ($areaId === null) continue;

                    $meta      = $sensorMeta[$areaId];
                    $limitRows = $limitsHistory[$areaId] ?? [];
                    $lim       = $this->resolveLimitsAtTime($limitRows, $row->Day_Time) ?? $meta['_fallback'];

                    echo json_encode([
                        'type'        => 'row',
                        'areaId'      => $areaId,
                        'dayTime'     => $row->Day_Time,
                        'temperature' => round((float) $row->Temperature, 2),
                        'humidity'    => round((float) $row->Humidity,    2),
                        'heatIndex'   => $row->{'Heat Index'} !== null
                                            ? round((float) $row->{'Heat Index'}, 2)
                                            : null,
                        'tempUL'      => $lim->Temp_Upper_Limit,
                        'tempLL'      => $lim->Temp_Lower_Limit,
                        'humidUL'     => $lim->Humid_Upper_Limit,
                        'humidLL'     => $lim->Humid_Lower_Limit,
                    ]) . "\n";

                    $totalRows++;

                    if ($totalRows % $flushEvery === 0) {
                        flush();
                    }
                }

                // ── End marker ────────────────────────────────────────────────
                echo json_encode(['type' => 'end', 'totalRows' => $totalRows]) . "\n";
                flush();

            } catch (Throwable $e) {
                Log::error('SensorReadingController::exportRaw failed', ['error' => $e->getMessage()]);
                echo json_encode(['type' => 'error', 'message' => 'Export failed: ' . $e->getMessage()]) . "\n";
                flush();
            }
        }, 200, [
            'Content-Type'        => 'application/x-ndjson',
            'X-Accel-Buffering'   => 'no',   // disable Nginx proxy buffering
            'Cache-Control'       => 'no-cache',
            'Transfer-Encoding'   => 'chunked',
        ]);
    }
}