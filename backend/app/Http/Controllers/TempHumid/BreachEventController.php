<?php

declare(strict_types=1);

namespace App\Http\Controllers\TempHumid;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Carbon\Carbon;
use Throwable;

class BreachEventController extends Controller
{
    public function index(Request $request, int $alertId): JsonResponse
    {
        $page    = max(1, (int) $request->query('page', 1));
        $perPage = 10;

        try {
            $total = DB::connection('temphumid')
                ->table('TempHumid_Breach_Events')
                ->where('alert_id', $alertId)
                ->count();

            $lastPage = max(1, (int) ceil($total / $perPage));
            $page     = min($page, $lastPage);

            $rows = DB::connection('temphumid')
                ->table('TempHumid_Breach_Events')
                ->where('alert_id', $alertId)
                ->orderBy('reading_at', 'desc')
                ->orderBy('ID', 'desc')
                ->offset(($page - 1) * $perPage)
                ->limit($perPage)
                ->get();

            $data = $rows->map(function ($row) {
                $readingAtUtc = $row->reading_at
                    ? Carbon::parse(
                        preg_replace('/(\.\d{6})\d+/', '$1', $row->reading_at)
                    )->toIso8601String()
                    : null;

                    Log::info('BreachEvent readingAt debug', [
                    'raw'       => $row->reading_at,
                    'formatted' => $readingAtUtc,
                ]);

                return [
                    'readingAt'   => $readingAtUtc,
                    'temperature' => round((float) $row->temperature, 2),
                    'humidity'    => round((float) $row->humidity, 2),
                    'limits'      => [
                        'tempUL'  => $row->Temp_Upper_Limit,
                        'tempLL'  => $row->Temp_Lower_Limit,
                        'humidUL' => $row->Humid_Upper_Limit,
                        'humidLL' => $row->Humid_Lower_Limit,
                    ],
                    'breached' => [
                        'temp'  => (int) $row->breached_temp  === 1,
                        'humid' => (int) $row->breached_humid === 1,
                    ],
                ];
            });

            return response()->json([
                'data' => $data,
                'meta' => [
                    'currentPage' => $page,
                    'perPage'     => $perPage,
                    'total'       => $total,
                    'lastPage'    => $lastPage,
                    'hasMore'     => $page < $lastPage,
                ],
            ], 200);

        } catch (Throwable $e) {
            Log::error('BreachEventController::index failed', [
                'alertId' => $alertId,
                'error'   => $e->getMessage(),
            ]);

            return response()->json(['message' => 'Failed to fetch breach events.'], 500);
        }
    }
}