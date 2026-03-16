<?php

declare(strict_types=1);

namespace App\Http\Controllers\TempHumid;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Throwable;

class SensorController extends Controller
{
    /**
     * Maps frontend floor slugs to Plant + Floor column values in Temp_Logger_Chip_ID.
     */
    private const FLOOR_MAP = [
        'p1f1'  => ['plant' => '1',     'floor' => '1'],
        'p1f2'  => ['plant' => '1',     'floor' => '2'],
        'p2f1'  => ['plant' => '2',     'floor' => '1'],
        'p2f2' => ['plant' => '2', 'floor' => '2', 'extra_area_ids' => ['P1F1-16']],
        'p12f2' => ['plant' => '1 & 2', 'floor' => '2'],
        'wh' => ['plant' => '2', 'floor' => '1', 'location_like' => 'P2F1WH'],
    ];

    /**
     * GET /api/temphumid/sensors
     * Full sensor registry, optionally filtered by floor slug.
     * Used by: all map pages on load (sensor list + limits seeding).
     *
     * Query params:
     *   ?floor=p1f1   (optional)
     */
    public function index(Request $request): JsonResponse
    {
        try {
            $query = DB::connection('temphumid')
                ->table('Temp_Logger_Chip_ID');

            if ($request->has('floor')) {
                $slug = strtolower($request->query('floor'));
                $map  = self::FLOOR_MAP[$slug] ?? null;

               if ($map) {
                    $query->where(function ($q) use ($map) {
                        $q->where('Plant', $map['plant'])
                        ->where('Floor', $map['floor']);
                        if (isset($map['location_like'])) {
                            $q->where('Location', 'like', '%' . $map['location_like'] . '%');
                        }
                    });
                    if (!empty($map['extra_area_ids'])) {
                        $query->orWhere(function ($q) use ($map) {
                            $q->whereIn('Area ID', $map['extra_area_ids']);
                        });
                    }
                }
            }

            $sensors = $query->get();
            $data    = $sensors->map(fn ($s) => $this->formatSensor($s));

            return response()->json(['data' => $data], 200);

        } catch (Throwable $e) {
            Log::error('SensorController::index failed', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Failed to fetch sensors.'], 500);
        }
    }

    /**
     * GET /api/temphumid/sensors/readings/current
     * Latest reading per sensor from TempHumid_Calib_Log (already corrected).
     * Breach detection applied server-side against limits fetched from
     * TempHumid_Limits_Log (latest row per areaId).
     * Optionally filtered by floor slug.
     * Used by: monitoring page (all floors), each map page (polling every 30s).
     *
     * Query params:
     *   ?floor=p1f1   (optional)
     */
    public function currentReadings(Request $request): JsonResponse
    {
        try {
            $query = DB::connection('temphumid')
                ->table('Temp_Logger_Chip_ID')
                ->where('Status', 'Active');

            if ($request->has('floor')) {
                $slug = strtolower($request->query('floor'));
                $map  = self::FLOOR_MAP[$slug] ?? null;

                if ($map) {
                    $query->where(function ($q) use ($map) {
                        $q->where('Plant', $map['plant'])
                        ->where('Floor', $map['floor']);
                        if (isset($map['location_like'])) {
                            $q->where('Location', 'like', '%' . $map['location_like'] . '%');
                        }
                    });
                    if (!empty($map['extra_area_ids'])) {
                        $query->orWhere(function ($q) use ($map) {
                            $q->whereIn('Area ID', $map['extra_area_ids']);
                        });
                    }
                }
            }

            $sensors = $query->get();

            // Fetch latest limits for all sensors in one query, keyed by areaId.
            // Uses a subquery to get the single most-recent row per Area ID.
            $areaIds      = $sensors->pluck('Area ID')->all();
            $latestLimits = $this->fetchLatestLimits($areaIds);

            $results = [];
            foreach ($sensors as $sensor) {
                $results[] = $this->buildCurrentReading($sensor, $latestLimits);
            }

            return response()->json(['data' => $results], 200);

        } catch (Throwable $e) {
            Log::error('SensorController::currentReadings failed', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Failed to fetch current readings.'], 500);
        }
    }

    /**
     * GET /api/temphumid/dashboard/summary
     * Aggregate stats for dashboard stat cards.
     * Returns: avgTemp, avgHumid, activeSensorCount, breachCount.
     */
    public function summary(): JsonResponse
    {
        try {
            $sensors = DB::connection('temphumid')
                ->table('Temp_Logger_Chip_ID')
                ->where('Status', 'Active')
                ->get();

            // Fetch latest limits for all sensors in one query
            $areaIds      = $sensors->pluck('Area ID')->all();
            $latestLimits = $this->fetchLatestLimits($areaIds);

            $temps       = [];
            $humids      = [];
            $breachCount = 0;

            foreach ($sensors as $sensor) {
                $reading = $this->buildCurrentReading($sensor, $latestLimits);

                if ($reading['hasData']) {
                    $temps[]  = $reading['temperature'];
                    $humids[] = $reading['humidity'];

                    if ($reading['status'] === 'breach') {
                        $breachCount++;
                    }
                }
            }

            return response()->json([
                'data' => [
                    'avgTemperature'    => count($temps)  > 0
                                            ? round(array_sum($temps)  / count($temps),  1)
                                            : null,
                    'avgHumidity'       => count($humids) > 0
                                            ? round(array_sum($humids) / count($humids), 1)
                                            : null,
                    'activeSensorCount' => $sensors->count(),
                    'breachCount'       => $breachCount,
                ],
            ], 200);

        } catch (Throwable $e) {
            Log::error('SensorController::summary failed', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Failed to fetch dashboard summary.'], 500);
        }
    }

    // -------------------------------------------------------------------------
    // Private helpers
    // -------------------------------------------------------------------------

    /**
     * Fetch the latest limits row from TempHumid_Limits_Log for each areaId,
     * returned as an associative array keyed by areaId.
     *
     * Uses a subquery to get only the single most-recent row per Area ID,
     * so this is always one round-trip regardless of sensor count.
     *
     * Falls back gracefully — if a sensor has no log entry, it won't appear
     * in the returned array, and buildCurrentReading() falls back to
     * Temp_Logger_Chip_ID values.
     *
     * @param  string[]  $areaIds
     * @return array<string, object>   areaId → limits row
     */
    private function fetchLatestLimits(array $areaIds): array
    {
        if (empty($areaIds)) {
            return [];
        }

        // Subquery: rank rows per Area ID by changed_at DESC, ID DESC
        $rows = DB::connection('temphumid')
            ->table('TempHumid_Limits_Log as ll')
            ->whereIn('ll.Area ID', $areaIds)
            ->where(function ($q) {
                // Only keep the row where no newer row exists for the same Area ID
                $q->whereNotExists(function ($sub) {
                    $sub->from('TempHumid_Limits_Log as ll2')
                        ->whereColumn('ll2.Area ID', 'll.Area ID')
                        ->where(function ($inner) {
                            $inner->where('ll2.changed_at', '>', DB::raw('ll.changed_at'))
                                  ->orWhere(function ($tie) {
                                      $tie->where('ll2.changed_at', '=', DB::raw('ll.changed_at'))
                                          ->where('ll2.ID', '>', DB::raw('ll.ID'));
                                  });
                        });
                });
            })
            ->get(['Area ID', 'Temp_Upper_Limit', 'Temp_Lower_Limit', 'Humid_Upper_Limit', 'Humid_Lower_Limit']);

        $map = [];
        foreach ($rows as $row) {
            $map[$row->{'Area ID'}] = $row;
        }

        return $map;
    }

    /**
     * Format a raw Temp_Logger_Chip_ID row into the standard sensor shape.
     * Limits here still come from Temp_Logger_Chip_ID — this is used by
     * the index() sensor registry endpoint only.
     */
    private function formatSensor(object $sensor): array
    {
        return [
            'areaId'          => $sensor->{'Area ID'},
            'chipId'          => $sensor->{'Chip ID'},
            'lineName'        => $sensor->{'Line Name'},
            'plant'           => $sensor->Plant,
            'floor'           => $sensor->Floor,
            'location'        => $sensor->Location,
            'listId'          => $sensor->ListID,
            'status'          => $sensor->Status,
            'ipAddress'       => trim($sensor->IP_Address ?? ''),
            'correctionTemp'  => $sensor->{'Correction Temp'}  ?? 0,
            'correctionHumid' => $sensor->{'Correction Humid'} ?? 0,
            'limits'          => [
                'tempUL'  => $sensor->Temp_Upper_Limit,
                'tempLL'  => $sensor->Temp_Lower_Limit,
                'humidUL' => $sensor->Humid_Upper_Limit,
                'humidLL' => $sensor->Humid_Lower_Limit,
            ],
        ];
    }

    /**
     * Fetch the latest reading for a sensor from TempHumid_Calib_Log.
     * Values are already corrected — no offset math needed.
     *
     * Limits and breach detection use the pre-fetched $latestLimits map
     * (from TempHumid_Limits_Log). Falls back to Temp_Logger_Chip_ID
     * values if no log entry exists for this sensor yet.
     *
     * NOTE: activeLocation / inactive-breach is NOT derived here —
     *       that stays frontend-only via the INACTIVE_AREAS set.
     *
     * @param  object                $sensor       Row from Temp_Logger_Chip_ID
     * @param  array<string, object> $latestLimits Keyed by areaId
     */
    private function buildCurrentReading(object $sensor, array $latestLimits): array
    {
        $chipId  = $sensor->{'Chip ID'};
        $areaId  = $sensor->{'Area ID'};
        $reading = null;

        try {
            $reading = DB::connection('temphumid')
                ->table('TempHumid_Calib_Log')
                ->where('Chip ID', $chipId)
                ->whereNotNull('Temperature')
                ->whereNotNull('Humidity')
                ->orderByDesc('Day_Time')
                ->first();
        } catch (Throwable $e) {
            Log::warning('Could not read TempHumid_Calib_Log for chip', [
                'chipId' => $chipId,
                'error'  => $e->getMessage(),
            ]);
        }

        // Resolve limits: prefer Limits_Log, fall back to Temp_Logger_Chip_ID
        $limRow  = $latestLimits[$areaId] ?? null;
        $tempUL  = $limRow ? $limRow->Temp_Upper_Limit  : $sensor->Temp_Upper_Limit;
        $tempLL  = $limRow ? $limRow->Temp_Lower_Limit  : $sensor->Temp_Lower_Limit;
        $humidUL = $limRow ? $limRow->Humid_Upper_Limit : $sensor->Humid_Upper_Limit;
        $humidLL = $limRow ? $limRow->Humid_Lower_Limit : $sensor->Humid_Lower_Limit;

        $base = [
            'areaId'   => $areaId,
            'chipId'   => $chipId,
            'lineName' => $sensor->{'Line Name'},
            'plant'    => $sensor->Plant,
            'floor'    => $sensor->Floor,
            'location' => $sensor->Location,
            'limits'   => [
                'tempUL'  => $tempUL,
                'tempLL'  => $tempLL,
                'humidUL' => $humidUL,
                'humidLL' => $humidLL,
            ],
        ];

        if (! $reading) {
            return array_merge($base, [
                'hasData'     => false,
                'temperature' => null,
                'humidity'    => null,
                'heatIndex'   => null,
                'lastSeen'    => null,
                'status'      => 'no-data',
            ]);
        }

        $temp  = (float) $reading->Temperature;
        $humid = (float) $reading->Humidity;

        $breached =
            $temp  > (float) $tempUL ||
            $temp  < (float) $tempLL ||
            $humid > (float) $humidUL ||
            $humid < (float) $humidLL;

        return array_merge($base, [
            'hasData'     => true,
            'temperature' => round($temp,  2),
            'humidity'    => round($humid, 2),
            'heatIndex'   => $reading->{'Heat Index'} !== null
                                ? round((float) $reading->{'Heat Index'}, 2)
                                : null,
            'lastSeen'    => $reading->Day_Time,
            'status'      => $breached ? 'breach' : 'ok',
        ]);
    }
}