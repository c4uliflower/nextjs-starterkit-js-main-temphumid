<?php

declare(strict_types=1);

namespace App\Services\TempHumid;

use App\Models\TempHumid\Sensor;
use App\Models\TempHumid\SensorStatusLog;
use Illuminate\Support\Facades\DB;

class SensorStatusService
{
    /**
     * @return array<int, array<string, mixed>>
     */
    public function list(?string $floor): array
    {
        $sensors = Sensor::query()
            ->forFloor($floor)
            ->get(['Area ID', 'Chip ID', 'Line Name', 'Plant', 'Floor', 'Status']);

        $latestStatuses = $this->latestForAreaIds(
            $sensors->pluck('Area ID')->map(fn ($areaId): string => (string) $areaId)->all()
        );

        return $sensors
            ->map(function (Sensor $sensor) use ($latestStatuses): array {
                $areaId = $sensor->areaId();
                $status = $latestStatuses[$areaId] ?? null;

                return [
                    'areaId' => $areaId,
                    'chipId' => $sensor->chipId(),
                    'lineName' => $sensor->lineName(),
                    'plant' => $sensor->getAttribute('Plant'),
                    'floor' => $sensor->getAttribute('Floor'),
                    'status' => $status ? $status->Status : $sensor->getAttribute('Status'),
                ];
            })
            ->values()
            ->all();
    }

    /**
     * @param  string[]  $areaIds
     * @return array<string, object>
     */
    public function latestForAreaIds(array $areaIds): array
    {
        if ($areaIds === []) {
            return [];
        }

        $rows = SensorStatusLog::query()
            ->from('TempHumid_Status_Log as sl')
            ->whereIn('sl.Area ID', $areaIds)
            ->where(function ($query): void {
                $query->whereNotExists(function ($sub): void {
                    $sub->from('TempHumid_Status_Log as sl2')
                        ->whereColumn('sl2.Area ID', 'sl.Area ID')
                        ->where(function ($inner): void {
                            $inner->where('sl2.changed_at', '>', DB::raw('sl.changed_at'))
                                ->orWhere(function ($tie): void {
                                    $tie->where('sl2.changed_at', '=', DB::raw('sl.changed_at'))
                                        ->where('sl2.ID', '>', DB::raw('sl.ID'));
                                });
                        });
                });
            })
            ->get(['Area ID', 'Status']);

        $latest = [];
        foreach ($rows as $row) {
            $latest[(string) $row->getAttribute('Area ID')] = (object) $row->getAttributes();
        }

        return $latest;
    }

    /**
     * @param  array<int, array{areaId: string, status: string}>  $items
     * @return array{status: int, body: array<string, mixed>}
     */
    public function batchUpdate(array $items, string $changedBy): array
    {
        $errors = [];
        $updated = [];
        $skipped = [];

        foreach ($items as $item) {
            $areaId = (string) $item['areaId'];
            $sensor = Sensor::query()->where('Area ID', $areaId)->first();

            if (! $sensor) {
                $errors[] = "{$areaId}: Sensor not found.";
                continue;
            }

            $current = SensorStatusLog::query()
                ->where('Area ID', $areaId)
                ->orderByDesc('changed_at')
                ->orderByDesc('ID')
                ->first();

            if ($current && $current->getAttribute('Status') === $item['status']) {
                $skipped[] = $areaId;
                continue;
            }

            SensorStatusLog::query()->insert([
                'Area ID' => $areaId,
                'Chip ID' => $sensor->getAttribute('Chip ID'),
                'Line Name' => $sensor->getAttribute('Line Name'),
                'Status' => $item['status'],
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
                'message' => $errors === [] ? 'All statuses updated.' : 'Some updates failed.',
                'updated' => $updated,
                'skipped' => $skipped,
                'errors' => $errors,
            ],
        ];
    }
}
