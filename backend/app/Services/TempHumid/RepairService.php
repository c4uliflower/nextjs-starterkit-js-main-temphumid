<?php

declare(strict_types=1);

namespace App\Services\TempHumid;

use App\Models\TempHumid\AcuQr;
use App\Models\TempHumid\RepairRecord;
use Carbon\Carbon;
use Illuminate\Database\Eloquent\Builder;

class RepairService
{
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
     * @return array{status: int, body: array<string, mixed>}
     */
    public function validateAcu(string $lookup): array
    {
        $lookup = trim($lookup);
        $machine = $this->findAcu($lookup);

        if (! $machine) {
            return [
                'status' => 200,
                'body' => [
                    'valid' => false,
                    'message' => "ACU \"{$lookup}\" was not found.",
                ],
            ];
        }

        $existing = RepairRecord::query()
            ->where('machine_id', $machine->getAttribute('MACHINE_ID'))
            ->where('status', RepairRecord::STATUS_ONGOING)
            ->first(['ID']);

        if ($existing) {
            return [
                'status' => 200,
                'body' => [
                    'valid' => false,
                    'message' => "{$machine->getAttribute('MACHINE_ID')} already has an active repair record.",
                ],
            ];
        }

        return [
            'status' => 200,
            'body' => [
                'valid' => true,
                'acu' => $this->mapMachine($machine),
            ],
        ];
    }

    /**
     * @param  array<string, mixed>  $data
     * @return array{status: int, body: array<string, mixed>}
     */
    public function start(array $data): array
    {
        $machine = $this->findAcu($data['machine_qr'])
            ?? $this->findAcu($data['machine_id']);

        if (! $machine) {
            return ['status' => 422, 'body' => ['message' => 'ACU record was not found.']];
        }

        $existing = RepairRecord::query()
            ->where('machine_id', $machine->getAttribute('MACHINE_ID'))
            ->where('status', RepairRecord::STATUS_ONGOING)
            ->first(['ID']);

        if ($existing) {
            return [
                'status' => 422,
                'body' => ['message' => "{$machine->getAttribute('MACHINE_ID')} already has an active repair record."],
            ];
        }

        $now = now('Asia/Manila');
        $acu = $this->mapMachine($machine);
        $id = RepairRecord::query()->insertGetId([
            'machine_id' => $acu['machineId'],
            'machine_qr' => $acu['machineQr'],
            'source_alert_id' => $data['source_alert_id'] ?? null,
            'category_name' => $acu['categoryName'],
            'description' => $acu['description'],
            'location' => $acu['location'],
            'acu_status' => $acu['status'],
            'processed_by' => $data['processed_by'],
            'repair_reason' => null,
            'remarks' => null,
            'processed_at' => $now,
            'marked_done_at' => null,
            'marked_done_by' => null,
            'uploaded_at' => null,
            'uploaded_by' => null,
            'duration_seconds' => null,
            'status' => RepairRecord::STATUS_ONGOING,
        ]);

        return [
            'status' => 201,
            'body' => [
                'message' => 'Repair record created.',
                'data' => [
                    'id' => $id,
                    ...$acu,
                    'source_alert_id' => $data['source_alert_id'] ?? null,
                    'processed_by' => $data['processed_by'],
                    'processed_at' => $now->toISOString(),
                    'status' => RepairRecord::STATUS_ONGOING,
                ],
            ],
        ];
    }

    /**
     * @param  array<string, mixed>  $data
     * @return array{status: int, body: array<string, mixed>}
     */
    public function markDone(int $id, array $data, string $markedDoneBy): array
    {
        $record = RepairRecord::query()
            ->where('ID', $id)
            ->first(['ID', 'status', 'processed_at']);

        if (! $record) {
            return ['status' => 404, 'body' => ['message' => 'Repair record not found.']];
        }

        if ($record->getAttribute('status') !== RepairRecord::STATUS_ONGOING) {
            return [
                'status' => 422,
                'body' => ['message' => "Record is already {$record->getAttribute('status')} and cannot be marked done again."],
            ];
        }

        $markedDoneAt = now('Asia/Manila');
        $processedAt = new Carbon($record->getAttribute('processed_at'));
        $durationSeconds = (int) $processedAt->diffInSeconds($markedDoneAt);

        RepairRecord::query()
            ->where('ID', $id)
            ->update([
                'repair_reason' => $data['repair_reason'] ?? null,
                'remarks' => $data['remarks'] ?? null,
                'marked_done_at' => $markedDoneAt,
                'marked_done_by' => $markedDoneBy,
                'duration_seconds' => $durationSeconds,
            ]);

        return [
            'status' => 200,
            'body' => [
                'message' => 'Repair record marked as done.',
                'data' => [
                    'id' => $id,
                    'repair_reason' => $data['repair_reason'] ?? null,
                    'remarks' => $data['remarks'] ?? null,
                    'marked_done_at' => $markedDoneAt->toISOString(),
                    'marked_done_by' => $markedDoneBy,
                    'duration_seconds' => $durationSeconds,
                ],
            ],
        ];
    }

    /**
     * @param  int[]  $ids
     * @param  array<int, array<string, mixed>>  $drafts
     * @return array{status: int, body: array<string, mixed>}
     */
    public function upload(array $ids, array $drafts, string $uploadedBy): array
    {
        $draftsById = collect($drafts)->keyBy(fn (array $record): int => (int) $record['id']);
        $records = RepairRecord::query()
            ->whereIn('ID', $ids)
            ->get(['ID', 'status', 'marked_done_at']);

        $toUpdate = [];
        $skipped = [];

        foreach ($records as $record) {
            if (
                $record->getAttribute('status') === RepairRecord::STATUS_ONGOING
                && $record->getAttribute('marked_done_at') !== null
            ) {
                $toUpdate[] = (int) $record->getAttribute('ID');
                continue;
            }

            $skipped[] = (int) $record->getAttribute('ID');
        }

        $foundIds = $records->pluck('ID')->map(fn ($id): int => (int) $id)->all();
        $skipped = array_merge($skipped, array_values(array_diff($ids, $foundIds)));
        $now = now('Asia/Manila');

        foreach ($toUpdate as $recordId) {
            $draft = $draftsById->get($recordId);
            $values = [
                'status' => RepairRecord::STATUS_UPLOADED,
                'uploaded_at' => $now,
                'uploaded_by' => $uploadedBy,
            ];

            if ($draft !== null) {
                $values['repair_reason'] = $draft['repair_reason'] ?? null;
                $values['remarks'] = $draft['remarks'] ?? null;
            }

            RepairRecord::query()
                ->where('ID', $recordId)
                ->update($values);
        }

        return [
            'status' => 200,
            'body' => [
                'message' => $toUpdate === []
                    ? 'No records were updated.'
                    : count($toUpdate) . ' repair record(s) uploaded successfully.',
                'updated' => $toUpdate,
                'skipped' => $skipped,
                'errors' => [],
            ],
        ];
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    public function active(): array
    {
        return RepairRecord::query()
            ->where('status', RepairRecord::STATUS_ONGOING)
            ->orderBy('processed_at', 'asc')
            ->get(self::COLS_ACTIVE)
            ->map(fn (RepairRecord $record): array => $this->mapRepairRecord($record))
            ->values()
            ->all();
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    public function history(): array
    {
        return RepairRecord::query()
            ->where('status', RepairRecord::STATUS_UPLOADED)
            ->orderByDesc('uploaded_at')
            ->get(self::COLS_HISTORY)
            ->map(fn (RepairRecord $record): array => $this->mapRepairRecord($record))
            ->values()
            ->all();
    }

    private function findAcu(string $lookup): ?AcuQr
    {
        return AcuQr::query()
            ->acuOnly()
            ->where(function (Builder $query) use ($lookup): void {
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
    private function mapMachine(AcuQr $machine): array
    {
        return [
            'id' => $machine->getAttribute('ID'),
            'sourceAlertId' => null,
            'machineId' => $machine->getAttribute('MACHINE_ID'),
            'machineQr' => $machine->getAttribute('MACHINE_QR'),
            'categoryName' => $machine->getAttribute('CATEGORY_NAME'),
            'location' => $machine->getAttribute('LOCATION'),
            'description' => $machine->getAttribute('DESCRIPTION'),
            'status' => ((int) $machine->getAttribute('IS_ACTIVE')) === 1 ? 'Active' : 'Inactive',
            'operationalStatus' => $machine->getAttribute('STATUS'),
            'installedDate' => $machine->getAttribute('INSTALLED_DATE'),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function mapRepairRecord(RepairRecord $record): array
    {
        return [
            'id' => $record->getAttribute('ID'),
            'source_alert_id' => $record->getAttribute('source_alert_id'),
            'machine_id' => $record->getAttribute('machine_id'),
            'machine_qr' => $record->getAttribute('machine_qr'),
            'category_name' => $record->getAttribute('category_name'),
            'description' => $record->getAttribute('description'),
            'location' => $record->getAttribute('location'),
            'acu_status' => $record->getAttribute('acu_status'),
            'processed_by' => $record->getAttribute('processed_by'),
            'repair_reason' => $record->getAttribute('repair_reason'),
            'remarks' => $record->getAttribute('remarks'),
            'processed_at' => $record->getAttribute('processed_at'),
            'marked_done_at' => $record->getAttribute('marked_done_at'),
            'marked_done_by' => $record->getAttribute('marked_done_by'),
            'uploaded_at' => $record->getAttribute('uploaded_at'),
            'uploaded_by' => $record->getAttribute('uploaded_by'),
            'duration_seconds' => $record->getAttribute('duration_seconds'),
            'status' => $record->getAttribute('status'),
        ];
    }
}
