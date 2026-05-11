<?php

declare(strict_types=1);

namespace App\Http\Controllers\TempHumid;

use App\Http\Controllers\Controller;
use App\Services\TempHumid\SensorService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Throwable;

class SensorController extends Controller
{
    public function __construct(
        private readonly SensorService $sensorService,
    ) {}

    public function index(Request $request): JsonResponse
    {
        try {
            return response()->json([
                'data' => $this->sensorService->registry($request->query('floor')),
            ], 200);
        } catch (Throwable $exception) {
            Log::error('SensorController::index failed', ['error' => $exception->getMessage()]);

            return response()->json(['message' => 'Failed to fetch sensors.'], 500);
        }
    }

    public function currentReadings(Request $request): JsonResponse
    {
        try {
            return response()->json([
                'data' => $this->sensorService->currentReadings($request->query('floor')),
            ], 200);
        } catch (Throwable $exception) {
            Log::error('SensorController::currentReadings failed', ['error' => $exception->getMessage()]);

            return response()->json(['message' => 'Failed to fetch current readings.'], 500);
        }
    }

    public function readingByAreaId(string $areaId, Request $request): JsonResponse
    {
        try {
            $result = $this->sensorService->readingByAreaId($areaId, $request->query('verifiedAfter'));

            return response()->json($result['body'], $result['status']);
        } catch (Throwable $exception) {
            Log::error('SensorController::readingByAreaId failed', [
                'areaId' => $areaId,
                'error' => $exception->getMessage(),
            ]);

            return response()->json(['message' => 'Failed to fetch reading.'], 500);
        }
    }

    public function summary(): JsonResponse
    {
        try {
            return response()->json([
                'data' => $this->sensorService->summary(),
            ], 200);
        } catch (Throwable $exception) {
            Log::error('SensorController::summary failed', ['error' => $exception->getMessage()]);

            return response()->json(['message' => 'Failed to fetch dashboard summary.'], 500);
        }
    }
}
