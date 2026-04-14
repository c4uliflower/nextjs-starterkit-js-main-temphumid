<?php

declare(strict_types=1);

namespace App\Http\Controllers\TempHumid;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Throwable;

class SensorStatusController extends Controller
{
    /**
     * Maps frontend floor slugs to Plant + Floor column values in Temp_Logger_Chip_ID.
     * Mirrors SensorController::FLOOR_MAP exactly.
     */
    private const FLOOR_MAP = [
        'p1f1'  => ['plant' => '1',     'floor' => '1'],
        'p1f2'  => ['plant' => '1',     'floor' => '2'],
        'p2f1'  => ['plant' => '2',     'floor' => '1'],
        'p2f2'  => ['plant' => '2',     'floor' => '2', 'extra_area_ids' => ['P1F1-16']],
        'p12f2' => ['plant' => '1 & 2', 'floor' => '2'],
        'wh'    => ['plant' => '2',     'floor' => '1', 'location_like' => 'P2F1WH'],
    ];

    /**
     * GET /api/temphumid/sensors/status
     * Returns the latest status per sensor from TempHumid_Status_Log.
     * Optionally filtered by floor slug.
     * Used by: Manage Sensor Status modal on open.
     *
     * Query params:
     *   ?floor=p1f1   (optional)
     */
    public function index(Request $request): JsonResponse
    {
        try {
            $query = DB::connection('temphumid')
                ->table('Temp_Logger_Chip_ID');

            // Apply floor filter if ?floor= is present
            $this->applyFloorFilter($query, $request);

            $sensors = $query->get(['Area ID', 'Chip ID', 'Line Name', 'Plant', 'Floor', 'Status']);
            $areaIds = $sensors->pluck('Area ID')->all();

            // Fetch latest status per sensor from Status_Log in one query.
            // Falls back to Temp_Logger_Chip_ID.Status if no log entry exists yet.
            $latestStatuses = $this->fetchLatestStatuses($areaIds);

            $data = $sensors->map(function ($sensor) use ($latestStatuses) {
                $areaId    = $sensor->{'Area ID'};
                $statusRow = $latestStatuses[$areaId] ?? null;

                return [
                    'areaId'   => $areaId,
                    'chipId'   => $sensor->{'Chip ID'},
                    'lineName' => $sensor->{'Line Name'},
                    'plant'    => $sensor->Plant,
                    'floor'    => $sensor->Floor,
                    // Prefer latest log row; fall back to Temp_Logger_Chip_ID.Status
                    'status'   => $statusRow ? $statusRow->Status : $sensor->Status,
                ];
            });

            return response()->json(['data' => $data], 200);

        } catch (Throwable $e) {
            Log::error('SensorStatusController::index failed', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Failed to fetch sensor statuses.'], 500);
        }
    }

    /**
     * POST /api/temphumid/sensors/status/batch
     * Inserts new rows into TempHumid_Status_Log for multiple sensors.
     * Trigger updates Temp_Logger_Chip_ID.Status automatically.
     * Skips insert for sensors where status has not changed.
     *
     * Body: { sensors: [{ areaId, status }] }
     */
    public function batchUpdate(Request $request): JsonResponse
    {
        $request->validate([
            'sensors'          => ['required', 'array', 'min:1'],
            'sensors.*.areaId' => ['required', 'string'],
            'sensors.*.status' => ['required', 'string', 'in:Active,Inactive'],
        ]);

        $user      = $request->user();
        $changedBy = $user
            ? trim($user->first_name . ' ' . $user->last_name) . ' (' . $user->employee_no . ')'
            : 'unknown';

        $errors  = [];
        $updated = [];
        $skipped = [];

        foreach ($request->sensors as $item) {
            try {
                // Get sensor metadata from Temp_Logger_Chip_ID
                $sensor = DB::connection('temphumid')
                    ->table('Temp_Logger_Chip_ID')
                    ->where('Area ID', $item['areaId'])
                    ->first();

                if (! $sensor) {
                    $errors[] = "{$item['areaId']}: Sensor not found.";
                    continue;
                }

                // Get current status from latest Status_Log row
                $current = DB::connection('temphumid')
                    ->table('TempHumid_Status_Log')
                    ->where('Area ID', $item['areaId'])
                    ->orderByDesc('changed_at')
                    ->orderByDesc('ID')
                    ->first();

                // Skip if nothing changed — same pattern as SensorLimitController::batchUpdate()
                if ($current && $current->Status === $item['status']) {
                    $skipped[] = $item['areaId'];
                    continue;
                }

                DB::connection('temphumid')
                    ->table('TempHumid_Status_Log')
                    ->insert([
                        'Area ID'    => $item['areaId'],
                        'Chip ID'    => $sensor->{'Chip ID'},
                        'Line Name'  => $sensor->{'Line Name'},
                        'Status'     => $item['status'],
                        'changed_by' => $changedBy,
                        'changed_at' => now('Asia/Manila'),
                    ]);

                $updated[] = $item['areaId'];

            } catch (Throwable $e) {
                Log::error('SensorStatusController::batchUpdate row failed', [
                    'areaId' => $item['areaId'],
                    'error'  => $e->getMessage(),
                ]);
                $errors[] = "{$item['areaId']}: Database error.";
            }
        }

        if (! empty($errors) && empty($updated)) {
            return response()->json(['message' => 'All updates failed.', 'errors' => $errors], 422);
        }

        return response()->json([
            'message' => empty($errors) ? 'All statuses updated.' : 'Some updates failed.',
            'updated' => $updated,
            'skipped' => $skipped,
            'errors'  => $errors,
        ], 200);
    }

    // -------------------------------------------------------------------------
    // Private helpers
    // -------------------------------------------------------------------------

    /**
     * Applies a floor slug filter to the given query builder if ?floor= is present.
     * Mirrors SensorController::applyFloorFilter() exactly.
     *
     * @param  \Illuminate\Database\Query\Builder  $query
     * @param  Request                             $request
     */
    private function applyFloorFilter($query, Request $request): void
    {
        if (! $request->has('floor')) {
            return;
        }

        $slug = strtolower($request->query('floor'));
        $map  = self::FLOOR_MAP[$slug] ?? null;

        if (! $map) {
            return;
        }

        $query->where(function ($q) use ($map) {
            $q->where('Plant', $map['plant'])
              ->where('Floor', $map['floor']);

            if (isset($map['location_like'])) {
                $q->where('Location', 'like', '%' . $map['location_like'] . '%');
            }
        });

        if (! empty($map['extra_area_ids'])) {
            $query->orWhere(function ($q) use ($map) {
                $q->whereIn('Area ID', $map['extra_area_ids']);
            });
        }
    }

    /**
     * Fetch the latest status row from TempHumid_Status_Log for each areaId.
     * Returns associative array keyed by areaId.
     *
     * Uses the same WHERE NOT EXISTS pattern as SensorController::fetchLatestLimits()
     * to get the single most-recent row per Area ID in one round-trip.
     *
     * @param  string[]  $areaIds
     * @return array<string, object>
     */
    private function fetchLatestStatuses(array $areaIds): array
    {
        if (empty($areaIds)) {
            return [];
        }

        $rows = DB::connection('temphumid')
            ->table('TempHumid_Status_Log as sl')
            ->whereIn('sl.Area ID', $areaIds)
            ->where(function ($q) {
                // Only keep the row where no newer row exists for the same Area ID
                $q->whereNotExists(function ($sub) {
                    $sub->from('TempHumid_Status_Log as sl2')
                        ->whereColumn('sl2.Area ID', 'sl.Area ID')
                        ->where(function ($inner) {
                            $inner->where('sl2.changed_at', '>', DB::raw('sl.changed_at'))
                                  ->orWhere(function ($tie) {
                                      $tie->where('sl2.changed_at', '=', DB::raw('sl.changed_at'))
                                          ->where('sl2.ID', '>', DB::raw('sl.ID'));
                                  });
                        });
                });
            })
            ->get(['Area ID', 'Status']);

        $map = [];
        foreach ($rows as $row) {
            $map[$row->{'Area ID'}] = $row;
        }

        return $map;
    }
}