<?php

declare(strict_types=1);

namespace App\Services\TempHumid;

use App\Models\TempHumid\Sensor;
use App\Models\TempHumid\SensorReading;
use Illuminate\Support\Facades\DB;

class SensorService
{
    public function __construct(
        private readonly SensorLimitService $sensorLimitService,
    ) {}

    /**
     * @return array<int, array<string, mixed>>
     */
    public function registry(?string $floor): array
    {
        return Sensor::query()
            ->forFloor($floor)
            ->get()
            ->map(fn (Sensor $sensor): array => $this->formatSensor($sensor))
            ->values()
            ->all();
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    public function currentReadings(?string $floor): array
    {
        $sensors = Sensor::query()
            ->active()
            ->forFloor($floor)
            ->get();

        $areaIds = $sensors->pluck('Area ID')->map(fn ($areaId): string => (string) $areaId)->all();
        $latestLimits = $this->sensorLimitService->latestForAreaIds($areaIds);

        return $sensors
            ->map(fn (Sensor $sensor): array => $this->buildCurrentReading($sensor, $latestLimits))
            ->values()
            ->all();
    }

    /**
     * @return array{status: int, body: array<string, mixed>}
     */
    public function readingByAreaId(string $areaId, mixed $verifiedAfter = null): array
    {
        $sensor = Sensor::query()
            ->active()
            ->where('Area ID', $areaId)
            ->first();

        if (! $sensor) {
            return ['status' => 404, 'body' => ['message' => 'Sensor not found.']];
        }

        $query = SensorReading::query()
            ->where('Chip ID', $sensor->chipId())
            ->whereNotNull('Temperature')
            ->whereNotNull('Humidity');

        if (is_string($verifiedAfter) && trim($verifiedAfter) !== '') {
            $query->where('Day_Time', '>', $verifiedAfter);
        }

        $reading = $query->orderByDesc('Day_Time')->first();

        if (! $reading) {
            return [
                'status' => 200,
                'body' => [
                    'data' => [
                        'areaId' => $areaId,
                        'hasData' => false,
                        'status' => 'no-data',
                        'lastSeen' => null,
                    ],
                ],
            ];
        }

        $latestLimits = $this->sensorLimitService->latestForAreaIds([$areaId]);
        $data = $this->buildCurrentReading($sensor, $latestLimits, (object) $reading->getAttributes());

        return ['status' => 200, 'body' => ['data' => $data]];
    }

    /**
     * @return array<string, mixed>
     */
    public function summary(): array
    {
        $readings = $this->currentReadings(null);
        $temps = [];
        $humids = [];
        $breachCount = 0;

        foreach ($readings as $reading) {
            if (! $reading['hasData']) {
                continue;
            }

            $temps[] = $reading['temperature'];
            $humids[] = $reading['humidity'];

            if ($reading['status'] === 'breach') {
                $breachCount++;
            }
        }

        return [
            'avgTemperature' => $temps !== [] ? round(array_sum($temps) / count($temps), 1) : null,
            'avgHumidity' => $humids !== [] ? round(array_sum($humids) / count($humids), 1) : null,
            'activeSensorCount' => count($readings),
            'breachCount' => $breachCount,
        ];
    }

    /**
     * @param  array<string, object>  $latestLimits
     * @return array<string, mixed>
     */
    private function buildCurrentReading(Sensor $sensor, array $latestLimits, ?object $reading = null): array
    {
        $areaId = $sensor->areaId();
        $chipId = $sensor->chipId();
        $limit = $latestLimits[$areaId] ?? null;

        $tempUL = $limit ? $limit->Temp_Upper_Limit : $sensor->getAttribute('Temp_Upper_Limit');
        $tempLL = $limit ? $limit->Temp_Lower_Limit : $sensor->getAttribute('Temp_Lower_Limit');
        $humidUL = $limit ? $limit->Humid_Upper_Limit : $sensor->getAttribute('Humid_Upper_Limit');
        $humidLL = $limit ? $limit->Humid_Lower_Limit : $sensor->getAttribute('Humid_Lower_Limit');

        $base = [
            'areaId' => $areaId,
            'chipId' => $chipId,
            'lineName' => $sensor->lineName(),
            'plant' => $sensor->getAttribute('Plant'),
            'floor' => $sensor->getAttribute('Floor'),
            'location' => $sensor->getAttribute('Location'),
            'limits' => [
                'tempUL' => $tempUL,
                'tempLL' => $tempLL,
                'humidUL' => $humidUL,
                'humidLL' => $humidLL,
            ],
        ];

        $reading ??= $this->latestReadingForChipId($chipId);

        if (! $reading) {
            return array_merge($base, [
                'hasData' => false,
                'temperature' => null,
                'humidity' => null,
                'heatIndex' => null,
                'lastSeen' => null,
                'status' => 'no-data',
            ]);
        }

        $temp = (float) $reading->Temperature;
        $humid = (float) $reading->Humidity;
        $breached = $temp > (float) $tempUL
            || $temp < (float) $tempLL
            || $humid > (float) $humidUL
            || $humid < (float) $humidLL;

        return array_merge($base, [
            'hasData' => true,
            'temperature' => round($temp, 2),
            'humidity' => round($humid, 2),
            'heatIndex' => $reading->{'Heat Index'} !== null ? round((float) $reading->{'Heat Index'}, 2) : null,
            'lastSeen' => $reading->Day_Time,
            'status' => $breached ? 'breach' : 'ok',
        ]);
    }

    private function latestReadingForChipId(string $chipId): ?object
    {
        return DB::connection('temphumid')
            ->table('TempHumid_Calib_Log')
            ->where('Chip ID', $chipId)
            ->whereNotNull('Temperature')
            ->whereNotNull('Humidity')
            ->orderByDesc('Day_Time')
            ->first();
    }

    /**
     * @return array<string, mixed>
     */
    private function formatSensor(Sensor $sensor): array
    {
        return [
            'areaId' => $sensor->areaId(),
            'chipId' => $sensor->chipId(),
            'lineName' => $sensor->lineName(),
            'plant' => $sensor->getAttribute('Plant'),
            'floor' => $sensor->getAttribute('Floor'),
            'location' => $sensor->getAttribute('Location'),
            'listId' => $sensor->getAttribute('ListID'),
            'status' => $sensor->getAttribute('Status'),
            'ipAddress' => trim((string) ($sensor->getAttribute('IP_Address') ?? '')),
            'correctionTemp' => $sensor->getAttribute('Correction Temp') ?? 0,
            'correctionHumid' => $sensor->getAttribute('Correction Humid') ?? 0,
            'limits' => [
                'tempUL' => $sensor->getAttribute('Temp_Upper_Limit'),
                'tempLL' => $sensor->getAttribute('Temp_Lower_Limit'),
                'humidUL' => $sensor->getAttribute('Humid_Upper_Limit'),
                'humidLL' => $sensor->getAttribute('Humid_Lower_Limit'),
            ],
        ];
    }
}
