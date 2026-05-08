<?php

declare(strict_types=1);

namespace App\Http\Controllers\TempHumid;

use App\Http\Controllers\Controller;
use App\Services\TempHumid\FacilitiesAlertService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

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
        return $this->facilitiesAlertService->processReadings();
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
        return $this->facilitiesAlertService->processVerifying();
    }

    public function escalate(Request $request, int $id): JsonResponse
    {
        return $this->facilitiesAlertService->escalate($request, $id);
    }
}
