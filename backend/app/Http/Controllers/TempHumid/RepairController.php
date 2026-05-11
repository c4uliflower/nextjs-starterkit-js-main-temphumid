<?php

declare(strict_types=1);

namespace App\Http\Controllers\TempHumid;

use App\Http\Controllers\Controller;
use App\Services\TempHumid\ActorName;
use App\Services\TempHumid\RepairService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Throwable;

class RepairController extends Controller
{
    public function __construct(
        private readonly ActorName $actorName,
        private readonly RepairService $repairService,
    ) {}

    public function validateAcu(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'machine_qr' => ['required', 'string'],
        ]);

        try {
            $result = $this->repairService->validateAcu($validated['machine_qr']);

            return response()->json($result['body'], $result['status']);
        } catch (Throwable $exception) {
            Log::error('RepairController::validateAcu failed', [
                'machine_qr' => $request->input('machine_qr'),
                'error' => $exception->getMessage(),
            ]);

            return response()->json(['message' => 'ACU validation failed.'], 500);
        }
    }

    public function start(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'machine_id' => ['required', 'string'],
            'machine_qr' => ['required', 'string'],
            'processed_by' => ['required', 'string'],
            'acu_status' => ['required', 'string', 'in:Active,Inactive'],
            'source_alert_id' => ['nullable', 'integer'],
        ]);

        try {
            $result = $this->repairService->start($validated);

            return response()->json($result['body'], $result['status']);
        } catch (Throwable $exception) {
            Log::error('RepairController::start failed', [
                'body' => $request->all(),
                'error' => $exception->getMessage(),
            ]);

            return response()->json(['message' => 'Failed to start repair record.'], 500);
        }
    }

    public function markDone(Request $request, int $id): JsonResponse
    {
        $validated = $request->validate([
            'repair_reason' => ['nullable', 'string'],
            'remarks' => ['nullable', 'string'],
        ]);

        try {
            $result = $this->repairService->markDone(
                $id,
                $validated,
                $this->actorName->fromRequest($request)
            );

            return response()->json($result['body'], $result['status']);
        } catch (Throwable $exception) {
            Log::error('RepairController::markDone failed', [
                'id' => $id,
                'body' => $request->all(),
                'error' => $exception->getMessage(),
            ]);

            return response()->json(['message' => 'Failed to mark repair record as done.'], 500);
        }
    }

    public function upload(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'ids' => ['required', 'array', 'min:1'],
            'ids.*' => ['required', 'integer'],
            'records' => ['nullable', 'array'],
            'records.*.id' => ['required_with:records', 'integer'],
            'records.*.repair_reason' => ['nullable', 'string'],
            'records.*.remarks' => ['nullable', 'string'],
        ]);

        try {
            $result = $this->repairService->upload(
                $validated['ids'],
                $validated['records'] ?? [],
                $this->actorName->fromRequest($request)
            );

            return response()->json($result['body'], $result['status']);
        } catch (Throwable $exception) {
            Log::error('RepairController::upload failed', [
                'ids' => $request->input('ids'),
                'error' => $exception->getMessage(),
            ]);

            return response()->json(['message' => 'Failed to upload repair records.'], 500);
        }
    }

    public function active(): JsonResponse
    {
        try {
            return response()->json(['data' => $this->repairService->active()], 200);
        } catch (Throwable $exception) {
            Log::error('RepairController::active failed', ['error' => $exception->getMessage()]);

            return response()->json(['message' => 'Failed to fetch active repair records.'], 500);
        }
    }

    public function history(): JsonResponse
    {
        try {
            return response()->json(['data' => $this->repairService->history()], 200);
        } catch (Throwable $exception) {
            Log::error('RepairController::history failed', ['error' => $exception->getMessage()]);

            return response()->json(['message' => 'Failed to fetch repair history.'], 500);
        }
    }
}
