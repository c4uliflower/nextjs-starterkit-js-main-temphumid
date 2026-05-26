<?php

declare(strict_types=1);

namespace App\Http\Controllers\TempHumid;

use App\Http\Controllers\Controller;
use App\Services\TempHumid\FacilitiesAlertService;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Throwable;

// DEV_READING_SIMULATOR_REMOVE_BEFORE_PROD: delete this whole controller before shipping.
class DevReadingSimulationController extends Controller
{
    public function __construct(
        private readonly FacilitiesAlertService $facilitiesAlertService,
    ) {}

    public function store(Request $request): JsonResponse
    {
        abort_unless(app()->environment('local'), 404);

        $validated = $request->validate([
            'areaId' => ['required', 'string'],
            'temperature' => ['required', 'numeric'],
            'humidity' => ['required', 'numeric'],
            'processAlerts' => ['sometimes', 'boolean'],
        ]);

        try {
            $sensor = DB::connection('temphumid')
                ->table('Temp_Logger_Chip_ID')
                ->where('Area ID', $validated['areaId'])
                ->where('Status', 'Active')
                ->first();

            if (! $sensor) {
                return response()->json(['message' => 'Active sensor not found.'], 404);
            }

            $latestReadingAt = DB::connection('temphumid')
                ->table('TempHumid_Calib_Log')
                ->where('Chip ID', $sensor->{'Chip ID'})
                ->whereNotNull('Temperature')
                ->whereNotNull('Humidity')
                ->orderByDesc('Day_Time')
                ->value('Day_Time');

            $readingAtCarbon = Carbon::now('Asia/Manila');

            if ($latestReadingAt) {
                $latestReadingAtCarbon = Carbon::parse($latestReadingAt, 'Asia/Manila');

                if ($readingAtCarbon->lessThanOrEqualTo($latestReadingAtCarbon)) {
                    $readingAtCarbon = $latestReadingAtCarbon->copy()->addSecond();
                }
            }

            $readingAt = $readingAtCarbon->format('Y-m-d H:i:s');
            $temperature = round((float) $validated['temperature'], 2);
            $humidity = round((float) $validated['humidity'], 2);

            DB::connection('temphumid')
                ->table('TempHumid_Calib_Log')
                ->insert([
                    'Chip ID' => $sensor->{'Chip ID'},
                    'Day_Time' => $readingAt,
                    'Temperature' => $temperature,
                    'Humidity' => $humidity,
                    'Heat Index' => null,
                ]);

            $processPayload = null;

            if (($validated['processAlerts'] ?? true) === true) {
                $processPayload = $this->facilitiesAlertService->processReadings();
                $processPayload['verifying'] = $this->facilitiesAlertService->processVerifying();
            }

            return response()->json([
                'message' => 'Simulated reading inserted.',
                'data' => [
                    'areaId' => $validated['areaId'],
                    'chipId' => $sensor->{'Chip ID'},
                    'lineName' => $sensor->{'Line Name'},
                    'readingAt' => $readingAt,
                    'temperature' => $temperature,
                    'humidity' => $humidity,
                    'processResult' => $processPayload,
                ],
            ], 201);
        } catch (Throwable $exception) {
            Log::error('DevReadingSimulationController::store failed', [
                'areaId' => $validated['areaId'] ?? null,
                'error' => $exception->getMessage(),
            ]);

            return response()->json(['message' => 'Failed to simulate reading.'], 500);
        }
    }
}
