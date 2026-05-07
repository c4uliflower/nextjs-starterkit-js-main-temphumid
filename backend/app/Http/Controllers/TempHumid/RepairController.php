<?php

declare(strict_types=1);

namespace App\Http\Controllers\TempHumid;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Throwable;

class RepairController extends Controller
{
    private const MACHINE_VIEW = 'vw_MachineMatrix_tbl_MACHINES_Facilities';
    private const TABLE = 'TempHumid_Repair_Downtime_Log';

    private const STATUS_ONGOING = 'ongoing';
    private const STATUS_UPLOADED = 'uploaded';
    private const ACU_SHORT_CATEGORY = 'ACU';
    private const ACU_CATEGORY = 'Air Conditioning Unit';

    private const COLS_ACTIVE = [
        'ID',
        'machine_id',
        'machine_qr',
        'source_alert_id',
        'category_name',
        'description',
        'location',
        'acu_status',
        'processed_by',
        'processed_at',
        'status',
        'marked_done_at',
        'repair_reason',
        'remarks',
        'duration_seconds',
    ];

    private const COLS_HISTORY = [
        'ID',
        'machine_id',
        'machine_qr',
        'source_alert_id',
        'category_name',
        'description',
        'location',
        'acu_status',
        'processed_by',
        'repair_reason',
        'remarks',
        'processed_at',
        'marked_done_at',
        'marked_done_by',
        'uploaded_at',
        'uploaded_by',
        'duration_seconds',
        'status',
    ];

    /**
     * POST /api/temphumid/repair/validate-acu
     *
     * Body: { machine_qr: string }
     */
    public function validateAcu(Request $request): JsonResponse
    {
        $request->validate([
            'machine_qr' => ['required', 'string'],
        ]);

        try {
            $lookup = trim((string) $request->input('machine_qr'));
            $machine = $this->findAcu($lookup);

            if (! $machine) {
                return response()->json([
                    'valid' => false,
                    'message' => "ACU \"{$lookup}\" was not found.",
                ], 200);
            }

            $existing = DB::connection('temphumid')
                ->table(self::TABLE)
                ->where('machine_id', $machine->MACHINE_ID)
                ->where('status', self::STATUS_ONGOING)
                ->first(['ID']);

            if ($existing) {
                return response()->json([
                    'valid' => false,
                    'message' => "{$machine->MACHINE_ID} already has an active repair record.",
                ], 200);
            }

            return response()->json([
                'valid' => true,
                'acu' => $this->mapMachine($machine),
            ], 200);
        } catch (Throwable $e) {
            Log::error('RepairController::validateAcu failed', [
                'machine_qr' => $request->input('machine_qr'),
                'error' => $e->getMessage(),
            ]);

            return response()->json(['message' => 'ACU validation failed.'], 500);
        }
    }

    /**
     * POST /api/temphumid/repair/start
     */
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
            $machine = $this->findAcu($validated['machine_qr'])
                ?? $this->findAcu($validated['machine_id']);

            if (! $machine) {
                return response()->json(['message' => 'ACU record was not found.'], 422);
            }

            $existing = DB::connection('temphumid')
                ->table(self::TABLE)
                ->where('machine_id', $machine->MACHINE_ID)
                ->where('status', self::STATUS_ONGOING)
                ->first(['ID']);

            if ($existing) {
                return response()->json([
                    'message' => "{$machine->MACHINE_ID} already has an active repair record.",
                ], 422);
            }

            $now = now('Asia/Manila');
            $acu = $this->mapMachine($machine);

            $id = DB::connection('temphumid')
                ->table(self::TABLE)
                ->insertGetId([
                    'machine_id' => $acu['machineId'],
                    'machine_qr' => $acu['machineQr'],
                    'source_alert_id' => $validated['source_alert_id'] ?? null,
                    'category_name' => $acu['categoryName'],
                    'description' => $acu['description'],
                    'location' => $acu['location'],
                    'acu_status' => $acu['status'],
                    'processed_by' => $validated['processed_by'],
                    'repair_reason' => null,
                    'remarks' => null,
                    'processed_at' => $now,
                    'marked_done_at' => null,
                    'marked_done_by' => null,
                    'uploaded_at' => null,
                    'uploaded_by' => null,
                    'duration_seconds' => null,
                    'status' => self::STATUS_ONGOING,
                ]);

            return response()->json([
                'message' => 'Repair record created.',
                'data' => [
                    'id' => $id,
                    ...$acu,
                    'source_alert_id' => $validated['source_alert_id'] ?? null,
                    'processed_by' => $validated['processed_by'],
                    'processed_at' => $now->toISOString(),
                    'status' => self::STATUS_ONGOING,
                ],
            ], 201);
        } catch (Throwable $e) {
            Log::error('RepairController::start failed', [
                'body' => $request->all(),
                'error' => $e->getMessage(),
            ]);

            return response()->json(['message' => 'Failed to start repair record.'], 500);
        }
    }

    /**
     * POST /api/temphumid/repair/mark-done/{id}
     */
    public function markDone(Request $request, int $id): JsonResponse
    {
        $validated = $request->validate([
            'repair_reason' => ['required', 'string'],
            'remarks' => ['required', 'string'],
        ]);

        try {
            $record = DB::connection('temphumid')
                ->table(self::TABLE)
                ->where('ID', $id)
                ->first(['ID', 'status', 'processed_at']);

            if (! $record) {
                return response()->json(['message' => 'Repair record not found.'], 404);
            }

            if ($record->status !== self::STATUS_ONGOING) {
                return response()->json([
                    'message' => "Record is already {$record->status} and cannot be marked done again.",
                ], 422);
            }

            $markedDoneAt = now('Asia/Manila');
            $processedAt = new \Carbon\Carbon($record->processed_at);
            $durationSeconds = (int) $processedAt->diffInSeconds($markedDoneAt);

            $user = $request->user();
            $markedDoneBy = $user
                ? trim($user->first_name . ' ' . $user->last_name) . ' (' . $user->employee_no . ')'
                : 'unknown';

            DB::connection('temphumid')
                ->table(self::TABLE)
                ->where('ID', $id)
                ->update([
                    'repair_reason' => $validated['repair_reason'],
                    'remarks' => $validated['remarks'],
                    'marked_done_at' => $markedDoneAt,
                    'marked_done_by' => $markedDoneBy,
                    'duration_seconds' => $durationSeconds,
                ]);

            return response()->json([
                'message' => 'Repair record marked as done.',
                'data' => [
                    'id' => $id,
                    'repair_reason' => $validated['repair_reason'],
                    'remarks' => $validated['remarks'],
                    'marked_done_at' => $markedDoneAt->toISOString(),
                    'marked_done_by' => $markedDoneBy,
                    'duration_seconds' => $durationSeconds,
                ],
            ], 200);
        } catch (Throwable $e) {
            Log::error('RepairController::markDone failed', [
                'id' => $id,
                'body' => $request->all(),
                'error' => $e->getMessage(),
            ]);

            return response()->json(['message' => 'Failed to mark repair record as done.'], 500);
        }
    }

    /**
     * POST /api/temphumid/repair/upload
     */
    public function upload(Request $request): JsonResponse
    {
        $request->validate([
            'ids' => ['required', 'array', 'min:1'],
            'ids.*' => ['required', 'integer'],
        ]);

        try {
            $ids = $request->input('ids');
            $user = $request->user();
            $uploadedBy = $user
                ? trim($user->first_name . ' ' . $user->last_name) . ' (' . $user->employee_no . ')'
                : 'unknown';

            $records = DB::connection('temphumid')
                ->table(self::TABLE)
                ->whereIn('ID', $ids)
                ->get(['ID', 'status', 'marked_done_at']);

            $toUpdate = [];
            $skipped = [];

            foreach ($records as $record) {
                if ($record->status === self::STATUS_ONGOING && $record->marked_done_at !== null) {
                    $toUpdate[] = $record->ID;
                } else {
                    $skipped[] = $record->ID;
                }
            }

            $foundIds = $records->pluck('ID')->all();
            $skipped = array_merge($skipped, array_values(array_diff($ids, $foundIds)));
            $now = now('Asia/Manila');

            if (! empty($toUpdate)) {
                DB::connection('temphumid')
                    ->table(self::TABLE)
                    ->whereIn('ID', $toUpdate)
                    ->update([
                        'status' => self::STATUS_UPLOADED,
                        'uploaded_at' => $now,
                        'uploaded_by' => $uploadedBy,
                    ]);
            }

            return response()->json([
                'message' => empty($toUpdate)
                    ? 'No records were updated.'
                    : count($toUpdate) . ' repair record(s) uploaded successfully.',
                'updated' => $toUpdate,
                'skipped' => $skipped,
                'errors' => [],
            ], 200);
        } catch (Throwable $e) {
            Log::error('RepairController::upload failed', [
                'ids' => $request->input('ids'),
                'error' => $e->getMessage(),
            ]);

            return response()->json(['message' => 'Failed to upload repair records.'], 500);
        }
    }

    public function active(): JsonResponse
    {
        try {
            $records = DB::connection('temphumid')
                ->table(self::TABLE)
                ->where('status', self::STATUS_ONGOING)
                ->orderBy('processed_at', 'asc')
                ->get(self::COLS_ACTIVE);

            return response()->json([
                'data' => $records->map(fn ($record) => $this->mapRepairRecord($record)),
            ], 200);
        } catch (Throwable $e) {
            Log::error('RepairController::active failed', ['error' => $e->getMessage()]);

            return response()->json(['message' => 'Failed to fetch active repair records.'], 500);
        }
    }

    public function history(): JsonResponse
    {
        try {
            $records = DB::connection('temphumid')
                ->table(self::TABLE)
                ->where('status', self::STATUS_UPLOADED)
                ->orderByDesc('uploaded_at')
                ->get(self::COLS_HISTORY);

            return response()->json([
                'data' => $records->map(fn ($record) => $this->mapRepairRecord($record)),
            ], 200);
        } catch (Throwable $e) {
            Log::error('RepairController::history failed', ['error' => $e->getMessage()]);

            return response()->json(['message' => 'Failed to fetch repair history.'], 500);
        }
    }

    private function findAcu(string $lookup): ?object
    {
        return DB::connection('temphumid')
            ->table(self::MACHINE_VIEW)
            ->where(function ($query): void {
                $query
                    ->where('SHORT_CATEGORY_NAME', self::ACU_SHORT_CATEGORY)
                    ->orWhere('CATEGORY_NAME', self::ACU_CATEGORY);
            })
            ->where(function ($query) use ($lookup): void {
                $query
                    ->where('MACHINE_QR', $lookup)
                    ->orWhere('MACHINE_ID', $lookup);

                if (ctype_digit($lookup)) {
                    $query->orWhere('ID', (int) $lookup);
                }
            })
            ->first();
    }

    /**
     * @return array<string, mixed>
     */
    private function mapMachine(object $machine): array
    {
        return [
            'id' => $machine->ID,
            'sourceAlertId' => null,
            'machineId' => $machine->MACHINE_ID,
            'machineQr' => $machine->MACHINE_QR,
            'categoryName' => $machine->CATEGORY_NAME,
            'location' => $machine->LOCATION,
            'description' => $machine->DESCRIPTION,
            'status' => ((int) $machine->IS_ACTIVE) === 1 ? 'Active' : 'Inactive',
            'operationalStatus' => $machine->STATUS,
            'installedDate' => $machine->INSTALLED_DATE,
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function mapRepairRecord(object $record): array
    {
        return [
            'id' => $record->ID,
            'source_alert_id' => $record->source_alert_id ?? null,
            'machine_id' => $record->machine_id,
            'machine_qr' => $record->machine_qr,
            'category_name' => $record->category_name,
            'description' => $record->description,
            'location' => $record->location,
            'acu_status' => $record->acu_status,
            'processed_by' => $record->processed_by,
            'repair_reason' => $record->repair_reason ?? null,
            'remarks' => $record->remarks ?? null,
            'processed_at' => $record->processed_at,
            'marked_done_at' => $record->marked_done_at ?? null,
            'marked_done_by' => $record->marked_done_by ?? null,
            'uploaded_at' => $record->uploaded_at ?? null,
            'uploaded_by' => $record->uploaded_by ?? null,
            'duration_seconds' => $record->duration_seconds ?? null,
            'status' => $record->status,
        ];
    }
}
