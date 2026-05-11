<?php

declare(strict_types=1);

namespace App\Http\Controllers\TempHumid;

use App\Http\Controllers\Controller;
use App\Services\TempHumid\BreachEventService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Throwable;

class BreachEventController extends Controller
{
    public function __construct(
        private readonly BreachEventService $breachEventService,
    ) {}

    public function index(Request $request, int $alertId): JsonResponse
    {
        try {
            return response()->json(
                $this->breachEventService->paginatedForAlert(
                    $alertId,
                    (int) $request->query('page', 1)
                ),
                200
            );
        } catch (Throwable $exception) {
            Log::error('BreachEventController::index failed', [
                'alertId' => $alertId,
                'error' => $exception->getMessage(),
            ]);

            return response()->json(['message' => 'Failed to fetch breach events.'], 500);
        }
    }
}
