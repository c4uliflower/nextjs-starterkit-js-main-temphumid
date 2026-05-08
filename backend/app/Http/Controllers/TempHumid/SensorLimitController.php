<?php

declare(strict_types=1);

namespace App\Http\Controllers\TempHumid;

use App\Http\Controllers\Controller;
use App\Services\TempHumid\ActorName;
use App\Services\TempHumid\SensorLimitService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Throwable;

class SensorLimitController extends Controller
{
    public function __construct(
        private readonly ActorName $actorName,
        private readonly SensorLimitService $sensorLimitService,
    ) {}

    public function show(string $areaId): JsonResponse
    {
        try {
            $log = $this->sensorLimitService->latestForAreaId($areaId);

            if (! $log) {
                return response()->json(['message' => 'Sensor not found.'], 404);
            }

            return response()->json([
                'data' => [
                    'areaId' => $log->{'Area ID'},
                    'lineName' => $log->{'Line Name'},
                    'tempUL' => $log->Temp_Upper_Limit,
                    'tempLL' => $log->Temp_Lower_Limit,
                    'humidUL' => $log->Humid_Upper_Limit,
                    'humidLL' => $log->Humid_Lower_Limit,
                ],
            ], 200);
        } catch (Throwable $exception) {
            Log::error('SensorLimitController::show failed', [
                'areaId' => $areaId,
                'error' => $exception->getMessage(),
            ]);

            return response()->json(['message' => 'Failed to fetch sensor limits.'], 500);
        }
    }

    public function batchShow(Request $request): JsonResponse
    {
        $request->validate([
            'areaIds' => ['required', 'array', 'min:1'],
            'areaIds.*' => ['required', 'string'],
        ]);

        try {
            return response()->json([
                'data' => $this->sensorLimitService->batchShow($request->query('areaIds')),
            ], 200);
        } catch (Throwable $exception) {
            Log::error('SensorLimitController::batchShow failed', [
                'areaIds' => $request->query('areaIds'),
                'error' => $exception->getMessage(),
            ]);

            return response()->json(['message' => 'Failed to fetch sensor limits.'], 500);
        }
    }

    public function update(Request $request, string $areaId): JsonResponse
    {
        $validated = $request->validate([
            'tempUL' => ['required', 'numeric'],
            'tempLL' => ['required', 'numeric'],
            'humidUL' => ['required', 'numeric'],
            'humidLL' => ['required', 'numeric'],
        ]);

        try {
            $result = $this->sensorLimitService->update(
                $areaId,
                $validated,
                $this->actorName->fromRequest($request)
            );

            return response()->json($result['body'], $result['status']);
        } catch (Throwable $exception) {
            Log::error('SensorLimitController::update failed', [
                'areaId' => $areaId,
                'error' => $exception->getMessage(),
            ]);

            return response()->json(['message' => 'Failed to update sensor limits.'], 500);
        }
    }

    public function batchUpdate(Request $request): JsonResponse
    {
        $request->validate([
            'sensors' => ['required', 'array', 'min:1'],
            'sensors.*.areaId' => ['required', 'string'],
            'sensors.*.tempUL' => ['required', 'numeric'],
            'sensors.*.tempLL' => ['required', 'numeric'],
            'sensors.*.humidUL' => ['required', 'numeric'],
            'sensors.*.humidLL' => ['required', 'numeric'],
        ]);

        try {
            $result = $this->sensorLimitService->batchUpdate(
                $request->input('sensors', []),
                $this->actorName->fromRequest($request)
            );

            return response()->json($result['body'], $result['status']);
        } catch (Throwable $exception) {
            Log::error('SensorLimitController::batchUpdate failed', ['error' => $exception->getMessage()]);

            return response()->json(['message' => 'Failed to update sensor limits.'], 500);
        }
    }
}
