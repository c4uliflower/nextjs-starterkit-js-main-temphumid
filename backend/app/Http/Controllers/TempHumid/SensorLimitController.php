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
     * Returns the current limits for a single sensor.
     * Used by: Adjust Sensor Limits modal on open (seeds draft state).
     */
    public function show(string $areaId): JsonResponse
    {
        try {
            $sensor = DB::connection('temphumid')
                ->table('Temp_Logger_Chip_ID')
                ->where('Area ID', $areaId)
                ->first();

            if (! $sensor) {
                return response()->json(['message' => 'Sensor not found.'], 404);
            }

            return response()->json([
                'data' => [
                    'areaId'  => $sensor->{'Area ID'},
                    'lineName' => $sensor->{'Line Name'},
                    'tempUL'  => $sensor->Temp_Upper_Limit,
                    'tempLL'  => $sensor->Temp_Lower_Limit,
                    'humidUL' => $sensor->Humid_Upper_Limit,
                    'humidLL' => $sensor->Humid_Lower_Limit,
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
     * POST /api/temphumid/sensors/{areaId}/limits
     * Updates limits for a single sensor in Temp_Logger_Chip_ID.
     * Used by: Adjust Sensor Limits modal save button (per-sensor save).
     *
     * Body: { tempUL, tempLL, humidUL, humidLL }
     * Validation: LL must be strictly less than UL for both temp and humid.
     */
    public function update(Request $request, string $areaId): JsonResponse
    {
        $validated = $request->validate([
            'tempUL'  => ['required', 'numeric'],
            'tempLL'  => ['required', 'numeric'],
            'humidUL' => ['required', 'numeric'],
            'humidLL' => ['required', 'numeric'],
        ]);

        // Business rule: lower limit must be strictly less than upper limit
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
            $affected = DB::connection('temphumid')
                ->table('Temp_Logger_Chip_ID')
                ->where('Area ID', $areaId)
                ->update([
                    'Temp_Upper_Limit'  => $validated['tempUL'],
                    'Temp_Lower_Limit'  => $validated['tempLL'],
                    'Humid_Upper_Limit' => $validated['humidUL'],
                    'Humid_Lower_Limit' => $validated['humidLL'],
                    'Date Modified'     => now(),
                ]);

            if ($affected === 0) {
                return response()->json(['message' => 'Sensor not found.'], 404);
            }

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
     * Updates limits for multiple sensors at once.
     * Used by: Adjust Sensor Limits modal "Apply to all" + bulk save.
     *
     * Body: { sensors: [{ areaId, tempUL, tempLL, humidUL, humidLL }] }
     */
    public function batchUpdate(Request $request): JsonResponse
    {
        $request->validate([
            'sensors'            => ['required', 'array', 'min:1'],
            'sensors.*.areaId'   => ['required', 'string'],
            'sensors.*.tempUL'   => ['required', 'numeric'],
            'sensors.*.tempLL'   => ['required', 'numeric'],
            'sensors.*.humidUL'  => ['required', 'numeric'],
            'sensors.*.humidLL'  => ['required', 'numeric'],
        ]);

        $errors  = [];
        $updated = [];

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
                DB::connection('temphumid')
                    ->table('Temp_Logger_Chip_ID')
                    ->where('Area ID', $item['areaId'])
                    ->update([
                        'Temp_Upper_Limit'  => $item['tempUL'],
                        'Temp_Lower_Limit'  => $item['tempLL'],
                        'Humid_Upper_Limit' => $item['humidUL'],
                        'Humid_Lower_Limit' => $item['humidLL'],
                        'Date Modified'     => now(),
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
            'errors'  => $errors,
        ], 200);
    }
}