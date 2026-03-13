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
     * Breach detection applied server-side against limits in Temp_Logger_Chip_ID.
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
            $results = [];

            foreach ($sensors as $sensor) {
                $results[] = $this->buildCurrentReading($sensor);
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

            $temps       = [];
            $humids      = [];
            $breachCount = 0;

            foreach ($sensors as $sensor) {
                $reading = $this->buildCurrentReading($sensor);

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
     * Format a raw Temp_Logger_Chip_ID row into the standard sensor shape.
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
     * Breach detection applied here against limits in Temp_Logger_Chip_ID.
     *
     * NOTE: activeLocation / inactive-breach is NOT derived here —
     *       that stays frontend-only via the INACTIVE_AREAS set.
     */
    private function buildCurrentReading(object $sensor): array
    {
        //$chipId = '0x' . strtoupper(substr($sensor->{'Chip ID'}, 2));
        $chipId  = $sensor->{'Chip ID'};
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

        $base = [
            'areaId'   => $sensor->{'Area ID'},
            'chipId'   => $chipId,
            'lineName' => $sensor->{'Line Name'},
            'plant'    => $sensor->Plant,
            'floor'    => $sensor->Floor,
            'location' => $sensor->Location,
            'limits'   => [
                'tempUL'  => $sensor->Temp_Upper_Limit,
                'tempLL'  => $sensor->Temp_Lower_Limit,
                'humidUL' => $sensor->Humid_Upper_Limit,
                'humidLL' => $sensor->Humid_Lower_Limit,
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
            $temp  > (float) $sensor->Temp_Upper_Limit  ||
            $temp  < (float) $sensor->Temp_Lower_Limit  ||
            $humid > (float) $sensor->Humid_Upper_Limit ||
            $humid < (float) $sensor->Humid_Lower_Limit;

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