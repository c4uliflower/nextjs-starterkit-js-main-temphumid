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
     * Returns raw historical readings for multiple sensors in one request.
     * Reads from TempHumid_Calib_Log — values already corrected, no offset math.
     * Used by: dashboard overview chart (multi-sensor comparison).
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
     *   "meta": { "from": "2026-02-28", "to": "2026-03-06", "totalReadings": 1234, "sensorCount": 2 }
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
            $from    = $request->query('from') . ' 00:00:00';
            $to      = $request->query('to')   . ' 23:59:59.999';

            // ── Step 1: Fetch all requested sensors in one query ──────────────
            $sensors = DB::connection('temphumid')
                ->table('Temp_Logger_Chip_ID')
                ->whereIn('Area ID', $areaIds)
                ->get();

            if ($sensors->isEmpty()) {
                return response()->json(['message' => 'No sensors found for the given areaIds.'], 404);
            }

            // Build lookup: normalized chipId → areaId (and collect chipIds for query)
            // Normalize ensures "0xb64bb2" and "0xB64BB2" both become "0xB64BB2"
            // so the whereIn and the grouping map use identical keys.
            $chipIds    = [];
            $chipToArea = [];
            foreach ($sensors as $sensor) {
                $normalized              = $this->normalizeChipId($sensor->{'Chip ID'});
                $chipIds[]               = $normalized;
                $chipToArea[$normalized] = $sensor->{'Area ID'};
            }

            // ── Step 2: Fetch ALL readings for all chips in one query ─────────
            $rows = DB::connection('temphumid')
                ->table('TempHumid_Calib_Log')
                ->whereIn('Chip ID', $chipIds)
                ->where('Day_Time', '>=', $from)
                ->where('Day_Time', '<=', $to)
                ->whereNotNull('Temperature')
                ->whereNotNull('Humidity')
                ->orderBy('Day_Time')
                ->get(['Chip ID', 'Day_Time', 'Temperature', 'Humidity', 'Heat Index']);

            // ── Step 3: Pre-seed result so areaIds with zero readings still appear
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

            // ── Step 4: Group readings by areaId ─────────────────────────────
            // Normalize the chipId from each row before looking it up,
            // so mixed-case values from the DB always match our map keys.
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

            return response()->json([
                'data' => $result,
                'meta' => [
                    'from'          => $request->query('from'),
                    'to'            => $request->query('to'),
                    'totalReadings' => $totalReadings,
                    'sensorCount'   => count($result),
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