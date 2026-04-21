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

class FacilitiesAlertController extends Controller
{
    // =========================================================================
    // POST /api/temphumid/facilities/alerts
    //
    // Creates a new breach alert. One row per active breach per sensor.
    // acknowledged_by derived from authenticated user server-side.
    // =========================================================================
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'areaId'      => ['required', 'string'],
            'lineName'    => ['required', 'string'],
            'temperature' => ['required', 'numeric'],
            'humidity'    => ['required', 'numeric'],
            'tempUL'      => ['required', 'numeric'],
            'tempLL'      => ['required', 'numeric'],
            'humidUL'     => ['required', 'numeric'],
            'humidLL'     => ['required', 'numeric'],
        ]);

        $existing = DB::connection('temphumid')
            ->table('TempHumid_Facilities_Alert_Log')
            ->where('Area ID', $validated['areaId'])
            ->whereIn('notif_status', ['acknowledged', 'open', 'verifying'])
            ->first();

        if ($existing) {
            return response()->json([
                'message' => 'Alert already exists.',
                'data'    => $this->formatAlert($existing),
            ], 200);
        }

        try {
            $user           = $request->user();
            $acknowledgedBy = $user
                ? trim($user->first_name . ' ' . $user->last_name) . ' (' . $user->employee_no . ')'
                : 'unknown';

            $id = DB::connection('temphumid')
                ->table('TempHumid_Facilities_Alert_Log')
                ->insertGetId([
                    'Area ID'            => $validated['areaId'],
                    'Line Name'          => $validated['lineName'],
                    'Temperature'        => $validated['temperature'],
                    'Humidity'           => $validated['humidity'],
                    'Temp_Upper_Limit'   => $validated['tempUL'],
                    'Temp_Lower_Limit'   => $validated['tempLL'],
                    'Humid_Upper_Limit'  => $validated['humidUL'],
                    'Humid_Lower_Limit'  => $validated['humidLL'],
                    'acknowledged_by'    => $acknowledgedBy,
                    'acknowledged_at'    => now('Asia/Manila'),
                    'notif_status'       => 'acknowledged',
                    'opened_by'          => null,
                    'opened_at'          => null,
                    'action_type'        => null,
                    'action_remarks'     => null,
                    'verified_by'        => null,
                    'verified_at'        => null,
                    'resolved_by'        => null,
                    'resolved_at'        => null,
                ]);

            return response()->json([
                'message' => 'Alert created.',
                'data'    => ['id' => $id],
            ], 201);

        } catch (Throwable $e) {
            Log::error('FacilitiesAlertController::store failed', [
                'areaId' => $validated['areaId'] ?? null,
                'error'  => $e->getMessage(),
            ]);
            return response()->json(['message' => 'Failed to create alert.'], 500);
        }
    }

    // =========================================================================
    // GET /api/temphumid/facilities/alerts
    //
    // Returns all alerts ordered by priority.
    // Optional ?status= or ?status[]= filter.
    // =========================================================================
    public function index(Request $request): JsonResponse
    {
        try {
            $query = DB::connection('temphumid')
                ->table('TempHumid_Facilities_Alert_Log');

            if ($request->has('status')) {
                $statuses = (array) $request->query('status');
                $query->whereIn('notif_status', $statuses);
            }

            $rows = $query
                ->orderByRaw("
                    CASE notif_status
                        WHEN 'acknowledged' THEN 0
                        WHEN 'open'         THEN 1
                        WHEN 'verifying'    THEN 2
                        WHEN 'resolved'     THEN 3
                        ELSE 4
                    END ASC
                ")
                ->orderBy('acknowledged_at', 'asc')
                ->get();

            $data = $rows->map(fn ($r) => $this->formatAlert($r));

            return response()->json(['data' => $data], 200);

        } catch (Throwable $e) {
            Log::error('FacilitiesAlertController::index failed', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Failed to fetch alerts.'], 500);
        }
    }

    // =============================================================================
    //
    // POST /api/temphumid/facilities/alerts/process-readings
    //
    // Called by the Facilities dashboard during polling.
    // Detects normal→breach transitions for active alerts and writes
    // one breach event row per transition into TempHumid_Breach_Events.
    //
    // No body required.
    // Response:
    //   { message: string, processed: int, transitions: int }
    // =============================================================================
    
    public function processReadings(): JsonResponse
        {
            try {
                $alerts = DB::connection('temphumid')
                    ->table('TempHumid_Facilities_Alert_Log')
                    ->whereIn('notif_status', ['acknowledged', 'open', 'verifying'])
                    ->get();

                $transitions = 0;

                foreach ($alerts as $alert) {
                    try {
                        DB::connection('temphumid')->transaction(function () use ($alert, &$transitions) {
                            $areaId = $alert->{'Area ID'};

                            $sensor = DB::connection('temphumid')
                                ->table('Temp_Logger_Chip_ID')
                                ->where('Area ID', $areaId)
                                ->where('Status', 'Active')
                                ->first();

                            if (! $sensor) return;

                            $reading = DB::connection('temphumid')
                                ->table('TempHumid_Calib_Log')
                                ->where('Chip ID', $sensor->{'Chip ID'})
                                ->whereNotNull('Temperature')
                                ->whereNotNull('Humidity')
                                ->orderByDesc('Day_Time')
                                ->first();

                            if (! $reading) return;

                            $readingAt    = Carbon::parse($reading->Day_Time, 'Asia/Manila');
                            $readingAtSql = $readingAt->format('Y-m-d H:i:s.u');

                            $lastReadAtSql = $alert->last_sensor_read_at
                                ? Carbon::parse($alert->last_sensor_read_at)->format('Y-m-d H:i:s.u')
                                : null;

                            if ($lastReadAtSql === $readingAtSql) return;

                            $activeLimRow = DB::connection('temphumid')
                                ->table('TempHumid_Limits_Log')
                                ->where('Area ID', $areaId)
                                ->where('changed_at', '<=', $readingAtSql)
                                ->orderByDesc('changed_at')
                                ->orderByDesc('ID')
                                ->first();

                            $tempUL  = (float) ($activeLimRow ? $activeLimRow->Temp_Upper_Limit  : $sensor->Temp_Upper_Limit);
                            $tempLL  = (float) ($activeLimRow ? $activeLimRow->Temp_Lower_Limit  : $sensor->Temp_Lower_Limit);
                            $humidUL = (float) ($activeLimRow ? $activeLimRow->Humid_Upper_Limit : $sensor->Humid_Upper_Limit);
                            $humidLL = (float) ($activeLimRow ? $activeLimRow->Humid_Lower_Limit : $sensor->Humid_Lower_Limit);

                            $temp  = (float) $reading->Temperature;
                            $humid = (float) $reading->Humidity;

                            $breachedTemp  = $temp  > $tempUL || $temp  < $tempLL;
                            $breachedHumid = $humid > $humidUL || $humid < $humidLL;
                            $isBreaching   = $breachedTemp || $breachedHumid;

                            $currentState = $isBreaching ? 'breach' : 'normal';
                            $prevState    = $alert->last_sensor_state ?? null;
                            $isTransition = ($currentState === 'breach') && ($prevState !== 'normal');

                            if ($isTransition) {
                                $alreadyRecorded = DB::connection('temphumid')
                                    ->table('TempHumid_Breach_Events')
                                    ->where('alert_id', $alert->ID)
                                    ->where('reading_at', $readingAtSql)
                                    ->exists();

                                if (! $alreadyRecorded) {
                                    DB::connection('temphumid')
                                        ->table('TempHumid_Breach_Events')
                                        ->insert([
                                            'alert_id'          => $alert->ID,
                                            'Area ID'           => $areaId,
                                            'Line Name'         => $sensor->{'Line Name'},
                                            'reading_at'        => $readingAtSql,
                                            'temperature'       => round($temp,  2),
                                            'humidity'          => round($humid, 2),
                                            'Temp_Upper_Limit'  => $tempUL,
                                            'Temp_Lower_Limit'  => $tempLL,
                                            'Humid_Upper_Limit' => $humidUL,
                                            'Humid_Lower_Limit' => $humidLL,
                                            'breached_temp'     => $breachedTemp  ? 1 : 0,
                                            'breached_humid'    => $breachedHumid ? 1 : 0,
                                            'created_at'        => now('Asia/Manila'),
                                        ]);

                                    $transitions++;
                                }
                            }

                            DB::connection('temphumid')->update(
                                "UPDATE [TempHumid_Facilities_Alert_Log]
                                SET [last_sensor_state] = ?,
                                    [last_sensor_read_at] = CAST(? AS datetime2(7))
                                WHERE [ID] = ?",
                                [$currentState, $readingAtSql, $alert->ID]
                            );
                        });
                    } catch (Throwable $e) {
                        Log::error('FacilitiesAlertController::processReadings alert failed', [
                            'alertId' => $alert->ID,
                            'error'   => $e->getMessage(),
                        ]);
                    }
                }

                return response()->json([
                    'message'     => 'Readings processed.',
                    'processed'   => $alerts->count(),
                    'transitions' => $transitions,
                ], 200);

            } catch (Throwable $e) {
                Log::error('FacilitiesAlertController::processReadings failed', [
                    'error' => $e->getMessage(),
                ]);
                return response()->json(['message' => 'Failed to process readings.'], 500);
            }
        }
    

        // =========================================================================
        // PATCH /api/temphumid/facilities/alerts/{id}/acknowledge
        //
        // Moves alert from 'acknowledged' → 'open'.
        // opened_by derived from authenticated user.
        // =========================================================================
        public function acknowledge(Request $request, int $id): JsonResponse
        {
            try {
                $alert = DB::connection('temphumid')
                    ->table('TempHumid_Facilities_Alert_Log')
                    ->where('ID', $id)
                    ->first();

                if (! $alert) {
                    return response()->json(['message' => 'Alert not found.'], 404);
                }

                if ($alert->notif_status !== 'acknowledged') {
                    return response()->json(['message' => 'Alert is already open or resolved.'], 422);
                }

                $user     = $request->user();
                $openedBy = $user
                    ? trim($user->first_name . ' ' . $user->last_name) . ' (' . $user->employee_no . ')'
                    : 'unknown';

                DB::connection('temphumid')
                    ->table('TempHumid_Facilities_Alert_Log')
                    ->where('ID', $id)
                    ->update([
                        'notif_status' => 'open',
                        'opened_by'    => $openedBy,
                        'opened_at'    => now('Asia/Manila'),
                    ]);

                $updated = DB::connection('temphumid')
                    ->table('TempHumid_Facilities_Alert_Log')
                    ->where('ID', $id)
                    ->first();

                return response()->json([
                    'message' => 'Alert opened.',
                    'data'    => $this->formatAlert($updated),
                ], 200);

            } catch (Throwable $e) {
                Log::error('FacilitiesAlertController::acknowledge failed', [
                    'id' => $id, 'error' => $e->getMessage(),
                ]);
                return response()->json(['message' => 'Failed to open alert.'], 500);
            }
        }

        // =========================================================================
        // PATCH /api/temphumid/facilities/alerts/{id}/schedule
        //
        // Tags alert as scheduled for maintenance.
        // Sets action_type = schedule_repair, clears verified_by/at.
        // Does NOT insert an action log row — no verification attempt yet.
        // Only allowed when notif_status is 'open'.
        //
        // Body: { actionRemarks? }
        // =========================================================================
        public function schedule(Request $request, int $id): JsonResponse
        {
            $validated = $request->validate([
                'actionRemarks' => ['nullable', 'string', 'max:1000'],
            ]);

            try {
                $alert = DB::connection('temphumid')
                    ->table('TempHumid_Facilities_Alert_Log')
                    ->where('ID', $id)
                    ->first();

                if (! $alert) {
                    return response()->json(['message' => 'Alert not found.'], 404);
                }

                if ($alert->notif_status !== 'open') {
                    return response()->json(['message' => 'Alert must be open to schedule maintenance.'], 422);
                }

                if ($alert->action_type === 'schedule_repair') {
                    return response()->json(['message' => 'Alert is already scheduled for maintenance.'], 422);
                }

                DB::connection('temphumid')
                    ->table('TempHumid_Facilities_Alert_Log')
                    ->where('ID', $id)
                    ->update([
                        'action_type'    => 'schedule_repair',
                        'action_remarks' => $validated['actionRemarks'] ?? null,
                        'verified_by'    => null,
                        'verified_at'    => null,
                    ]);

                $updated = DB::connection('temphumid')
                    ->table('TempHumid_Facilities_Alert_Log')
                    ->where('ID', $id)
                    ->first();

                return response()->json([
                    'message' => 'Alert scheduled for maintenance.',
                    'data'    => $this->formatAlert($updated),
                ], 200);

            } catch (Throwable $e) {
                Log::error('FacilitiesAlertController::schedule failed', [
                    'id' => $id, 'error' => $e->getMessage(),
                ]);
                return response()->json(['message' => 'Failed to schedule alert.'], 500);
            }
        }

        // =========================================================================
        // PATCH /api/temphumid/facilities/alerts/{id}/unschedule
        //
        // Cancels a scheduled maintenance — clears action_type back to null.
        // No action log row inserted — nothing was verified.
        // Only allowed when notif_status is 'open' and action_type is 'schedule_repair'.
        // =========================================================================
        public function unschedule(Request $request, int $id): JsonResponse
        {
            try {
                $alert = DB::connection('temphumid')
                    ->table('TempHumid_Facilities_Alert_Log')
                    ->where('ID', $id)
                    ->first();

                if (! $alert) {
                    return response()->json(['message' => 'Alert not found.'], 404);
                }

                if ($alert->notif_status !== 'open' || $alert->action_type !== 'schedule_repair') {
                    return response()->json(['message' => 'Alert is not in scheduled state.'], 422);
                }

                DB::connection('temphumid')
                    ->table('TempHumid_Facilities_Alert_Log')
                    ->where('ID', $id)
                    ->update([
                        'action_type'    => null,
                        'action_remarks' => null,
                    ]);

                $updated = DB::connection('temphumid')
                    ->table('TempHumid_Facilities_Alert_Log')
                    ->where('ID', $id)
                    ->first();

                return response()->json([
                    'message' => 'Maintenance cancelled.',
                    'data'    => $this->formatAlert($updated),
                ], 200);

            } catch (Throwable $e) {
                Log::error('FacilitiesAlertController::unschedule failed', [
                    'id' => $id, 'error' => $e->getMessage(),
                ]);
                return response()->json(['message' => 'Failed to cancel maintenance.'], 500);
            }
        }

    // =========================================================================
    // PATCH /api/temphumid/facilities/alerts/{id}/verify
    //
    // Submits a verification attempt. Always inserts one action log row.
    // Moves alert to 'verifying'. processVerifying() will resolve or bounce.
    //
    // Both paths use this endpoint:
    //   - adjust_temp / adjust_humid / others  → normal verify
    //   - schedule_repair                       → verify after maintenance
    //
    // Body: { actionType, actionRemarks? }
    // =========================================================================
    public function verify(Request $request, int $id): JsonResponse
    {
        $validated = $request->validate([
            'actionType'    => ['required', 'string', 'in:adjust_temp,adjust_humid,schedule_repair,others'],
            'actionRemarks' => ['nullable', 'string', 'max:1000'],
        ]);

        if ($validated['actionType'] === 'others' && empty(trim($validated['actionRemarks'] ?? ''))) {
            return response()->json([
                'message' => 'Remarks are required when action type is "others".',
                'errors'  => ['actionRemarks' => ['Required for action type "others".']],
            ], 422);
        }

        try {
            $alert = DB::connection('temphumid')
                ->table('TempHumid_Facilities_Alert_Log')
                ->where('ID', $id)
                ->first();

            if (! $alert) {
                return response()->json(['message' => 'Alert not found.'], 404);
            }

            if ($alert->notif_status !== 'open') {
                return response()->json(['message' => 'Alert must be open before it can be verified.'], 422);
            }

            // schedule_repair verify path: alert must already be tagged as scheduled
            if ($validated['actionType'] === 'schedule_repair' && $alert->action_type !== 'schedule_repair') {
                return response()->json(['message' => 'Alert is not scheduled for maintenance.'], 422);
            }

            $user       = $request->user();
            $verifiedBy = $user
                ? trim($user->first_name . ' ' . $user->last_name) . ' (' . $user->employee_no . ')'
                : 'unknown';

            $sensor = DB::connection('temphumid')
            ->table('Temp_Logger_Chip_ID')
            ->where('Area ID', $alert->{'Area ID'})
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

            $verifiedAt = now('Asia/Manila');

            DB::connection('temphumid')->transaction(function () use ($id, $validated, $verifiedBy, $verifiedAt, $latestReadingAt, $alert) {
                DB::connection('temphumid')
                    ->table('TempHumid_Facilities_Alert_Log')
                    ->where('ID', $id)
                    ->update([
                        'notif_status'            => 'verifying',
                        'action_type'             => $validated['actionType'],
                        'action_remarks'          => $validated['actionRemarks'] ?? null,
                        'verified_by'             => $verifiedBy,
                        'verified_at'             => $verifiedAt,
                        'verify_baseline_read_at' => $latestReadingAt
                            ? Carbon::parse($latestReadingAt)->format('Y-m-d H:i:s.u')
                            : null,
                    ]);

                DB::connection('temphumid')
                    ->table('TempHumid_Facilities_Action_Log')
                    ->insert([
                        'alert_id'              => $alert->ID,
                        'Area ID'               => $alert->{'Area ID'},
                        'Line Name'             => $alert->{'Line Name'},
                        'action_type'           => $validated['actionType'],
                        'action_remarks'        => $validated['actionRemarks'] ?? null,
                        'action_by'             => $verifiedBy,
                        'action_at'             => now('Asia/Manila'),
                        'action_result'         => null,
                        'evaluated_at'          => null,
                        'evaluation_reading_at' => null,
                    ]);
            });

            $updated = DB::connection('temphumid')
                ->table('TempHumid_Facilities_Alert_Log')
                ->where('ID', $id)
                ->first();

            return response()->json([
                'message' => 'Alert set to verifying.',
                'data'    => $this->formatAlert($updated),
            ], 200);

        } catch (Throwable $e) {
            Log::error('FacilitiesAlertController::verify failed', [
                'id' => $id, 'error' => $e->getMessage(),
            ]);
            return response()->json(['message' => 'Failed to set alert to verifying.'], 500);
        }
    }

    // =========================================================================
    // POST /api/temphumid/facilities/alerts/process-verifying
    //
    // Called by the frontend after every fetchAlerts when verifying alerts exist.
    // Checks each verifying alert against the latest post-verify sensor reading:
    //   - no reading yet         → leave as verifying
    //   - reading clear          → resolve
    //   - reading still breaching → bounce back to open, clear verified_by/at
    //
    // After each resolve/bounce, updates the latest pending action log row
    // with action_result, evaluated_at, evaluation_reading_at.
    // =========================================================================
    public function processVerifying(): JsonResponse
    {
        try {
            $alerts = DB::connection('temphumid')
                ->table('TempHumid_Facilities_Alert_Log')
                ->where('notif_status', 'verifying')
                ->get();

            $updated = [];

            foreach ($alerts as $alert) {
                if (! $alert->verified_at) {
                    continue;
                }

                $sensor = DB::connection('temphumid')
                    ->table('Temp_Logger_Chip_ID')
                    ->where('Area ID', $alert->{'Area ID'})
                    ->where('Status', 'Active')
                    ->first();

                if (! $sensor) {
                    continue;
                }

                $areaId = $alert->{'Area ID'};

                // Latest limits — prefer limits log, fall back to sensor master
                $limRow = DB::connection('temphumid')
                    ->table('TempHumid_Limits_Log as ll')
                    ->where('ll.Area ID', $areaId)
                    ->where(function ($q) {
                        $q->whereNotExists(function ($sub) {
                            $sub->from('TempHumid_Limits_Log as ll2')
                                ->whereColumn('ll2.Area ID', 'll.Area ID')
                                ->where(function ($inner) {
                                    $inner->where('ll2.changed_at', '>', DB::raw('ll.changed_at'))
                                          ->orWhere(function ($tie) {
                                              $tie->where('ll2.changed_at', '=', DB::raw('ll.changed_at'))
                                                  ->where('ll2.ID', '>', DB::raw('ll.ID'));
                                          });
                                });
                        });
                    })
                    ->first(['Area ID', 'Temp_Upper_Limit', 'Temp_Lower_Limit', 'Humid_Upper_Limit', 'Humid_Lower_Limit']);

                $tempUL  = $limRow ? $limRow->Temp_Upper_Limit  : $sensor->Temp_Upper_Limit;
                $tempLL  = $limRow ? $limRow->Temp_Lower_Limit  : $sensor->Temp_Lower_Limit;
                $humidUL = $limRow ? $limRow->Humid_Upper_Limit : $sensor->Humid_Upper_Limit;
                $humidLL = $limRow ? $limRow->Humid_Lower_Limit : $sensor->Humid_Lower_Limit;

                if (! $alert->verify_baseline_read_at) {
                    continue;
                }

                // Only readings that arrived AFTER verify was clicked
                $reading = DB::connection('temphumid')
                    ->table('TempHumid_Calib_Log')
                    ->where('Chip ID', $sensor->{'Chip ID'})
                    ->whereNotNull('Temperature')
                    ->whereNotNull('Humidity')
                    ->whereRaw("Day_Time > CAST(? AS datetime2)", [
                        Carbon::parse($alert->verify_baseline_read_at)->format('Y-m-d H:i:s.u')
                    ])
                    ->orderBy('Day_Time', 'asc')
                    ->first();

                if (! $reading) {
                    continue; // no post-verify reading yet — keep waiting
                }

                $temp  = (float) $reading->Temperature;
                $humid = (float) $reading->Humidity;

                $breached =
                    $temp  > (float) $tempUL ||
                    $temp  < (float) $tempLL ||
                    $humid > (float) $humidUL ||
                    $humid < (float) $humidLL;

                if ($breached) {
                    // Bounce back to open — clear verified_by/at, preserve action_type/remarks
                    DB::connection('temphumid')
                        ->table('TempHumid_Facilities_Alert_Log')
                        ->where('ID', $alert->ID)
                        ->where('notif_status', 'verifying')
                        ->update([
                            'notif_status' => 'open',
                            'verified_by'  => null,
                            'verified_at'  => null,
                            'verify_baseline_read_at' => null,
                            'verify_attempt_count' => DB::raw('COALESCE(verify_attempt_count, 0) + 1'),
                        ]);

                    DB::connection('temphumid')
                        ->table('TempHumid_Facilities_Action_Log')
                        ->where('alert_id', $alert->ID)
                        ->whereNull('action_result')
                        ->orderByDesc('ID')
                        ->limit(1)
                        ->update([
                            'action_result'         => 'failed',
                            'evaluated_at'          => now('Asia/Manila'),
                            'evaluation_reading_at' => $reading->Day_Time,
                        ]);
                } else {
                    // Resolve
                    DB::connection('temphumid')
                        ->table('TempHumid_Facilities_Alert_Log')
                        ->where('ID', $alert->ID)
                        ->where('notif_status', 'verifying')
                        ->update([
                            'notif_status' => 'resolved',
                            'resolved_by'  => 'system',
                            'resolved_at'  => now('Asia/Manila'),
                        ]);

                    DB::connection('temphumid')
                        ->table('TempHumid_Facilities_Action_Log')
                        ->where('alert_id', $alert->ID)
                        ->whereNull('action_result')
                        ->orderByDesc('ID')
                        ->limit(1)
                        ->update([
                            'action_result'         => 'success',
                            'evaluated_at'          => now('Asia/Manila'),
                            'evaluation_reading_at' => $reading->Day_Time,
                        ]);
                }

                $updatedRow = DB::connection('temphumid')
                    ->table('TempHumid_Facilities_Alert_Log')
                    ->where('ID', $alert->ID)
                    ->first();

                $updated[] = $this->formatAlert($updatedRow);
            }

            return response()->json([
                'message' => 'Processed verifying alerts.',
                'data'    => $updated,
            ], 200);

        } catch (Throwable $e) {
            Log::error('FacilitiesAlertController::processVerifying failed', [
                'error' => $e->getMessage(),
            ]);
            return response()->json(['message' => 'Failed to process verifying alerts.'], 500);
        }
    }

    // =========================================================================
    // PATCH /api/temphumid/facilities/alerts/{id}/escalate
    //
    // Records escalation when an acknowledged alert crosses a 2h threshold.
    // Body: { escalationCount }
    // =========================================================================
    public function escalate(Request $request, int $id): JsonResponse
    {
        $validated = $request->validate([
            'escalationCount' => ['required', 'integer', 'min:1'],
        ]);

        try {
            $alert = DB::connection('temphumid')
                ->table('TempHumid_Facilities_Alert_Log')
                ->where('ID', $id)
                ->first();

            if (! $alert) {
                return response()->json(['message' => 'Alert not found.'], 404);
            }

            if ($alert->notif_status !== 'acknowledged') {
                return response()->json(['message' => 'Alert is not in acknowledged state.'], 422);
            }

            if ((int) $alert->escalation_count >= $validated['escalationCount']) {
                return response()->json([
                    'message' => 'Escalation already recorded.',
                    'data'    => $this->formatAlert($alert),
                ], 200);
            }

            DB::connection('temphumid')
                ->table('TempHumid_Facilities_Alert_Log')
                ->where('ID', $id)
                ->update([
                    'escalated_at'     => $alert->escalated_at ?? now('Asia/Manila'),
                    'escalation_count' => $validated['escalationCount'],
                ]);

            $updated = DB::connection('temphumid')
                ->table('TempHumid_Facilities_Alert_Log')
                ->where('ID', $id)
                ->first();

            return response()->json([
                'message' => 'Alert escalated.',
                'data'    => $this->formatAlert($updated),
            ], 200);

        } catch (Throwable $e) {
            Log::error('FacilitiesAlertController::escalate failed', [
                'id' => $id, 'error' => $e->getMessage(),
            ]);
            return response()->json(['message' => 'Failed to escalate alert.'], 500);
        }
    }

    // =========================================================================
    // Private helpers
    // =========================================================================

    private function formatAlert(object $row): array
    {
        return [
            'id'              => $row->ID,
            'areaId'          => $row->{'Area ID'},
            'lineName'        => $row->{'Line Name'},
            'temperature'     => $row->Temperature !== null ? round((float) $row->Temperature, 2) : null,
            'humidity'        => $row->Humidity    !== null ? round((float) $row->Humidity,    2) : null,
            'tempUL'          => $row->Temp_Upper_Limit,
            'tempLL'          => $row->Temp_Lower_Limit,
            'humidUL'         => $row->Humid_Upper_Limit,
            'humidLL'         => $row->Humid_Lower_Limit,
            'acknowledgedBy'  => $row->acknowledged_by,
            'acknowledgedAt'  => $row->acknowledged_at,
            'status'          => $row->notif_status,
            'escalatedAt'     => $row->escalated_at,
            'escalationCount' => $row->escalation_count,
            'openedBy'        => $row->opened_by,
            'openedAt'        => $row->opened_at,
            'actionType'      => $row->action_type,
            'actionRemarks'   => $row->action_remarks,
            'verifiedBy'      => $row->verified_by,
            'verifiedAt'      => $row->verified_at,
            'resolvedBy'      => $row->resolved_by,
            'resolvedAt'      => $row->resolved_at,
            'verifyAttemptCount' => (int) ($row->verify_attempt_count ?? 0),
        ];
    }
}