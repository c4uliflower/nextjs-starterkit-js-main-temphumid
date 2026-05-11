<?php

declare(strict_types=1);

namespace App\Http\Controllers\TempHumid;

use App\Http\Controllers\Controller;
use App\Services\TempHumid\SensorReadingHistoryService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Symfony\Component\HttpFoundation\StreamedResponse;
use Throwable;

class SensorReadingController extends Controller
{
    public function __construct(
        private readonly SensorReadingHistoryService $historyService,
    ) {}

    public function history(Request $request, string $areaId): JsonResponse
    {
        $validated = $request->validate([
            'from' => ['required', 'date_format:Y-m-d'],
            'to' => ['required', 'date_format:Y-m-d', 'after_or_equal:from'],
        ]);

        try {
            $result = $this->historyService->history($areaId, $validated['from'], $validated['to']);

            return response()->json($result['body'], $result['status']);
        } catch (Throwable $exception) {
            Log::error('SensorReadingController::history failed', [
                'areaId' => $areaId,
                'error' => $exception->getMessage(),
            ]);

            return response()->json(['message' => 'Failed to fetch sensor history.'], 500);
        }
    }

    public function batchHistory(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'areaIds' => ['required', 'array', 'min:1'],
            'areaIds.*' => ['required', 'string'],
            'from' => ['required', 'date_format:Y-m-d'],
            'to' => ['required', 'date_format:Y-m-d', 'after_or_equal:from'],
        ]);

        try {
            $result = $this->historyService->batchHistory(
                $validated['areaIds'],
                $validated['from'],
                $validated['to']
            );

            return response()->json($result['body'], $result['status']);
        } catch (Throwable $exception) {
            Log::error('SensorReadingController::batchHistory failed', [
                'areaIds' => $request->query('areaIds'),
                'error' => $exception->getMessage(),
            ]);

            return response()->json(['message' => 'Failed to fetch batch sensor history.'], 500);
        }
    }

    public function exportRaw(Request $request): StreamedResponse
    {
        $validated = $request->validate([
            'areaIds' => ['required', 'array', 'min:1'],
            'areaIds.*' => ['required', 'string'],
            'from' => ['required', 'date_format:Y-m-d'],
            'to' => ['required', 'date_format:Y-m-d', 'after_or_equal:from'],
        ]);

        return $this->historyService->exportRaw(
            $validated['areaIds'],
            $validated['from'],
            $validated['to']
        );
    }
}
