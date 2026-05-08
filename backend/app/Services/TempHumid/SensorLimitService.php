<?php

declare(strict_types=1);

namespace App\Services\TempHumid;

use App\Models\TempHumid\Sensor;
use App\Models\TempHumid\SensorLimitLog;
use Illuminate\Support\Facades\DB;

class SensorLimitService
{
    public function __construct(
        private readonly ActorName $actorName,
    ) {}

    /**
     * @param  string[]  $areaIds
     * @return array<string, object>
     */
    public function latestForAreaIds(array $areaIds): array
    {
        if ($areaIds === []) {
            return [];
        }

        $rows = SensorLimitLog::query()
            ->from('TempHumid_Limits_Log as ll')
            ->whereIn('ll.Area ID', $areaIds)
            ->where(function ($query): void {
                $query->whereNotExists(function ($sub): void {
                    $sub->from('TempHumid_Limits_Log as ll2')
                        ->whereColumn('ll2.Area ID', 'll.Area ID')
                        ->where(function ($inner): void {
                            $inner->where('ll2.changed_at', '>', DB::raw('ll.changed_at'))
                                ->orWhere(function ($tie): void {
                                    $tie->where('ll2.changed_at', '=', DB::raw('ll.changed_at'))
                                        ->where('ll2.ID', '>', DB::raw('ll.ID'));
                                });
                        });
                });
            })
            ->get(['Area ID', 'Temp_Upper_Limit', 'Temp_Lower_Limit', 'Humid_Upper_Limit', 'Humid_Lower_Limit']);

        $latest = [];
        foreach ($rows as $row) {
            $latest[(string) $row->getAttribute('Area ID')] = (object) $row->getAttributes();
        }

        return $latest;
    }

    public function latestForAreaId(string $areaId): ?object
    {
        $row = SensorLimitLog::query()
            ->where('Area ID', $areaId)
            ->orderByDesc('changed_at')
            ->orderByDesc('ID')
            ->first();

        return $row ? (object) $row->getAttributes() : null;
    }

    /**
     * @param  string[]  $areaIds
     * @return array<string, array<string, mixed>>
     */
    public function batchShow(array $areaIds): array
    {
        $sensors = Sensor::query()
            ->whereIn('Area ID', $areaIds)
            ->get(['Area ID', 'Line Name', 'Temp_Upper_Limit', 'Temp_Lower_Limit', 'Humid_Upper_Limit', 'Humid_Lower_Limit']);

        $latestLimits = $this->latestForAreaIds($areaIds);
        $data = [];

        foreach ($sensors as $sensor) {
            $areaId = (string) $sensor->getAttribute('Area ID');
            $limit = $latestLimits[$areaId] ?? null;

            $data[$areaId] = [
                'areaId' => $areaId,
                'tempUL' => $limit ? $limit->Temp_Upper_Limit : $sensor->getAttribute('Temp_Upper_Limit'),
                'tempLL' => $limit ? $limit->Temp_Lower_Limit : $sensor->getAttribute('Temp_Lower_Limit'),
                'humidUL' => $limit ? $limit->Humid_Upper_Limit : $sensor->getAttribute('Humid_Upper_Limit'),
                'humidLL' => $limit ? $limit->Humid_Lower_Limit : $sensor->getAttribute('Humid_Lower_Limit'),
            ];
        }

        return $data;
    }

    /**
     * @param  array{tempUL: mixed, tempLL: mixed, humidUL: mixed, humidLL: mixed}  $limits
     * @return array{ok: bool, message?: string, errors?: array<string, array<int, string>>}
     */
    public function validateLimitOrder(array $limits): array
    {
        if ((float) $limits['tempLL'] >= (float) $limits['tempUL']) {
            return [
                'ok' => false,
                'message' => 'Temperature lower limit must be less than upper limit.',
                'errors' => ['tempLL' => ['Must be less than upper limit.']],
            ];
        }

        if ((float) $limits['humidLL'] >= (float) $limits['humidUL']) {
            return [
                'ok' => false,
                'message' => 'Humidity lower limit must be less than upper limit.',
                'errors' => ['humidLL' => ['Must be less than upper limit.']],
            ];
        }

        return ['ok' => true];
    }

    /**
     * @param  array{tempUL: mixed, tempLL: mixed, humidUL: mixed, humidLL: mixed}  $limits
     * @return array{status: int, body: array<string, mixed>}
     */
    public function update(string $areaId, array $limits, string $changedBy): array
    {
        $validation = $this->validateLimitOrder($limits);

        if (! $validation['ok']) {
            return ['status' => 422, 'body' => $validation];
        }

        $sensor = Sensor::query()->where('Area ID', $areaId)->first();

        if (! $sensor) {
            return ['status' => 404, 'body' => ['message' => 'Sensor not found.']];
        }

        $current = $this->latestForAreaId($areaId);

        if ($current && ! $this->limitsChanged($limits, $current)) {
            return [
                'status' => 200,
                'body' => [
                    'message' => 'No changes detected.',
                    'data' => $this->formatLimitPayload($areaId, $limits),
                ],
            ];
        }

        SensorLimitLog::query()->insert([
            'Area ID' => $areaId,
            'Chip ID' => $sensor->getAttribute('Chip ID'),
            'Line Name' => $sensor->getAttribute('Line Name'),
            'Temp_Upper_Limit' => $limits['tempUL'],
            'Temp_Lower_Limit' => $limits['tempLL'],
            'Humid_Upper_Limit' => $limits['humidUL'],
            'Humid_Lower_Limit' => $limits['humidLL'],
            'changed_by' => $changedBy,
            'changed_at' => now('Asia/Manila'),
        ]);

        return [
            'status' => 200,
            'body' => [
                'message' => 'Limits updated successfully.',
                'data' => $this->formatLimitPayload($areaId, $limits),
            ],
        ];
    }

    /**
     * @param  array<int, array<string, mixed>>  $items
     * @return array{status: int, body: array<string, mixed>}
     */
    public function batchUpdate(array $items, string $changedBy): array
    {
        $errors = [];
        $updated = [];
        $skipped = [];

        foreach ($items as $item) {
            $areaId = (string) $item['areaId'];
            $validation = $this->validateLimitOrder($item);

            if (! $validation['ok']) {
                $errors[] = $areaId . ': ' . ($validation['message'] ?? 'Invalid limits.');
                continue;
            }

            $sensor = Sensor::query()->where('Area ID', $areaId)->first();

            if (! $sensor) {
                $errors[] = "{$areaId}: Sensor not found.";
                continue;
            }

            $current = $this->latestForAreaId($areaId);

            if ($current && ! $this->limitsChanged($item, $current)) {
                $skipped[] = $areaId;
                continue;
            }

            SensorLimitLog::query()->insert([
                'Area ID' => $areaId,
                'Chip ID' => $sensor->getAttribute('Chip ID'),
                'Line Name' => $sensor->getAttribute('Line Name'),
                'Temp_Upper_Limit' => $item['tempUL'],
                'Temp_Lower_Limit' => $item['tempLL'],
                'Humid_Upper_Limit' => $item['humidUL'],
                'Humid_Lower_Limit' => $item['humidLL'],
                'changed_by' => $changedBy,
                'changed_at' => now('Asia/Manila'),
            ]);

            $updated[] = $areaId;
        }

        if ($errors !== [] && $updated === []) {
            return ['status' => 422, 'body' => ['message' => 'All updates failed.', 'errors' => $errors]];
        }

        return [
            'status' => 200,
            'body' => [
                'message' => $errors === [] ? 'All limits updated.' : 'Some updates failed.',
                'updated' => $updated,
                'skipped' => $skipped,
                'errors' => $errors,
            ],
        ];
    }

    /**
     * @param  array<string, mixed>  $limits
     */
    private function limitsChanged(array $limits, object $current): bool
    {
        return (float) $limits['tempUL'] !== (float) $current->Temp_Upper_Limit
            || (float) $limits['tempLL'] !== (float) $current->Temp_Lower_Limit
            || (float) $limits['humidUL'] !== (float) $current->Humid_Upper_Limit
            || (float) $limits['humidLL'] !== (float) $current->Humid_Lower_Limit;
    }

    /**
     * @param  array<string, mixed>  $limits
     * @return array<string, mixed>
     */
    private function formatLimitPayload(string $areaId, array $limits): array
    {
        return [
            'areaId' => $areaId,
            'tempUL' => $limits['tempUL'],
            'tempLL' => $limits['tempLL'],
            'humidUL' => $limits['humidUL'],
            'humidLL' => $limits['humidLL'],
        ];
    }
}
