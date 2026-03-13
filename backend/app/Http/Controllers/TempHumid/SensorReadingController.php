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
     * GET /api/temphumid/sensors/{areaId}/readings/history
     * Returns historical readings for a single sensor within a date range.
     * Reads from TempHumid_Calib_Log — values already corrected, no offset math.
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

            $chipId = $this->normalizeChipId($sensor->{'Chip ID'});
            $from   = $request->query('from') . ' 00:00:00';
            $to     = $request->query('to')   . ' 23:59:59.999';

            $rows = DB::connection('temphumid')
                ->table('TempHumid_Calib_Log')
                ->where('Chip ID', $chipId)
                ->where('Day_Time', '>=', $from)
                ->where('Day_Time', '<=', $to)
                ->whereNotNull('Temperature')
                ->whereNotNull('Humidity')
                ->orderBy('Day_Time')
                ->get(['Day_Time', 'Temperature', 'Humidity', 'Heat Index']);

            $data = $rows->map(fn ($row) => [
                'dayTime'     => $row->Day_Time,
                'temperature' => round((float) $row->Temperature, 2),
                'humidity'    => round((float) $row->Humidity,    2),
                'heatIndex'   => $row->{'Heat Index'} !== null
                                    ? round((float) $row->{'Heat Index'}, 2)
                                    : null,
                'tempUL'      => $sensor->Temp_Upper_Limit,
                'tempLL'      => $sensor->Temp_Lower_Limit,
                'humidUL'     => $sensor->Humid_Upper_Limit,
                'humidLL'     => $sensor->Humid_Lower_Limit,
            ]);

            return response()->json([
                'data' => $data,
                'meta' => [
                    'areaId'   => $areaId,
                    'chipId'   => $chipId,
                    'lineName' => $sensor->{'Line Name'},
                    'from'     => $request->query('from'),
                    'to'       => $request->query('to'),
                    'count'    => $data->count(),
                    'limits'   => [
                        'tempUL'  => $sensor->Temp_Upper_Limit,
                        'tempLL'  => $sensor->Temp_Lower_Limit,
                        'humidUL' => $sensor->Humid_Upper_Limit,
                        'humidLL' => $sensor->Humid_Lower_Limit,
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
     * Automatically aggregates based on date range to prevent timeouts:
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
     *
     * Response shape:
     * {
     *   "data": {
     *     "P1F1-04": {
     *       "lineName": "AOI",
     *       "limits": { "tempUL": 28, "tempLL": 20, "humidUL": 70, "humidLL": 40 },
     *       "readings": [
     *         { "dayTime": "2026-03-01 08:00:00", "temperature": 24.5, "humidity": 62.3 },
     *         ...
     *       ]
     *     }
     *   },
     *   "meta": {
     *     "from": "2026-02-28", "to": "2026-03-06",
     *     "totalReadings": 1234, "sensorCount": 2,
     *     "resolution": "hourly"   ← tells frontend how to format X axis labels
     *   }
     * }
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

            // ── Step 2: Fetch readings — raw or aggregated ───────────────────
            if ($resolution === 'raw') {
                // Raw: return every row as-is (short ranges only)
                $rows = DB::connection('temphumid')
                    ->table('TempHumid_Calib_Log')
                    ->whereIn('Chip ID', $chipIds)
                    ->where('Day_Time', '>=', $from)
                    ->where('Day_Time', '<=', $to)
                    ->whereNotNull('Temperature')
                    ->whereNotNull('Humidity')
                    ->orderBy('Day_Time')
                    ->get(['Chip ID', 'Day_Time', 'Temperature', 'Humidity', 'Heat Index']);

                // ── Step 3: Pre-seed result ───────────────────────────────────
                $result = [];
                foreach ($sensors as $sensor) {
                    $areaId          = $sensor->{'Area ID'};
                    $result[$areaId] = [
                        'lineName' => $sensor->{'Line Name'},
                        'limits'   => [
                            'tempUL'  => $sensor->Temp_Upper_Limit,
                            'tempLL'  => $sensor->Temp_Lower_Limit,
                            'humidUL' => $sensor->Humid_Upper_Limit,
                            'humidLL' => $sensor->Humid_Lower_Limit,
                        ],
                        'readings' => [],
                    ];
                }

                // ── Step 4: Group readings by areaId ─────────────────────────
                $totalReadings = 0;
                foreach ($rows as $row) {
                    $normalized = $this->normalizeChipId($row->{'Chip ID'});
                    $areaId     = $chipToArea[$normalized] ?? null;
                    if ($areaId === null) continue;

                    $result[$areaId]['readings'][] = [
                        'dayTime'     => $row->Day_Time,
                        'temperature' => round((float) $row->Temperature, 2),
                        'humidity'    => round((float) $row->Humidity,    2),
                        'heatIndex'   => $row->{'Heat Index'} !== null
                                            ? round((float) $row->{'Heat Index'}, 2)
                                            : null,
                    ];
                    $totalReadings++;
                }

            } else {
                // Aggregated: GROUP BY time bucket using SQL Server DATEADD/DATEDIFF
                // This computes AVG in the DB — only bucket-count rows returned to PHP.

                // Build the bucket expression per resolution:
                //   hourly   → truncate to the hour
                //   six_hour → truncate to 6-hour block
                //   daily    → truncate to the day
                $bucketExpr = match ($resolution) {
                    'hourly'   => "DATEADD(hour,  DATEDIFF(hour,  0, [Day_Time]), 0)",
                    'six_hour' => "DATEADD(hour,  (DATEDIFF(hour,  0, [Day_Time]) / 6)  * 6, 0)",
                    'daily'    => "DATEADD(day,   DATEDIFF(day,   0, [Day_Time]), 0)",
                    default    => "DATEADD(day,   DATEDIFF(day,   0, [Day_Time]), 0)",
                };

                // Build placeholders for chipIds IN clause
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

                // ── Step 3: Pre-seed result ───────────────────────────────────
                $result = [];
                foreach ($sensors as $sensor) {
                    $areaId          = $sensor->{'Area ID'};
                    $result[$areaId] = [
                        'lineName' => $sensor->{'Line Name'},
                        'limits'   => [
                            'tempUL'  => $sensor->Temp_Upper_Limit,
                            'tempLL'  => $sensor->Temp_Lower_Limit,
                            'humidUL' => $sensor->Humid_Upper_Limit,
                            'humidLL' => $sensor->Humid_Lower_Limit,
                        ],
                        'readings' => [],
                    ];
                }

                // ── Step 4: Group aggregated rows by areaId ───────────────────
                $totalReadings = 0;
                foreach ($rows as $row) {
                    $normalized = $this->normalizeChipId($row->{'Chip ID'});
                    $areaId     = $chipToArea[$normalized] ?? null;
                    if ($areaId === null) continue;

                    $result[$areaId]['readings'][] = [
                        'dayTime'     => $row->bucket,
                        'temperature' => round((float) $row->Temperature, 2),
                        'humidity'    => round((float) $row->Humidity,    2),
                        'heatIndex'   => $row->{'Heat Index'} !== null
                                            ? round((float) $row->{'Heat Index'}, 2)
                                            : null,
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
                    'resolution'    => $resolution, // ← frontend uses this for label formatting
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