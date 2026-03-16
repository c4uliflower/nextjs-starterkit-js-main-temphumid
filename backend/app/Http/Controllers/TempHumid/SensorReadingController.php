<?php

declare(strict_types=1);

namespace App\Http\Controllers\TempHumid;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
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
     * ≤ 2 days  → raw        (every row, ~5s intervals)
     * ≤ 14 days → hourly     (1 point per hour)
     * ≤ 90 days → six_hour   (1 point per 6 hours)
     * >  90 days → daily     (1 point per day)
     *
     * @return array{ resolution: string, bucketSql: string, labelSql: string }
     */
    private function resolveAggregation(string $from, string $to): array
    {
        $days = (int) ceil(
            (strtotime($to) - strtotime($from)) / 86400
        );

        if ($days <= 2) {
            return [
                'resolution' => 'raw',
                'days'       => $days,
            ];
        }

        if ($days <= 14) {
            return [
                'resolution' => 'hourly',
                'days'       => $days,
            ];
        }

        if ($days <= 90) {
            return [
                'resolution' => 'six_hour',
                'days'       => $days,
            ];
        }

        return [
            'resolution' => 'daily',
            'days'       => $days,
        ];
    }

    /**
     * Fetch historically accurate limits for a set of areaIds over a date range.
     *
     * For each areaId, returns all limit rows from TempHumid_Limits_Log where
     * changed_at falls within or before the requested range, ordered ascending.
     * The caller uses this to find "what were the limits at time T" by walking
     * the list and picking the latest row where changed_at <= T.
     *
     * Returns: array<string, array<object>>  areaId → array of limit rows (asc by changed_at, ID)
     *
     * @param  string[]  $areaIds
     * @param  string    $from   e.g. '2026-02-28 00:00:00'
     * @param  string    $to     e.g. '2026-03-06 23:59:59.999'
     */
    private function fetchLimitsHistory(array $areaIds, string $from, string $to): array
    {
        if (empty($areaIds)) {
            return [];
        }

        // Fetch all rows changed_at <= $to so we can resolve limits at any
        // point in the range. Rows after $to are irrelevant.
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
     *
     * Walks the list and returns the last row where changed_at <= $dayTime.
     * Falls back to the earliest row if none match (reading predates all changes).
     *
     * @param  object[]  $limitRows   Ordered asc by changed_at
     * @param  string    $dayTime     Reading timestamp
     * @return object|null
     */
    private function resolveLimitsAtTime(array $limitRows, string $dayTime): ?object
    {
        if (empty($limitRows)) {
            return null;
        }

        $resolved = $limitRows[0]; // fallback: earliest known limits

        foreach ($limitRows as $row) {
            if ($row->changed_at <= $dayTime) {
                $resolved = $row;
            } else {
                break; // rows are sorted asc, no need to continue
            }
        }

        return $resolved;
    }

    /**
     * GET /api/temphumid/sensors/{areaId}/readings/history
     * Returns historical readings for a single sensor within a date range.
     * Reads from TempHumid_Calib_Log — values already corrected, no offset math.
     * Limits attached to each reading reflect what was active at that point in
     * time, resolved from TempHumid_Limits_Log.
     * Used by: dashboard daily chart page.
     *
     * Query params:
     *   ?from=2026-02-28   (required, Y-m-d)
     *   ?to=2026-03-06     (required, Y-m-d)
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

            // Fetch historically accurate limits for this sensor
            $limitsHistory = $this->fetchLimitsHistory([$areaId], $from, $to);
            $limitRows     = $limitsHistory[$areaId] ?? [];

            // Fallback limits from Temp_Logger_Chip_ID if no log entry exists
            $fallbackLimits = (object) [
                'Temp_Upper_Limit'  => $sensor->Temp_Upper_Limit,
                'Temp_Lower_Limit'  => $sensor->Temp_Lower_Limit,
                'Humid_Upper_Limit' => $sensor->Humid_Upper_Limit,
                'Humid_Lower_Limit' => $sensor->Humid_Lower_Limit,
            ];

            $data = $rows->map(function ($row) use ($limitRows, $fallbackLimits) {
                $lim     = $this->resolveLimitsAtTime($limitRows, $row->Day_Time) ?? $fallbackLimits;
                $tempUL  = $lim->Temp_Upper_Limit;
                $tempLL  = $lim->Temp_Lower_Limit;
                $humidUL = $lim->Humid_Upper_Limit;
                $humidLL = $lim->Humid_Lower_Limit;

                return [
                    'dayTime'     => $row->Day_Time,
                    'temperature' => round((float) $row->Temperature, 2),
                    'humidity'    => round((float) $row->Humidity,    2),
                    'heatIndex'   => $row->{'Heat Index'} !== null
                                        ? round((float) $row->{'Heat Index'}, 2)
                                        : null,
                    'tempUL'      => $tempUL,
                    'tempLL'      => $tempLL,
                    'humidUL'     => $humidUL,
                    'humidLL'     => $humidLL,
                ];
            });

            // Resolve current limits (latest row) for meta
            $currentLim = ! empty($limitRows)
                ? end($limitRows)
                : $fallbackLimits;

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
            Log::error('SensorReadingController::history failed', [
                'areaId' => $areaId,
                'error'  => $e->getMessage(),
            ]);
            return response()->json(['message' => 'Failed to fetch sensor history.'], 500);
        }
    }

    /**
     * GET /api/temphumid/sensors/readings/history/batch
     * Returns historical readings for multiple sensors in one request.
     * Automatically aggregates based on date range to prevent timeouts.
     * Limits attached to each sensor reflect historically accurate values
     * resolved from TempHumid_Limits_Log per sensor.
     *
     *   ≤ 2 days  → raw rows     (~5s intervals, full detail)
     *   ≤ 14 days → hourly avg   (1 point per hour per sensor)
     *   ≤ 90 days → 6-hour avg   (4 points per day per sensor)
     *   > 90 days → daily avg    (1 point per day per sensor)
     *
     * Query params:
     *   ?areaIds[]=P1F1-04&areaIds[]=P1F1-02   (required, at least one)
     *   ?from=2026-02-28                         (required, Y-m-d)
     *   ?to=2026-03-06                           (required, Y-m-d)
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

            // ── Determine aggregation resolution ─────────────────────────────
            $agg        = $this->resolveAggregation($fromRaw, $toRaw);
            $resolution = $agg['resolution'];

            // ── Step 1: Fetch all requested sensors in one query ──────────────
            $sensors = DB::connection('temphumid')
                ->table('Temp_Logger_Chip_ID')
                ->whereIn('Area ID', $areaIds)
                ->get();

            if ($sensors->isEmpty()) {
                return response()->json(['message' => 'No sensors found for the given areaIds.'], 404);
            }

            // Build lookup: normalized chipId → areaId
            $chipIds    = [];
            $chipToArea = [];
            foreach ($sensors as $sensor) {
                $normalized              = $this->normalizeChipId($sensor->{'Chip ID'});
                $chipIds[]               = $normalized;
                $chipToArea[$normalized] = $sensor->{'Area ID'};
            }

            // ── Step 2: Fetch historically accurate limits for all sensors ────
            // One query for all areaIds — keyed by areaId → ordered limit rows
            $limitsHistory = $this->fetchLimitsHistory($areaIds, $from, $to);

            // ── Step 3: Pre-seed result with current (latest) limits ──────────
            // meta.limits reflects what's active now, not per-reading
            $result = [];
            foreach ($sensors as $sensor) {
                $areaId    = $sensor->{'Area ID'};
                $limitRows = $limitsHistory[$areaId] ?? [];

                // Latest known limits for this sensor
                $currentLim = ! empty($limitRows)
                    ? end($limitRows)
                    : null;

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

            // ── Step 4: Fetch readings — raw or aggregated ───────────────────
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

                $totalReadings = 0;
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
                        'heatIndex'   => $row->{'Heat Index'} !== null
                                            ? round((float) $row->{'Heat Index'}, 2)
                                            : null,
                        'tempUL'      => $lim->Temp_Upper_Limit,
                        'tempLL'      => $lim->Temp_Lower_Limit,
                        'humidUL'     => $lim->Humid_Upper_Limit,
                        'humidLL'     => $lim->Humid_Lower_Limit,
                    ];
                    $totalReadings++;
                }

            } else {
                // Aggregated: GROUP BY time bucket using SQL Server DATEADD/DATEDIFF
                $bucketExpr = match ($resolution) {
                    'hourly'   => "DATEADD(hour,  DATEDIFF(hour,  0, [Day_Time]), 0)",
                    'six_hour' => "DATEADD(hour,  (DATEDIFF(hour,  0, [Day_Time]) / 6)  * 6, 0)",
                    'daily'    => "DATEADD(day,   DATEDIFF(day,   0, [Day_Time]), 0)",
                    default    => "DATEADD(day,   DATEDIFF(day,   0, [Day_Time]), 0)",
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

                $totalReadings = 0;
                foreach ($rows as $row) {
                    $normalized = $this->normalizeChipId($row->{'Chip ID'});
                    $areaId     = $chipToArea[$normalized] ?? null;
                    if ($areaId === null) continue;

                    // For aggregated buckets, resolve limits at the bucket timestamp.
                    // The bucket is the start of the period so this is accurate.
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
                        'heatIndex'   => $row->{'Heat Index'} !== null
                                            ? round((float) $row->{'Heat Index'}, 2)
                                            : null,
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
            Log::error('SensorReadingController::batchHistory failed', [
                'areaIds' => $request->query('areaIds'),
                'error'   => $e->getMessage(),
            ]);
            return response()->json(['message' => 'Failed to fetch batch sensor history.'], 500);
        }
    }
}