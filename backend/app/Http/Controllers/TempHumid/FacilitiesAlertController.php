<?php

declare(strict_types=1);

namespace App\Http\Controllers\TempHumid;

use App\Http\Controllers\Controller;
use App\Services\TempHumid\FacilitiesAlertService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Throwable;

class FacilitiesAlertController extends Controller
{
    public function __construct(
        private readonly FacilitiesAlertService $facilitiesAlertService,
    ) {}

    public function store(Request $request): JsonResponse
    {
        return $this->facilitiesAlertService->store($request);
    }

    public function index(Request $request): JsonResponse
    {
        return $this->facilitiesAlertService->index($request);
    }

    public function processReadings(): JsonResponse
    {
        try {
            return response()->json($this->facilitiesAlertService->processReadings(), 200);
        } catch (Throwable $exception) {
            Log::error('FacilitiesAlertController::processReadings failed', [
                'error' => $exception->getMessage(),
            ]);

            return response()->json(['message' => 'Failed to process readings.'], 500);
        }
    }

    public function acknowledge(Request $request, int $id): JsonResponse
    {
        return $this->facilitiesAlertService->acknowledge($request, $id);
    }

    public function schedule(Request $request, int $id): JsonResponse
    {
        return $this->facilitiesAlertService->schedule($request, $id);
    }

    public function unschedule(Request $request, int $id): JsonResponse
    {
        return $this->facilitiesAlertService->unschedule($request, $id);
    }

    public function verify(Request $request, int $id): JsonResponse
    {
        return $this->facilitiesAlertService->verify($request, $id);
    }

    public function processVerifying(): JsonResponse
    {
        try {
            return response()->json($this->facilitiesAlertService->processVerifying(), 200);
        } catch (Throwable $exception) {
            Log::error('FacilitiesAlertController::processVerifying failed', [
                'error' => $exception->getMessage(),
            ]);

            return response()->json(['message' => 'Failed to process verifying alerts.'], 500);
        }
    }

    public function escalate(Request $request, int $id): JsonResponse
    {
        return $this->facilitiesAlertService->escalate($request, $id);
    }
}
