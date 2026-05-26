<?php

declare(strict_types=1);

namespace App\Http\Controllers\TempHumid;

use App\Http\Controllers\Controller;
use App\Services\TempHumid\FacilitiesAlertService;
use App\Services\TempHumid\SensorService;
use App\Services\TempHumid\SensorStatusService;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Log;
use Throwable;

class MonitoringSnapshotController extends Controller
{
    public function __construct(
        private readonly SensorService $sensorService,
        private readonly SensorStatusService $sensorStatusService,
        private readonly FacilitiesAlertService $facilitiesAlertService,
    ) {}

    public function __invoke(): JsonResponse
    {
        try {
            return response()->json([
                'data' => [
                    'readings' => $this->sensorService->currentReadings(null),
                    'sensorStatuses' => $this->sensorStatusService->list(null),
                    'facilitiesAlerts' => $this->facilitiesAlertService->listAlerts([
                        'open',
                        'acknowledged',
                        'verifying',
                    ]),
                ],
            ], 200);
        } catch (Throwable $exception) {
            Log::error('MonitoringSnapshotController failed', [
                'error' => $exception->getMessage(),
            ]);

            return response()->json(['message' => 'Failed to fetch monitoring snapshot.'], 500);
        }
    }
}
