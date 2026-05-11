<?php

declare(strict_types=1);

namespace App\Http\Controllers\TempHumid;

use App\Http\Controllers\Controller;
use App\Services\TempHumid\ActorName;
use App\Services\TempHumid\SensorStatusService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Throwable;

class SensorStatusController extends Controller
{
    public function __construct(
        private readonly ActorName $actorName,
        private readonly SensorStatusService $sensorStatusService,
    ) {}

    public function index(Request $request): JsonResponse
    {
        try {
            return response()->json([
                'data' => $this->sensorStatusService->list($request->query('floor')),
            ], 200);
        } catch (Throwable $exception) {
            Log::error('SensorStatusController::index failed', ['error' => $exception->getMessage()]);

            return response()->json(['message' => 'Failed to fetch sensor statuses.'], 500);
        }
    }

    public function batchUpdate(Request $request): JsonResponse
    {
        $request->validate([
            'sensors' => ['required', 'array', 'min:1'],
            'sensors.*.areaId' => ['required', 'string'],
            'sensors.*.status' => ['required', 'string', 'in:Active,Inactive'],
        ]);

        try {
            $result = $this->sensorStatusService->batchUpdate(
                $request->input('sensors', []),
                $this->actorName->fromRequest($request)
            );

            return response()->json($result['body'], $result['status']);
        } catch (Throwable $exception) {
            Log::error('SensorStatusController::batchUpdate failed', ['error' => $exception->getMessage()]);

            return response()->json(['message' => 'Failed to update sensor statuses.'], 500);
        }
    }
}
