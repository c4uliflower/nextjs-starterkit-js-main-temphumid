<?php

declare(strict_types=1);

namespace App\Models\TempHumid;

use Illuminate\Database\Eloquent\Builder;

class Sensor extends TempHumidModel
{
    protected $table = 'Temp_Logger_Chip_ID';

    protected $primaryKey = 'Area ID';

    public $incrementing = false;

    protected $keyType = 'string';

    public const FLOOR_MAP = [
        'p1f1' => ['plant' => '1', 'floor' => '1'],
        'p1f2' => ['plant' => '1', 'floor' => '2'],
        'p2f1' => ['plant' => '2', 'floor' => '1'],
        'p2f2' => ['plant' => '2', 'floor' => '2', 'extra_area_ids' => ['P1F1-16']],
        'p12f2' => ['plant' => '1 & 2', 'floor' => '2'],
        'wh' => ['plant' => '2', 'floor' => '1', 'location_like' => 'P2F1WH'],
    ];

    public function scopeActive(Builder $query): Builder
    {
        return $query->where('Status', 'Active');
    }

    public function scopeForFloor(Builder $query, ?string $floor): Builder
    {
        if ($floor === null || trim($floor) === '') {
            return $query;
        }

        $map = self::FLOOR_MAP[strtolower(trim($floor))] ?? null;

        if ($map === null) {
            return $query;
        }

        return $query->where(function (Builder $outer) use ($map): void {
            $outer->where(function (Builder $base) use ($map): void {
                $base->where('Plant', $map['plant'])
                    ->where('Floor', $map['floor']);

                if (isset($map['location_like'])) {
                    $base->where('Location', 'like', '%' . $map['location_like'] . '%');
                }
            });

            if (! empty($map['extra_area_ids'])) {
                $outer->orWhereIn('Area ID', $map['extra_area_ids']);
            }
        });
    }

    public function areaId(): string
    {
        return (string) $this->getAttribute('Area ID');
    }

    public function chipId(): string
    {
        return (string) $this->getAttribute('Chip ID');
    }

    public function lineName(): string
    {
        return (string) $this->getAttribute('Line Name');
    }
}
