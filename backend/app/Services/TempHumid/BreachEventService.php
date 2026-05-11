<?php

declare(strict_types=1);

namespace App\Services\TempHumid;

use App\Models\TempHumid\BreachEvent;
use Carbon\Carbon;

class BreachEventService
{
    /**
     * @return array{data: array<int, array<string, mixed>>, meta: array<string, mixed>}
     */
    public function paginatedForAlert(int $alertId, int $page = 1, int $perPage = 10): array
    {
        $page = max(1, $page);
        $total = BreachEvent::query()
            ->where('alert_id', $alertId)
            ->count();

        $lastPage = max(1, (int) ceil($total / $perPage));
        $page = min($page, $lastPage);

        $rows = BreachEvent::query()
            ->where('alert_id', $alertId)
            ->orderBy('reading_at', 'desc')
            ->orderBy('ID', 'desc')
            ->offset(($page - 1) * $perPage)
            ->limit($perPage)
            ->get();

        return [
            'data' => $rows->map(fn (BreachEvent $row): array => $this->format($row))->values()->all(),
            'meta' => [
                'currentPage' => $page,
                'perPage' => $perPage,
                'total' => $total,
                'lastPage' => $lastPage,
                'hasMore' => $page < $lastPage,
            ],
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function format(BreachEvent $row): array
    {
        $readingAt = $row->getAttribute('reading_at');
        $readingAtUtc = $readingAt
            ? Carbon::parse(preg_replace('/(\.\d{6})\d+/', '$1', (string) $readingAt))->toIso8601String()
            : null;

        return [
            'readingAt' => $readingAtUtc,
            'temperature' => round((float) $row->getAttribute('temperature'), 2),
            'humidity' => round((float) $row->getAttribute('humidity'), 2),
            'limits' => [
                'tempUL' => $row->getAttribute('Temp_Upper_Limit'),
                'tempLL' => $row->getAttribute('Temp_Lower_Limit'),
                'humidUL' => $row->getAttribute('Humid_Upper_Limit'),
                'humidLL' => $row->getAttribute('Humid_Lower_Limit'),
            ],
            'breached' => [
                'temp' => (int) $row->getAttribute('breached_temp') === 1,
                'humid' => (int) $row->getAttribute('breached_humid') === 1,
            ],
        ];
    }
}
