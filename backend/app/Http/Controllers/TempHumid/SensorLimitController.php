<?php

declare(strict_types=1);

namespace App\Http\Controllers\TempHumid;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Throwable;

class SensorLimitController extends Controller
{
    /**
     * GET /api/temphumid/sensors/{areaId}/limits
     * Returns the LATEST limits for a single sensor from TempHumid_Limits_Log.
     * Used by: Adjust Sensor Limits modal on open.
     */
    public function show(string $areaId): JsonResponse
    {
        try {
            $log = DB::connection('temphumid')
                ->table('TempHumid_Limits_Log')
                ->where('Area ID', $areaId)
                ->orderByDesc('changed_at')
                ->orderByDesc('ID')
                ->first();

            if (! $log) {
                return response()->json(['message' => 'Sensor not found.'], 404);
            }

            return response()->json([
                'data' => [
                    'areaId'   => $log->{'Area ID'},
                    'lineName' => $log->{'Line Name'},
                    'tempUL'   => $log->Temp_Upper_Limit,
                    'tempLL'   => $log->Temp_Lower_Limit,
                    'humidUL'  => $log->Humid_Upper_Limit,
                    'humidLL'  => $log->Humid_Lower_Limit,
                ],
            ], 200);

        } catch (Throwable $e) {
            Log::error('SensorLimitController::show failed', [
                'areaId' => $areaId,
                'error'  => $e->getMessage(),
            ]);
            return response()->json(['message' => 'Failed to fetch sensor limits.'], 500);
        }
    }

    /**
     * GET /api/temphumid/sensors/limits/batch-show
     * Returns the LATEST limits for multiple sensors in one query.
     * Uses the same WHERE NOT EXISTS pattern as SensorController::fetchLatestLimits().
     * Falls back to Temp_Logger_Chip_ID values for sensors with no log entry.
     * Used by: map page on load (limits pre-fetch, replaces N individual requests).
     *
     * Query params:
     *   ?areaIds[]=P1F1-04&areaIds[]=P1F1-02   (required, at least one)
     */
    public function batchShow(Request $request): JsonResponse
    {
        $request->validate([
            'areaIds'   => ['required', 'array', 'min:1'],
            'areaIds.*' => ['required', 'string'],
        ]);

        try {
            $areaIds = $request->query('areaIds');

            // Fetch sensor metadata for fallback limits
            $sensors = DB::connection('temphumid')
                ->table('Temp_Logger_Chip_ID')
                ->whereIn('Area ID', $areaIds)
                ->get(['Area ID', 'Line Name', 'Temp_Upper_Limit', 'Temp_Lower_Limit', 'Humid_Upper_Limit', 'Humid_Lower_Limit']);

            // Fetch latest limits from log — one query, WHERE NOT EXISTS pattern
            $logRows = DB::connection('temphumid')
                ->table('TempHumid_Limits_Log as ll')
                ->whereIn('ll.Area ID', $areaIds)
                ->where(function ($q) {
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

            // Key log rows by areaId
            $logMap = [];
            foreach ($logRows as $row) {
                $logMap[$row->{'Area ID'}] = $row;
            }

            // Build response — prefer log values, fall back to Temp_Logger_Chip_ID
            $data = [];
            foreach ($sensors as $sensor) {
                $areaId = $sensor->{'Area ID'};
                $lim    = $logMap[$areaId] ?? null;

                $data[$areaId] = [
                    'areaId'  => $areaId,
                    'tempUL'  => $lim ? $lim->Temp_Upper_Limit  : $sensor->Temp_Upper_Limit,
                    'tempLL'  => $lim ? $lim->Temp_Lower_Limit  : $sensor->Temp_Lower_Limit,
                    'humidUL' => $lim ? $lim->Humid_Upper_Limit : $sensor->Humid_Upper_Limit,
                    'humidLL' => $lim ? $lim->Humid_Lower_Limit : $sensor->Humid_Lower_Limit,
                ];
            }

            return response()->json(['data' => $data], 200);

        } catch (Throwable $e) {
            Log::error('SensorLimitController::batchShow failed', [
                'areaIds' => $request->query('areaIds'),
                'error'   => $e->getMessage(),
            ]);
            return response()->json(['message' => 'Failed to fetch sensor limits.'], 500);
        }
    }

    /**
     * POST /api/temphumid/sensors/{areaId}/limits
     * Inserts a new row into TempHumid_Limits_Log for a single sensor.
     * Trigger updates Temp_Logger_Chip_ID automatically.
     * Skips insert if nothing actually changed.
     *
     * Body: { tempUL, tempLL, humidUL, humidLL }
     */
    public function update(Request $request, string $areaId): JsonResponse
    {
        $validated = $request->validate([
            'tempUL'  => ['required', 'numeric'],
            'tempLL'  => ['required', 'numeric'],
            'humidUL' => ['required', 'numeric'],
            'humidLL' => ['required', 'numeric'],
        ]);

        if ((float) $validated['tempLL'] >= (float) $validated['tempUL']) {
            return response()->json([
                'message' => 'Temperature lower limit must be less than upper limit.',
                'errors'  => ['tempLL' => ['Must be less than upper limit.']],
            ], 422);
        }

        if ((float) $validated['humidLL'] >= (float) $validated['humidUL']) {
            return response()->json([
                'message' => 'Humidity lower limit must be less than upper limit.',
                'errors'  => ['humidLL' => ['Must be less than upper limit.']],
            ], 422);
        }

        try {
            // Get sensor metadata from Temp_Logger_Chip_ID
            $sensor = DB::connection('temphumid')
                ->table('Temp_Logger_Chip_ID')
                ->where('Area ID', $areaId)
                ->first();

            if (! $sensor) {
                return response()->json(['message' => 'Sensor not found.'], 404);
            }

            // Get current limits from latest Limits_Log row
            $current = DB::connection('temphumid')
                ->table('TempHumid_Limits_Log')
                ->where('Area ID', $areaId)
                ->orderByDesc('changed_at')
                ->orderByDesc('ID')
                ->first();

            // Diff against current log values
            $changedFields = [];
            if ($current) {
                if ((float) $validated['tempUL']  !== (float) $current->Temp_Upper_Limit)  $changedFields[] = 'Temp UL';
                if ((float) $validated['tempLL']  !== (float) $current->Temp_Lower_Limit)  $changedFields[] = 'Temp LL';
                if ((float) $validated['humidUL'] !== (float) $current->Humid_Upper_Limit) $changedFields[] = 'Humid UL';
                if ((float) $validated['humidLL'] !== (float) $current->Humid_Lower_Limit) $changedFields[] = 'Humid LL';
            } else {
                $changedFields = ['Temp UL', 'Temp LL', 'Humid UL', 'Humid LL'];
            }

            if (empty($changedFields)) {
                return response()->json([
                    'message' => 'No changes detected.',
                    'data'    => [
                        'areaId'  => $areaId,
                        'tempUL'  => $validated['tempUL'],
                        'tempLL'  => $validated['tempLL'],
                        'humidUL' => $validated['humidUL'],
                        'humidLL' => $validated['humidLL'],
                    ],
                ], 200);
            }

            $user      = $request->user();
            $changedBy = $user
                ? trim($user->first_name . ' ' . $user->last_name) . ' (' . $user->employee_no . ')'
                : 'unknown';

            DB::connection('temphumid')
                ->table('TempHumid_Limits_Log')
                ->insert([
                    'Area ID'           => $areaId,
                    'Chip ID'           => $sensor->{'Chip ID'},
                    'Line Name'         => $sensor->{'Line Name'},
                    'Temp_Upper_Limit'  => $validated['tempUL'],
                    'Temp_Lower_Limit'  => $validated['tempLL'],
                    'Humid_Upper_Limit' => $validated['humidUL'],
                    'Humid_Lower_Limit' => $validated['humidLL'],
                    'changed_by'        => $changedBy,
                    'changed_at'        => now(),
                ]);

            return response()->json([
                'message' => 'Limits updated successfully.',
                'data'    => [
                    'areaId'  => $areaId,
                    'tempUL'  => $validated['tempUL'],
                    'tempLL'  => $validated['tempLL'],
                    'humidUL' => $validated['humidUL'],
                    'humidLL' => $validated['humidLL'],
                ],
            ], 200);

        } catch (Throwable $e) {
            Log::error('SensorLimitController::update failed', [
                'areaId' => $areaId,
                'error'  => $e->getMessage(),
            ]);
            return response()->json(['message' => 'Failed to update sensor limits.'], 500);
        }
    }

    /**
     * POST /api/temphumid/sensors/limits/batch
     * Inserts new rows into TempHumid_Limits_Log for multiple sensors.
     * Trigger updates Temp_Logger_Chip_ID automatically.
     * Skips insert for sensors where nothing actually changed.
     *
     * Body: { sensors: [{ areaId, tempUL, tempLL, humidUL, humidLL }] }
     */
    public function batchUpdate(Request $request): JsonResponse
    {
        $request->validate([
            'sensors'           => ['required', 'array', 'min:1'],
            'sensors.*.areaId'  => ['required', 'string'],
            'sensors.*.tempUL'  => ['required', 'numeric'],
            'sensors.*.tempLL'  => ['required', 'numeric'],
            'sensors.*.humidUL' => ['required', 'numeric'],
            'sensors.*.humidLL' => ['required', 'numeric'],
        ]);

        $user      = $request->user();
        $changedBy = $user
            ? trim($user->first_name . ' ' . $user->last_name) . ' (' . $user->employee_no . ')'
            : 'unknown';

        $errors  = [];
        $updated = [];
        $skipped = [];

        foreach ($request->sensors as $item) {
            if ((float) $item['tempLL'] >= (float) $item['tempUL']) {
                $errors[] = "{$item['areaId']}: Temp LL must be less than UL.";
                continue;
            }

            if ((float) $item['humidLL'] >= (float) $item['humidUL']) {
                $errors[] = "{$item['areaId']}: Humid LL must be less than UL.";
                continue;
            }

            try {
                // Get sensor metadata
                $sensor = DB::connection('temphumid')
                    ->table('Temp_Logger_Chip_ID')
                    ->where('Area ID', $item['areaId'])
                    ->first();

                if (! $sensor) {
                    $errors[] = "{$item['areaId']}: Sensor not found.";
                    continue;
                }

                // Get current limits from latest Limits_Log row
                $current = DB::connection('temphumid')
                    ->table('TempHumid_Limits_Log')
                    ->where('Area ID', $item['areaId'])
                    ->orderByDesc('changed_at')
                    ->orderByDesc('ID')
                    ->first();

                // Diff against current log values
                $changedFields = [];
                if ($current) {
                    if ((float) $item['tempUL']  !== (float) $current->Temp_Upper_Limit)  $changedFields[] = 'Temp UL';
                    if ((float) $item['tempLL']  !== (float) $current->Temp_Lower_Limit)  $changedFields[] = 'Temp LL';
                    if ((float) $item['humidUL'] !== (float) $current->Humid_Upper_Limit) $changedFields[] = 'Humid UL';
                    if ((float) $item['humidLL'] !== (float) $current->Humid_Lower_Limit) $changedFields[] = 'Humid LL';
                } else {
                    $changedFields = ['Temp UL', 'Temp LL', 'Humid UL', 'Humid LL'];
                }

                if (empty($changedFields)) {
                    $skipped[] = $item['areaId'];
                    continue;
                }

                DB::connection('temphumid')
                    ->table('TempHumid_Limits_Log')
                    ->insert([
                        'Area ID'           => $item['areaId'],
                        'Chip ID'           => $sensor->{'Chip ID'},
                        'Line Name'         => $sensor->{'Line Name'},
                        'Temp_Upper_Limit'  => $item['tempUL'],
                        'Temp_Lower_Limit'  => $item['tempLL'],
                        'Humid_Upper_Limit' => $item['humidUL'],
                        'Humid_Lower_Limit' => $item['humidLL'],
                        'changed_by'        => $changedBy,
                        'changed_at'        => now(),
                    ]);

                $updated[] = $item['areaId'];

            } catch (Throwable $e) {
                Log::error('SensorLimitController::batchUpdate row failed', [
                    'areaId' => $item['areaId'],
                    'error'  => $e->getMessage(),
                ]);
                $errors[] = "{$item['areaId']}: Database error.";
            }
        }

        if (! empty($errors) && empty($updated)) {
            return response()->json(['message' => 'All updates failed.', 'errors' => $errors], 422);
        }

        return response()->json([
            'message' => empty($errors) ? 'All limits updated.' : 'Some updates failed.',
            'updated' => $updated,
            'skipped' => $skipped,
            'errors'  => $errors,
        ], 200);
    }
}