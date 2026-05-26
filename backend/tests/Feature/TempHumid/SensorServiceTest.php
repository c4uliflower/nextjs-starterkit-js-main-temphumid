<?php

use App\Services\TempHumid\SensorService;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

beforeEach(function (): void {
    Config::set('database.connections.temphumid', [
        'driver' => 'sqlite',
        'database' => ':memory:',
        'prefix' => '',
        'foreign_key_constraints' => false,
    ]);
    Config::set('database.default', 'temphumid');

    DB::purge('temphumid');
    DB::connection('temphumid')->getPdo();

    Schema::connection('temphumid')->create('Temp_Logger_Chip_ID', function (Blueprint $table): void {
        $table->string('Area ID')->primary();
        $table->string('Chip ID');
        $table->string('Line Name');
        $table->string('Plant')->nullable();
        $table->string('Floor')->nullable();
        $table->string('Location')->nullable();
        $table->integer('ListID')->nullable();
        $table->string('Status')->default('Active');
        $table->string('IP_Address')->nullable();
        $table->decimal('Correction Temp', 8, 2)->nullable();
        $table->decimal('Correction Humid', 8, 2)->nullable();
        $table->decimal('Temp_Upper_Limit', 8, 2);
        $table->decimal('Temp_Lower_Limit', 8, 2);
        $table->decimal('Humid_Upper_Limit', 8, 2);
        $table->decimal('Humid_Lower_Limit', 8, 2);
    });

    Schema::connection('temphumid')->create('TempHumid_Calib_Log', function (Blueprint $table): void {
        $table->increments('ID');
        $table->string('Chip ID');
        $table->dateTime('Day_Time');
        $table->decimal('Temperature', 8, 2)->nullable();
        $table->decimal('Humidity', 8, 2)->nullable();
        $table->decimal('Heat Index', 8, 2)->nullable();
    });

    Schema::connection('temphumid')->create('TempHumid_Limits_Log', function (Blueprint $table): void {
        $table->increments('ID');
        $table->string('Area ID');
        $table->string('Chip ID')->nullable();
        $table->string('Line Name')->nullable();
        $table->decimal('Temp_Upper_Limit', 8, 2);
        $table->decimal('Temp_Lower_Limit', 8, 2);
        $table->decimal('Humid_Upper_Limit', 8, 2);
        $table->decimal('Humid_Lower_Limit', 8, 2);
        $table->dateTime('changed_at');
        $table->string('changed_by')->nullable();
    });
});

it('returns the latest current reading and marks it stable when it is within limits', function (): void {
    insertSensor([
        'Area ID' => 'P1F1-01',
        'Chip ID' => '0xAAA',
        'Line Name' => 'Dipping',
        'Temp_Upper_Limit' => 30,
        'Temp_Lower_Limit' => 18,
        'Humid_Upper_Limit' => 70,
        'Humid_Lower_Limit' => 40,
    ]);

    insertReading('0xAAA', '2026-05-13 08:00:00', 35, 80);
    insertReading('0xAAA', '2026-05-13 09:00:00', 25.456, 55.444);

    $readings = app(SensorService::class)->currentReadings('p1f1');

    expect($readings)->toHaveCount(1)
        ->and($readings[0]['areaId'])->toBe('P1F1-01')
        ->and($readings[0]['hasData'])->toBeTrue()
        ->and($readings[0]['temperature'])->toBe(25.46)
        ->and($readings[0]['humidity'])->toBe(55.44)
        ->and($readings[0]['status'])->toBe('ok')
        ->and($readings[0]['lastSeen'])->toBe('2026-05-13 09:00:00');
});

it('uses the latest logged limits when deciding if a current reading is breached', function (): void {
    insertSensor([
        'Area ID' => 'P1F1-02',
        'Chip ID' => '0xBBB',
        'Line Name' => 'SMT',
        'Temp_Upper_Limit' => 30,
        'Temp_Lower_Limit' => 18,
        'Humid_Upper_Limit' => 70,
        'Humid_Lower_Limit' => 40,
    ]);

    DB::connection('temphumid')->table('TempHumid_Limits_Log')->insert([
        'Area ID' => 'P1F1-02',
        'Chip ID' => '0xBBB',
        'Line Name' => 'SMT',
        'Temp_Upper_Limit' => 24,
        'Temp_Lower_Limit' => 18,
        'Humid_Upper_Limit' => 60,
        'Humid_Lower_Limit' => 40,
        'changed_at' => '2026-05-13 07:00:00',
        'changed_by' => 'Tester',
    ]);

    insertReading('0xBBB', '2026-05-13 09:00:00', 25, 55);

    $readings = app(SensorService::class)->currentReadings('p1f1');

    expect($readings)->toHaveCount(1)
        ->and($readings[0]['status'])->toBe('breach')
        ->and($readings[0]['limits'])->toMatchArray([
            'tempUL' => 24,
            'tempLL' => 18,
            'humidUL' => 60,
            'humidLL' => 40,
        ]);
});

it('returns no-data for active sensors that have no valid readings', function (): void {
    insertSensor([
        'Area ID' => 'P1F1-03',
        'Chip ID' => '0xCCC',
        'Line Name' => 'Server Room',
        'Temp_Upper_Limit' => 30,
        'Temp_Lower_Limit' => 18,
        'Humid_Upper_Limit' => 70,
        'Humid_Lower_Limit' => 40,
    ]);

    $readings = app(SensorService::class)->currentReadings('p1f1');

    expect($readings)->toHaveCount(1)
        ->and($readings[0]['areaId'])->toBe('P1F1-03')
        ->and($readings[0]['hasData'])->toBeFalse()
        ->and($readings[0]['temperature'])->toBeNull()
        ->and($readings[0]['humidity'])->toBeNull()
        ->and($readings[0]['status'])->toBe('no-data');
});

it('excludes inactive sensors from current readings', function (): void {
    insertSensor([
        'Area ID' => 'P1F1-04',
        'Chip ID' => '0xDDD',
        'Line Name' => 'AOI',
        'Status' => 'Inactive',
        'Temp_Upper_Limit' => 30,
        'Temp_Lower_Limit' => 18,
        'Humid_Upper_Limit' => 70,
        'Humid_Lower_Limit' => 40,
    ]);

    insertReading('0xDDD', '2026-05-13 09:00:00', 40, 80);

    expect(app(SensorService::class)->currentReadings('p1f1'))->toBe([]);
});

it('filters current readings by floor', function (): void {
    insertSensor([
        'Area ID' => 'P1F1-05',
        'Chip ID' => '0xEEE',
        'Line Name' => 'SMT MH',
        'Temp_Upper_Limit' => 30,
        'Temp_Lower_Limit' => 18,
        'Humid_Upper_Limit' => 70,
        'Humid_Lower_Limit' => 40,
    ]);
    insertSensor([
        'Area ID' => 'P2F1-03',
        'Chip ID' => '0xFFF',
        'Line Name' => 'FG',
        'Plant' => '2',
        'Floor' => '1',
        'Location' => 'P2F1',
        'Temp_Upper_Limit' => 30,
        'Temp_Lower_Limit' => 18,
        'Humid_Upper_Limit' => 70,
        'Humid_Lower_Limit' => 40,
    ]);

    insertReading('0xEEE', '2026-05-13 09:00:00', 25, 55);
    insertReading('0xFFF', '2026-05-13 09:00:00', 25, 55);

    $readings = app(SensorService::class)->currentReadings('p2f1');

    expect($readings)->toHaveCount(1)
        ->and($readings[0]['areaId'])->toBe('P2F1-03');
});

it('fetches latest current readings in a bounded number of queries', function (): void {
    foreach (range(1, 3) as $index) {
        $areaId = sprintf('P1F1-%02d', $index + 10);
        $chipId = "0xBULK{$index}";

        insertSensor([
            'Area ID' => $areaId,
            'Chip ID' => $chipId,
            'Line Name' => "Bulk {$index}",
            'Temp_Upper_Limit' => 30,
            'Temp_Lower_Limit' => 18,
            'Humid_Upper_Limit' => 70,
            'Humid_Lower_Limit' => 40,
        ]);
        insertReading($chipId, '2026-05-13 08:00:00', 35, 80);
        insertReading($chipId, '2026-05-13 09:00:00', 25, 55);
    }

    DB::flushQueryLog();
    DB::enableQueryLog();

    $readings = app(SensorService::class)->currentReadings('p1f1');

    expect($readings)->toHaveCount(3)
        ->and(DB::getQueryLog())->toHaveCount(3);

    DB::disableQueryLog();
});

function insertSensor(array $overrides): void
{
    DB::connection('temphumid')->table('Temp_Logger_Chip_ID')->insert(array_merge([
        'Plant' => '1',
        'Floor' => '1',
        'Location' => 'P1F1',
        'ListID' => null,
        'Status' => 'Active',
        'IP_Address' => null,
        'Correction Temp' => 0,
        'Correction Humid' => 0,
    ], $overrides));
}

function insertReading(string $chipId, string $dayTime, float $temperature, float $humidity): void
{
    DB::connection('temphumid')->table('TempHumid_Calib_Log')->insert([
        'Chip ID' => $chipId,
        'Day_Time' => $dayTime,
        'Temperature' => $temperature,
        'Humidity' => $humidity,
        'Heat Index' => null,
    ]);
}
