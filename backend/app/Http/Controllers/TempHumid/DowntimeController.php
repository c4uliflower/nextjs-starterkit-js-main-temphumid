<?php

declare(strict_types=1);

namespace App\Http\Controllers\TempHumid;

use App\Http\Controllers\Controller;
use App\Models\TempHumid\DowntimeRecord;
use App\Services\TempHumid\ActorName;
use App\Services\TempHumid\DowntimeService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Throwable;

class DowntimeController extends Controller
{
    public function __construct(
        private readonly ActorName $actorName,
        private readonly DowntimeService $downtimeService,
    ) {}

    public function validateSensor(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'line_name' => ['required', 'string'],
        ]);

        try {
            $result = $this->downtimeService->validateSensor($validated['line_name']);

            return response()->json($result['body'], $result['status']);
        } catch (Throwable $exception) {
            Log::error('DowntimeController::validateSensor failed', [
                'line_name' => $request->input('line_name'),
                'error' => $exception->getMessage(),
            ]);

            return response()->json(['message' => 'Sensor validation failed.'], 500);
        }
    }

    public function start(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'area_id' => ['required', 'string'],
            'line_name' => ['required', 'string'],
            'processed_by' => ['required', 'string'],
            'source_alert_id' => ['nullable', 'integer'],
            'symptom' => ['required', 'string', 'in:' . implode(',', DowntimeRecord::VALID_SYMPTOMS)],
        ]);

        try {
            $result = $this->downtimeService->start($validated);

            return response()->json($result['body'], $result['status']);
        } catch (Throwable $exception) {
            Log::error('DowntimeController::start failed', [
                'body' => $request->all(),
                'error' => $exception->getMessage(),
            ]);

            return response()->json(['message' => 'Failed to start downtime record.'], 500);
        }
    }

    public function markDone(Request $request, int $id): JsonResponse
    {
        $validated = $request->validate([
            'maintenance_reason' => ['nullable', 'string'],
            'remarks' => ['nullable', 'string'],
        ]);

        try {
            $result = $this->downtimeService->markDone(
                $id,
                $validated,
                $this->actorName->fromRequest($request)
            );

            return response()->json($result['body'], $result['status']);
        } catch (Throwable $exception) {
            Log::error('DowntimeController::markDone failed', [
                'id' => $id,
                'body' => $request->all(),
                'error' => $exception->getMessage(),
            ]);

            return response()->json(['message' => 'Failed to mark downtime record as done.'], 500);
        }
    }

    public function upload(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'ids' => ['required', 'array', 'min:1'],
            'ids.*' => ['required', 'integer'],
            'records' => ['nullable', 'array'],
            'records.*.id' => ['required_with:records', 'integer'],
            'records.*.maintenance_reason' => ['nullable', 'string'],
            'records.*.remarks' => ['nullable', 'string'],
        ]);

        try {
            $result = $this->downtimeService->upload(
                $validated['ids'],
                $validated['records'] ?? [],
                $this->actorName->fromRequest($request)
            );

            return response()->json($result['body'], $result['status']);
        } catch (Throwable $exception) {
            Log::error('DowntimeController::upload failed', [
                'ids' => $request->input('ids'),
                'error' => $exception->getMessage(),
            ]);

            return response()->json(['message' => 'Failed to upload downtime records.'], 500);
        }
    }

    public function active(): JsonResponse
    {
        try {
            return response()->json(['data' => $this->downtimeService->active()], 200);
        } catch (Throwable $exception) {
            Log::error('DowntimeController::active failed', ['error' => $exception->getMessage()]);

            return response()->json(['message' => 'Failed to fetch active downtime records.'], 500);
        }
    }

    public function history(): JsonResponse
    {
        try {
            return response()->json(['data' => $this->downtimeService->history()], 200);
        } catch (Throwable $exception) {
            Log::error('DowntimeController::history failed', ['error' => $exception->getMessage()]);

            return response()->json(['message' => 'Failed to fetch downtime history.'], 500);
        }
    }
}
