<?php

declare(strict_types=1);

namespace App\Services\TempHumid;

use App\Models\TempHumid\DowntimeRecord;
use App\Models\TempHumid\FacilitiesAlert;
use App\Models\TempHumid\Sensor;
use App\Models\TempHumid\SensorReading;
use Carbon\Carbon;

class DowntimeService
{
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

    /**
     * @return array{status: int, body: array<string, mixed>}
     */
    public function validateSensor(string $lineName): array
    {
        $lineName = trim($lineName);
        $sensor = Sensor::query()
            ->where('Line Name', $lineName)
            ->first();

        if (! $sensor) {
            return [
                'status' => 200,
                'body' => [
                    'valid' => false,
                    'message' => "Sensor \"{$lineName}\" was not found.",
                ],
            ];
        }

        if ($sensor->getAttribute('Status') !== 'Active') {
            return [
                'status' => 200,
                'body' => [
                    'valid' => false,
                    'message' => "{$sensor->lineName()} is currently inactive.",
                ],
            ];
        }

        $existing = DowntimeRecord::query()
            ->where('Area ID', $sensor->areaId())
            ->where('status', DowntimeRecord::STATUS_ONGOING)
            ->first(['ID']);

        if ($existing) {
            return [
                'status' => 200,
                'body' => [
                    'valid' => false,
                    'message' => "{$sensor->lineName()} already has an active downtime record. Mark it as done before starting a new one.",
                ],
            ];
        }

        $facilitiesAlert = FacilitiesAlert::query()
            ->where('Area ID', $sensor->areaId())
            ->where('notif_status', 'open')
            ->whereIn('action_type', ['maintenance', 'repair'])
            ->first();

        return [
            'status' => 200,
            'body' => [
                'valid' => true,
                'sensor' => [
                    'areaId' => $sensor->areaId(),
                    'lineName' => $sensor->lineName(),
                    'plant' => 'P' . $sensor->getAttribute('Plant'),
                    'floor' => 'F' . $sensor->getAttribute('Floor'),
                    'status' => $this->resolveSensorStatus($sensor),
                    'sourceAlertId' => $facilitiesAlert?->getAttribute('ID'),
                ],
            ],
        ];
    }

    /**
     * @param  array<string, mixed>  $data
     * @return array{status: int, body: array<string, mixed>}
     */
    public function start(array $data): array
    {
        $existing = DowntimeRecord::query()
            ->where('Area ID', $data['area_id'])
            ->where('status', DowntimeRecord::STATUS_ONGOING)
            ->first(['ID']);

        if ($existing) {
            return [
                'status' => 422,
                'body' => ['message' => "{$data['line_name']} already has an active downtime record."],
            ];
        }

        $now = now('Asia/Manila');
        $id = DowntimeRecord::query()->insertGetId([
            'Area ID' => $data['area_id'],
            'Line Name' => $data['line_name'],
            'processed_by' => $data['processed_by'],
            'source_alert_id' => $data['source_alert_id'] ?? null,
            'symptom' => $data['symptom'],
            'maintenance_reason' => null,
            'remarks' => null,
            'processed_at' => $now,
            'marked_done_at' => null,
            'marked_done_by' => null,
            'uploaded_at' => null,
            'uploaded_by' => null,
            'duration_seconds' => null,
            'status' => DowntimeRecord::STATUS_ONGOING,
        ]);

        return [
            'status' => 201,
            'body' => [
                'message' => 'Downtime record created.',
                'data' => [
                    'id' => $id,
                    'area_id' => $data['area_id'],
                    'line_name' => $data['line_name'],
                    'processed_by' => $data['processed_by'],
                    'symptom' => $data['symptom'],
                    'processed_at' => $now->toISOString(),
                    'status' => DowntimeRecord::STATUS_ONGOING,
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
        $record = DowntimeRecord::query()
            ->where('ID', $id)
            ->first(['ID', 'status', 'processed_at', 'symptom']);

        if (! $record) {
            return ['status' => 404, 'body' => ['message' => 'Downtime record not found.']];
        }

        if ($record->getAttribute('status') !== DowntimeRecord::STATUS_ONGOING) {
            return [
                'status' => 422,
                'body' => ['message' => "Record is already {$record->getAttribute('status')} and cannot be marked done again."],
            ];
        }

        $markedDoneAt = now('Asia/Manila');
        $processedAt = new Carbon($record->getAttribute('processed_at'));
        $durationSeconds = (int) $processedAt->diffInSeconds($markedDoneAt);

        DowntimeRecord::query()
            ->where('ID', $id)
            ->update([
                'maintenance_reason' => $data['maintenance_reason'] ?? null,
                'remarks' => $data['remarks'] ?? null,
                'marked_done_at' => $markedDoneAt,
                'marked_done_by' => $markedDoneBy,
                'duration_seconds' => $durationSeconds,
            ]);

        return [
            'status' => 200,
            'body' => [
                'message' => 'Downtime record marked as done.',
                'data' => [
                    'id' => $id,
                    'symptom' => $record->getAttribute('symptom'),
                    'maintenance_reason' => $data['maintenance_reason'] ?? null,
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
        $records = DowntimeRecord::query()
            ->whereIn('ID', $ids)
            ->get(['ID', 'status', 'marked_done_at']);

        $toUpdate = [];
        $skipped = [];

        foreach ($records as $record) {
            if (
                $record->getAttribute('status') === DowntimeRecord::STATUS_ONGOING
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
                'status' => DowntimeRecord::STATUS_UPLOADED,
                'uploaded_at' => $now,
                'uploaded_by' => $uploadedBy,
            ];

            if ($draft !== null) {
                $values['maintenance_reason'] = $draft['maintenance_reason'] ?? null;
                $values['remarks'] = $draft['remarks'] ?? null;
            }

            DowntimeRecord::query()
                ->where('ID', $recordId)
                ->update($values);
        }

        return [
            'status' => 200,
            'body' => [
                'message' => $toUpdate === []
                    ? 'No records were updated.'
                    : count($toUpdate) . ' record(s) uploaded successfully.',
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
        return DowntimeRecord::query()
            ->where('status', DowntimeRecord::STATUS_ONGOING)
            ->orderBy('processed_at', 'asc')
            ->get(self::COLS_ACTIVE)
            ->map(fn (DowntimeRecord $record): array => $this->mapRecord($record))
            ->values()
            ->all();
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    public function history(): array
    {
        return DowntimeRecord::query()
            ->where('status', DowntimeRecord::STATUS_UPLOADED)
            ->orderByDesc('uploaded_at')
            ->get(self::COLS_HISTORY)
            ->map(fn (DowntimeRecord $record): array => $this->mapRecord($record))
            ->values()
            ->all();
    }

    private function resolveSensorStatus(Sensor $sensor): string
    {
        $latestReading = SensorReading::query()
            ->where('Chip ID', $sensor->chipId())
            ->whereNotNull('Temperature')
            ->whereNotNull('Humidity')
            ->orderByDesc('Day_Time')
            ->first(['Day_Time', 'Temperature', 'Humidity']);

        if (! $latestReading) {
            return 'no_data';
        }

        $readingTime = Carbon::parse($latestReading->getAttribute('Day_Time'), 'Asia/Manila');
        if ($readingTime->diffInMinutes(now('Asia/Manila')) >= self::STALE_THRESHOLD_MINUTES) {
            return 'no_data';
        }

        $temp = (float) $latestReading->getAttribute('Temperature');
        $humid = (float) $latestReading->getAttribute('Humidity');

        $breached = $temp > (float) $sensor->getAttribute('Temp_Upper_Limit')
            || $temp < (float) $sensor->getAttribute('Temp_Lower_Limit')
            || $humid > (float) $sensor->getAttribute('Humid_Upper_Limit')
            || $humid < (float) $sensor->getAttribute('Humid_Lower_Limit');

        return $breached ? 'breach' : 'stable';
    }

    /**
     * @return array<string, mixed>
     */
    private function mapRecord(DowntimeRecord $record): array
    {
        return [
            'id' => $record->getAttribute('ID'),
            'area_id' => $record->getAttribute('Area ID'),
            'line_name' => $record->getAttribute('Line Name'),
            'processed_by' => $record->getAttribute('processed_by'),
            'symptom' => $record->getAttribute('symptom'),
            'maintenance_reason' => $record->getAttribute('maintenance_reason'),
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
