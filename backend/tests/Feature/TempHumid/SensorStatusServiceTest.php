<?php

use App\Services\TempHumid\SensorStatusService;
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
        $table->string('Status')->default('Active');
    });

    Schema::connection('temphumid')->create('TempHumid_Status_Log', function (Blueprint $table): void {
        $table->increments('ID');
        $table->string('Area ID');
        $table->string('Chip ID')->nullable();
        $table->string('Line Name')->nullable();
        $table->string('Status');
        $table->string('changed_by')->nullable();
        $table->dateTime('changed_at');
    });
});

it('lists sensors with their latest logged status', function (): void {
    insertStatusSensor([
        'Area ID' => 'P1F1-01',
        'Chip ID' => '0xAAA',
        'Line Name' => 'Dipping',
        'Status' => 'Active',
    ]);

    insertStatusLog('P1F1-01', '0xAAA', 'Dipping', 'Inactive', '2026-05-13 08:00:00');
    insertStatusLog('P1F1-01', '0xAAA', 'Dipping', 'Active', '2026-05-13 09:00:00');

    $statuses = app(SensorStatusService::class)->list('p1f1');

    expect($statuses)->toHaveCount(1)
        ->and($statuses[0]['areaId'])->toBe('P1F1-01')
        ->and($statuses[0]['status'])->toBe('Active');
});

it('uses the highest id when status logs have the same changed time', function (): void {
    insertStatusSensor([
        'Area ID' => 'P1F1-02',
        'Chip ID' => '0xBBB',
        'Line Name' => 'SMT',
        'Status' => 'Active',
    ]);

    insertStatusLog('P1F1-02', '0xBBB', 'SMT', 'Inactive', '2026-05-13 08:00:00');
    insertStatusLog('P1F1-02', '0xBBB', 'SMT', 'Active', '2026-05-13 08:00:00');

    $latest = app(SensorStatusService::class)->latestForAreaIds(['P1F1-02']);

    expect($latest['P1F1-02']->Status)->toBe('Active');
});

it('falls back to the sensor master status when no status log exists', function (): void {
    insertStatusSensor([
        'Area ID' => 'P1F1-03',
        'Chip ID' => '0xCCC',
        'Line Name' => 'Server Room',
        'Status' => 'Inactive',
    ]);

    $statuses = app(SensorStatusService::class)->list('p1f1');

    expect($statuses)->toHaveCount(1)
        ->and($statuses[0]['status'])->toBe('Inactive');
});

it('batch-updates statuses and skips unchanged latest statuses', function (): void {
    insertStatusSensor([
        'Area ID' => 'P1F1-04',
        'Chip ID' => '0xDDD',
        'Line Name' => 'AOI',
        'Status' => 'Active',
    ]);
    insertStatusLog('P1F1-04', '0xDDD', 'AOI', 'Inactive', '2026-05-13 08:00:00');

    $service = app(SensorStatusService::class);

    $skipped = $service->batchUpdate([
        ['areaId' => 'P1F1-04', 'status' => 'Inactive'],
    ], 'Tester');
    $updated = $service->batchUpdate([
        ['areaId' => 'P1F1-04', 'status' => 'Active'],
    ], 'Tester');

    expect($skipped['status'])->toBe(200)
        ->and($skipped['body']['skipped'])->toBe(['P1F1-04'])
        ->and($updated['status'])->toBe(200)
        ->and($updated['body']['updated'])->toBe(['P1F1-04'])
        ->and(DB::connection('temphumid')->table('TempHumid_Status_Log')->count())->toBe(2);
});

function insertStatusSensor(array $overrides): void
{
    DB::connection('temphumid')->table('Temp_Logger_Chip_ID')->insert(array_merge([
        'Plant' => '1',
        'Floor' => '1',
        'Status' => 'Active',
    ], $overrides));
}

function insertStatusLog(
    string $areaId,
    string $chipId,
    string $lineName,
    string $status,
    string $changedAt,
): void {
    DB::connection('temphumid')->table('TempHumid_Status_Log')->insert([
        'Area ID' => $areaId,
        'Chip ID' => $chipId,
        'Line Name' => $lineName,
        'Status' => $status,
        'changed_by' => 'Tester',
        'changed_at' => $changedAt,
    ]);
}
