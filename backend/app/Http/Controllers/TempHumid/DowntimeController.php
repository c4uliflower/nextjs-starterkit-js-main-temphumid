<?php

declare(strict_types=1);

namespace App\Http\Controllers\TempHumid;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Throwable;

class DowntimeController extends Controller
{
    // -------------------------------------------------------------------------
    // SECTION 1: CONSTANTS
    // -------------------------------------------------------------------------

    private const TABLE = 'TempHumid_Maintenance_Downtime_Log';

    private const STATUS_ONGOING  = 'ongoing';
    private const STATUS_UPLOADED = 'uploaded';
    private const VALID_SYMPTOMS = ['Breach', 'No Data'];

    // Sensors update every ~30 minutes. Readings older than this are considered stale.
    private const STALE_THRESHOLD_MINUTES = 45;

    private const COLS_ACTIVE = [
        'ID',
        'Area ID',
        'Line Name',
        'processed_by',
        'symptom',
        'processed_at',
        'status',
    ];

    private const COLS_HISTORY = [
        'ID',
        'Area ID',
        'Line Name',
        'processed_by',
        'symptom',
        'maintenance_reason',
        'remarks',
        'processed_at',
        'marked_done_at',
        'marked_done_by',
        'uploaded_at',
        'uploaded_by',
        'duration_seconds',
        'status',
    ];


    // -------------------------------------------------------------------------
    // SECTION 2: VALIDATE SENSOR
    // -------------------------------------------------------------------------

    /**
     * POST /api/temphumid/downtime/validate-sensor
     *
     * Looks up a sensor by line_name in Temp_Logger_Chip_ID, then validates
     * against TempHumid_Facilities_Alert_Log (breach path) OR the No Data /
     * Stale path (per-sensor threshold on TempHumid_Calib_Log).
     *
     * Also rejects if the sensor already has an ongoing downtime record,
     * preventing duplicate active entries for the same Area ID.
     *
     * Returns:
     *   { valid: true,  sensor: { areaId, lineName, plant, floor, status } }
     *   { valid: false, message: "..." }
     *
     * Statuses:
     *   breach  → Facilities-driven path (schedule_repair alert exists)
     *   no_data → No Data / Stale path (no reading or reading exceeds threshold)
     *
     * Body: { line_name: string }
     */
    public function validateSensor(Request $request): JsonResponse
    {
        $request->validate([
            'line_name' => ['required', 'string'],
        ]);

        try {
            $lineName = trim($request->input('line_name'));

            // ── Lookup sensor ─────────────────────────────────────────────────
            $sensor = DB::connection('temphumid')
                ->table('Temp_Logger_Chip_ID')
                ->where('Line Name', $lineName)
                ->first();

            if (! $sensor) {
                return response()->json([
                    'valid'   => false,
                    'message' => "Sensor \"{$lineName}\" was not found.",
                ], 200);
            }

            if ($sensor->Status !== 'Active') {
                return response()->json([
                    'valid'   => false,
                    'message' => "{$sensor->{'Line Name'}} is currently inactive.",
                ], 200);
            }

            $areaId  = $sensor->{'Area ID'};
            $tempUL  = (float) $sensor->Temp_Upper_Limit;
            $tempLL  = (float) $sensor->Temp_Lower_Limit;
            $humidUL = (float) $sensor->Humid_Upper_Limit;
            $humidLL = (float) $sensor->Humid_Lower_Limit;

            // ── Block duplicate: reject if already has an ongoing record ──────
            $existing = DB::connection('temphumid')
                ->table(self::TABLE)
                ->where('Area ID', $areaId)
                ->where('status', self::STATUS_ONGOING)
                ->first(['ID']);

            if ($existing) {
                return response()->json([
                    'valid'   => false,
                    'message' => "{$sensor->{'Line Name'}} already has an active downtime record. Mark it as done before starting a new one.",
                ], 200);
            }

            // ── Change 1: validate against Facilities alert log OR No Data / Stale path ──
            // Path A (Facilities-driven / breach): alert exists, notif_status = 'open',
            //   action_type = 'schedule_repair'. Kept exactly as-is from original.
            // Path B (No Data / Stale): no reading exists in TempHumid_Calib_Log, OR
            //   latest reading is older than STALE_THRESHOLD_MINUTES.
            //   Uses per-sensor threshold only — does NOT compare across sensors.
            // Allow maintenance start if EITHER path passes.
            $facilitiesAlert = DB::connection('temphumid')
                ->table('TempHumid_Facilities_Alert_Log')
                ->where('Area ID', $areaId)
                ->where('notif_status', 'open')
                ->where('action_type', 'schedule_repair')
                ->first();

            // Path B: resolve latest reading for this sensor from TempHumid_Calib_Log.
            // Uses Chip ID — not areaId — same as buildCurrentReading().
            // Threshold: STALE_THRESHOLD_MINUTES (45 min). Sensors update every ~30 min.
            $latestReading = DB::connection('temphumid')
                ->table('TempHumid_Calib_Log')
                ->where('Chip ID', $sensor->{'Chip ID'})
                ->whereNotNull('Temperature')
                ->whereNotNull('Humidity')
                ->orderByDesc('Day_Time')
                ->first(['Day_Time']);

            $isNoData = ! $latestReading;

            $readingTime = \Carbon\Carbon::parse($latestReading->Day_Time, 'Asia/Manila');
            $minutesAgo  = $readingTime->diffInMinutes(now('Asia/Manila'));
            $isStale     = $minutesAgo >= self::STALE_THRESHOLD_MINUTES;

            $isNoDataPath = $isNoData || $isStale;

            if (! $facilitiesAlert && ! $isNoDataPath) {
                return response()->json([
                    'valid'   => false,
                    'message' => "{$sensor->{'Line Name'}} is not Scheduled for Maintenance in Facilities, and its latest reading is recent. Cannot start maintenance.",
                ], 200);
            }

            // Derive symptom:
            //   Facilities path → derive from stored alert reading vs limits (breach)
            //   No Data path    → always 'No Data'; do NOT run breach detection here
            if ($facilitiesAlert) {
                // Since maintenance entry is now workflow-based, we only use the stored
                // alert reading to label the original symptom more safely.
                //
                // If the stored values are outside limits → breach
                // Otherwise default to breach as the originating Facilities alert was created
                // from an actual notified issue, and "within limits" should NOT be relabeled
                // as "no_data".
                $temp  = (float) $facilitiesAlert->Temperature;
                $humid = (float) $facilitiesAlert->Humidity;

                $breached =
                    $temp  > $tempUL ||
                    $temp  < $tempLL ||
                    $humid > $humidUL ||
                    $humid < $humidLL;

                $status = 'breach';
            } else {
                // No Data / Stale path — symptom is always 'No Data'
                $status = 'no_data';
            }

            // plant/floor are for frontend display only — not stored in Downtime_Log
            $plant = 'P' . $sensor->Plant;
            $floor = 'F' . $sensor->Floor;

            return response()->json([
                'valid'  => true,
                'sensor' => [
                    'areaId'   => $areaId,                    // e.g. "P1F1-05" → stored in [Area ID]
                    'lineName' => $sensor->{'Line Name'},     // e.g. "SMT MH"  → stored in [Line Name]
                    'plant'    => $plant,                     // display only
                    'floor'    => $floor,                     // display only
                    'status'   => $status,
                    'sourceAlertId'  => $facilitiesAlert->ID ?? null,
                ],
            ], 200);

        } catch (Throwable $e) {
            Log::error('DowntimeController::validateSensor failed', [
                'line_name' => $request->input('line_name'),
                'error'     => $e->getMessage(),
            ]);
            return response()->json(['message' => 'Sensor validation failed.'], 500);
        }
    }


    // -------------------------------------------------------------------------
    // SECTION 3: START DOWNTIME
    // -------------------------------------------------------------------------

    /**
     * POST /api/temphumid/downtime/start
     *
     * Inserts a new row with status = 'ongoing'.
     * Stores both [Area ID] (e.g. "P1F1-05") and [Line Name] (e.g. "SMT MH").
     *
     * Has a secondary duplicate guard: even if the QR scan passed validation,
     * a race condition between two simultaneous operators could slip through.
     * This guard rejects the insert if an ongoing record for the same Area ID
     * already exists at the moment of write.
     *
     * Body:
     * {
     *   area_id:      string   (e.g. "P1F1-05")
     *   line_name:    string   (e.g. "SMT MH")
     *   processed_by: string   (employee ID from QR scan)
     *   symptom:      string   ("Breach" | "No Data")
     * }
     *
     * Returns: { data: { id, area_id, line_name, processed_by, symptom, processed_at, status } }
     */
    public function start(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'area_id'      => ['required', 'string'],
            'line_name'    => ['required', 'string'],
            'processed_by' => ['required', 'string'],
            'source_alert_id' => ['nullable', 'integer'],
            'symptom'      => ['required', 'string', 'in:' . implode(',', self::VALID_SYMPTOMS)],
        ]);

        try {
            // ── Race-condition duplicate guard ────────────────────────────────
            $existing = DB::connection('temphumid')
                ->table(self::TABLE)
                ->where('Area ID', $validated['area_id'])
                ->where('status', self::STATUS_ONGOING)
                ->first(['ID']);

            if ($existing) {
                return response()->json([
                    'message' => "{$validated['line_name']} already has an active downtime record.",
                ], 422);
            }

            $now = now('Asia/Manila');

            $id = DB::connection('temphumid')
                ->table(self::TABLE)
                ->insertGetId([
                    'Area ID'            => $validated['area_id'],
                    'Line Name'          => $validated['line_name'],
                    'processed_by'       => $validated['processed_by'],
                    'source_alert_id'    => $validated['source_alert_id'] ?? null,
                    'symptom'            => $validated['symptom'],
                    'maintenance_reason' => null,
                    'remarks'            => null,
                    'processed_at'       => $now,
                    'marked_done_at'     => null,
                    'marked_done_by'     => null,
                    'uploaded_at'        => null,
                    'uploaded_by'        => null,
                    'duration_seconds'   => null,
                    'status'             => self::STATUS_ONGOING,
                ]);

            return response()->json([
                'message' => 'Downtime record created.',
                'data'    => [
                    'id'           => $id,
                    'area_id'      => $validated['area_id'],
                    'line_name'    => $validated['line_name'],
                    'processed_by' => $validated['processed_by'],
                    'symptom'      => $validated['symptom'],
                    'processed_at' => $now->toISOString(),
                    'status'       => self::STATUS_ONGOING,
                ],
            ], 201);

        } catch (Throwable $e) {
            Log::error('DowntimeController::start failed', [
                'body'  => $request->all(),
                'error' => $e->getMessage(),
            ]);
            return response()->json(['message' => 'Failed to start downtime record.'], 500);
        }
    }


    // -------------------------------------------------------------------------
    // SECTION 4: MARK DONE
    // -------------------------------------------------------------------------

    /**
     * POST /api/temphumid/downtime/mark-done/{id}
     *
     * Fills marked_done_at, marked_done_by, maintenance_reason, remarks,
     * and duration_seconds on an ongoing record. Status remains 'ongoing' until
     * the operator clicks Upload.
     *
     * marked_done_by is derived server-side from the authenticated user —
     * same pattern as changed_by in SensorLimitController.
     *
     * FIX #1: duration_seconds uses diffInSeconds($processedAt, $markedDoneAt)
     *         (correct arg order) so the value is always positive.
     *
     * FIX #2: Status stays 'ongoing' after mark-done — only Upload sets
     *         status = 'uploaded'. 
     *         This allows the record to remain visible in the stop line list until
     *         it is uploaded.
     * Body:
     * {
     *   maintenance_reason:  string  (display label from DOWNTIME_REASONS)
     *   remarks:             string  (required technician remarks)
     * }
     *
     * Returns: { data: { id, maintenance_reason, remarks, marked_done_at, marked_done_by, duration_seconds } }
     */
    public function markDone(Request $request, int $id): JsonResponse
    {
        $validated = $request->validate([
            // Final result is determined by Facilities lifecycle + next sensor reading.
            'maintenance_reason' => ['required', 'string'],
            'remarks'            => ['required', 'string'],
        ]);

        try {
            $record = DB::connection('temphumid')
                ->table(self::TABLE)
                ->where('ID', $id)
                ->first(['ID', 'status', 'processed_at', 'symptom']);

            if (! $record) {
                return response()->json(['message' => 'Downtime record not found.'], 404);
            }

            if ($record->status !== self::STATUS_ONGOING) {
                return response()->json([
                    'message' => "Record is already {$record->status} and cannot be marked done again.",
                ], 422);
            }

            $markedDoneAt = now('Asia/Manila');

            // FIX #1: correct arg order — always positive seconds
            $processedAt     = new \Carbon\Carbon($record->processed_at);
            $durationSeconds = (int) $processedAt->diffInSeconds($markedDoneAt);

            // marked_done_by is derived server-side from the authenticated user —
            // same pattern as changed_by in SensorLimitController.
            $user        = $request->user();
            $markedDoneBy = $user
                ? trim($user->first_name . ' ' . $user->last_name) . ' (' . $user->employee_no . ')'
                : 'unknown';

            DB::connection('temphumid')
                ->table(self::TABLE)
                ->where('ID', $id)
                ->update([
                    'maintenance_reason' => $validated['maintenance_reason'],
                    'remarks'            => $validated['remarks'],
                    'marked_done_at'     => $markedDoneAt,
                    'marked_done_by'     => $markedDoneBy,
                    'duration_seconds'   => $durationSeconds,
                    // status stays 'ongoing' — upload step sets it to 'uploaded'
                ]);

            return response()->json([
                'message' => 'Downtime record marked as done.',
                'data'    => [
                    'id'                 => $id,
                    'symptom'            => $record->symptom,
                    'maintenance_reason' => $validated['maintenance_reason'],
                    'remarks'            => $validated['remarks'],
                    'marked_done_at'     => $markedDoneAt->toISOString(),
                    'marked_done_by'     => $markedDoneBy,
                    'duration_seconds'   => $durationSeconds,
                ],
            ], 200);

        } catch (Throwable $e) {
            Log::error('DowntimeController::markDone failed', [
                'id'    => $id,
                'body'  => $request->all(),
                'error' => $e->getMessage(),
            ]);
            return response()->json(['message' => 'Failed to mark downtime record as done.'], 500);
        }
    }


    // -------------------------------------------------------------------------
    // SECTION 5: UPLOAD (BATCH FINALIZE)
    // -------------------------------------------------------------------------

    /**
     * POST /api/temphumid/downtime/upload
     *
     * Batch-finalizes records: sets status = 'uploaded' and uploaded_at.
     * Only records still in 'ongoing' status (processed but not yet uploaded)
     * are accepted. Records not in 'ongoing' status are silently skipped.
     *
     * uploaded_by is derived server-side from the authenticated user —
     * same pattern as changed_by in SensorLimitController.
     *
     *
     * Body: { ids: [int, ...] }
     *
     * Returns: { updated: [int], skipped: [int], errors: [] }
     */
    public function upload(Request $request): JsonResponse
    {
        $request->validate([
            'ids'   => ['required', 'array', 'min:1'],
            'ids.*' => ['required', 'integer'],
        ]);

        try {
            $ids = $request->input('ids');

            // uploaded_by is derived server-side from the authenticated user —
            // same pattern as changed_by in SensorLimitController.
            $user       = $request->user();
            $uploadedBy = $user
                ? trim($user->first_name . ' ' . $user->last_name) . ' (' . $user->employee_no . ')'
                : 'unknown';

            $records = DB::connection('temphumid')
                ->table(self::TABLE)
                ->whereIn('ID', $ids)
                ->get(['ID', 'status']);

            $toUpdate = [];
            $skipped  = [];

            foreach ($records as $record) {
                // Only upload records that have been marked done (still 'ongoing')
                if ($record->status === self::STATUS_ONGOING) {
                    $toUpdate[] = $record->ID;
                } else {
                    $skipped[] = $record->ID;
                }
            }

            $foundIds   = $records->pluck('ID')->all();
            $missingIds = array_values(array_diff($ids, $foundIds));
            $skipped    = array_merge($skipped, $missingIds);

            $now = now('Asia/Manila');

            if (! empty($toUpdate)) {
                DB::connection('temphumid')
                    ->table(self::TABLE)
                    ->whereIn('ID', $toUpdate)
                    ->update([
                        'status'      => self::STATUS_UPLOADED,
                        'uploaded_at' => $now,
                        'uploaded_by' => $uploadedBy,
                    ]);
            }

            return response()->json([
                'message' => empty($toUpdate)
                    ? 'No records were updated.'
                    : count($toUpdate) . ' record(s) uploaded successfully.',
                'updated' => $toUpdate,
                'skipped' => $skipped,
                'errors'  => [],
            ], 200);

        } catch (Throwable $e) {
            Log::error('DowntimeController::upload failed', [
                'ids'   => $request->input('ids'),
                'error' => $e->getMessage(),
            ]);
            return response()->json(['message' => 'Failed to upload downtime records.'], 500);
        }
    }


    // -------------------------------------------------------------------------
    // SECTION 6: ACTIVE RECORDS
    // -------------------------------------------------------------------------

    /**
     * GET /api/temphumid/downtime/active
     *
     * Returns all ongoing records ordered by processed_at ASC.
     * Polled every 30s by the frontend for shared stop-line visibility.
     * Also consumed by the Monitoring page to show maintenance badges.
     *
     * Returns:
     * {
     *   data: [{ id, area_id, line_name, processed_by, symptom, processed_at, status }]
     * }
     */
    public function active(): JsonResponse
    {
        try {
            $records = DB::connection('temphumid')
                ->table(self::TABLE)
                ->where('status', self::STATUS_ONGOING)
                ->orderBy('processed_at', 'asc')
                ->get(self::COLS_ACTIVE);

            $data = $records->map(fn ($r) => [
                'id'           => $r->ID,
                'area_id'      => $r->{'Area ID'},
                'line_name'    => $r->{'Line Name'},
                'processed_by' => $r->processed_by,
                'symptom'      => $r->symptom,
                'processed_at' => $r->processed_at,
                'status'       => $r->status,
            ]);

            return response()->json(['data' => $data], 200);

        } catch (Throwable $e) {
            Log::error('DowntimeController::active failed', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Failed to fetch active downtime records.'], 500);
        }
    }


    // -------------------------------------------------------------------------
    // SECTION 7: HISTORY
    // -------------------------------------------------------------------------

    /**
     * GET /api/temphumid/downtime/history
     *
     * FIX #2: Only returns status = 'uploaded' records — all columns fully
     * populated. Called on mount and after upload action only (no polling).
     *
     *
     * Returns:
     * {
     *   data: [{
     *     id, area_id, line_name, processed_by, symptom,
     *     maintenance_reason, remarks, processed_at,
     *     marked_done_at, marked_done_by, uploaded_at, uploaded_by,
     *     duration_seconds, status
     *   }]
     * }
     */
    public function history(): JsonResponse
    {
        try {
            $records = DB::connection('temphumid')
                ->table(self::TABLE)
                ->where('status', self::STATUS_UPLOADED)
                ->orderByDesc('uploaded_at')
                ->get(self::COLS_HISTORY);

            $data = $records->map(fn ($r) => [
                'id'                 => $r->ID,
                'area_id'            => $r->{'Area ID'},
                'line_name'          => $r->{'Line Name'},
                'processed_by'       => $r->processed_by,
                'symptom'            => $r->symptom,
                'maintenance_reason' => $r->maintenance_reason,
                'remarks'            => $r->remarks,
                'processed_at'       => $r->processed_at,
                'marked_done_at'     => $r->marked_done_at,
                'marked_done_by'     => $r->marked_done_by,
                'uploaded_at'        => $r->uploaded_at,
                'uploaded_by'        => $r->uploaded_by,
                'duration_seconds'   => $r->duration_seconds,
                'status'             => $r->status,
            ]);

            return response()->json(['data' => $data], 200);

        } catch (Throwable $e) {
            Log::error('DowntimeController::history failed', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Failed to fetch downtime history.'], 500);
        }
    }
}