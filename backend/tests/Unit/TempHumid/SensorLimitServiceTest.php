<?php

use App\Services\TempHumid\ActorName;
use App\Services\TempHumid\SensorLimitService;

function sensorLimitService(): SensorLimitService
{
    return new SensorLimitService(new ActorName());
}

it('accepts valid temperature and humidity limit ranges', function (): void {
    $result = sensorLimitService()->validateLimitOrder([
        'tempLL' => 18,
        'tempUL' => 30,
        'humidLL' => 40,
        'humidUL' => 70,
    ]);

    expect($result)->toBe(['ok' => true]);
});

it('accepts valid numeric string limit ranges', function (): void {
    $result = sensorLimitService()->validateLimitOrder([
        'tempLL' => '18.5',
        'tempUL' => '30.25',
        'humidLL' => '40',
        'humidUL' => '70.75',
    ]);

    expect($result)->toBe(['ok' => true]);
});

it('rejects temperature lower limits that are greater than or equal to upper limits', function (): void {
    $result = sensorLimitService()->validateLimitOrder([
        'tempLL' => 30,
        'tempUL' => 30,
        'humidLL' => 40,
        'humidUL' => 70,
    ]);

    expect($result['ok'])->toBeFalse()
        ->and($result['message'])->toBe('Temperature lower limit must be less than upper limit.')
        ->and($result['errors'])->toHaveKey('tempLL');
});

it('rejects humidity lower limits that are greater than or equal to upper limits', function (): void {
    $result = sensorLimitService()->validateLimitOrder([
        'tempLL' => 18,
        'tempUL' => 30,
        'humidLL' => 70,
        'humidUL' => 70,
    ]);

    expect($result['ok'])->toBeFalse()
        ->and($result['message'])->toBe('Humidity lower limit must be less than upper limit.')
        ->and($result['errors'])->toHaveKey('humidLL');
});

it('reports temperature errors first when both ranges are invalid', function (): void {
    $result = sensorLimitService()->validateLimitOrder([
        'tempLL' => 31,
        'tempUL' => 30,
        'humidLL' => 71,
        'humidUL' => 70,
    ]);

    expect($result['ok'])->toBeFalse()
        ->and($result['errors'])->toHaveKey('tempLL')
        ->and($result['errors'])->not->toHaveKey('humidLL');
});
