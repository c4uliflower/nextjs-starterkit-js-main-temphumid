<?php

use App\Models\User;
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

    Schema::connection('temphumid')->create('TempHumid_Status_Log', function (Blueprint $table): void {
        $table->increments('ID');
        $table->string('Area ID');
        $table->string('Chip ID')->nullable();
        $table->string('Line Name')->nullable();
        $table->string('Status');
        $table->string('changed_by')->nullable();
        $table->dateTime('changed_at');
    });

    Schema::connection('temphumid')->create('TempHumid_Facilities_Alert_Log', function (Blueprint $table): void {
        $table->increments('ID');
        $table->string('Area ID');
        $table->string('Line Name');
        $table->decimal('Temperature', 8, 2)->nullable();
        $table->decimal('Humidity', 8, 2)->nullable();
        $table->decimal('Temp_Upper_Limit', 8, 2)->nullable();
        $table->decimal('Temp_Lower_Limit', 8, 2)->nullable();
        $table->decimal('Humid_Upper_Limit', 8, 2)->nullable();
        $table->decimal('Humid_Lower_Limit', 8, 2)->nullable();
        $table->string('acknowledged_by')->nullable();
        $table->dateTime('acknowledged_at')->nullable();
        $table->string('notif_status')->default('acknowledged');
        $table->dateTime('escalated_at')->nullable();
        $table->integer('escalation_count')->default(0);
        $table->string('opened_by')->nullable();
        $table->dateTime('opened_at')->nullable();
        $table->string('action_type')->nullable();
        $table->dateTime('maintenance_queued_at')->nullable();
        $table->text('action_remarks')->nullable();
        $table->string('verified_by')->nullable();
        $table->dateTime('verified_at')->nullable();
        $table->string('resolved_by')->nullable();
        $table->dateTime('resolved_at')->nullable();
        $table->boolean('can_notify_again')->default(false);
        $table->dateTime('verify_baseline_read_at')->nullable();
        $table->integer('verify_attempt_count')->default(0);
    });
});

it('returns readings, statuses, and active facilities alerts in one snapshot', function (): void {
    monitoringSnapshotInsertSensor();

    DB::connection('temphumid')->table('TempHumid_Calib_Log')->insert([
        'Chip ID' => '0xAAA',
        'Day_Time' => '2026-05-13 09:00:00',
        'Temperature' => 25,
        'Humidity' => 55,
        'Heat Index' => null,
    ]);

    DB::connection('temphumid')->table('TempHumid_Status_Log')->insert([
        'Area ID' => 'P1F1-01',
        'Chip ID' => '0xAAA',
        'Line Name' => 'Dipping',
        'Status' => 'Paused',
        'changed_by' => 'Tester',
        'changed_at' => '2026-05-13 08:00:00',
    ]);

    DB::connection('temphumid')->table('TempHumid_Facilities_Alert_Log')->insert([
        'Area ID' => 'P1F1-01',
        'Line Name' => 'Dipping',
        'Temperature' => 35,
        'Humidity' => 80,
        'Temp_Upper_Limit' => 30,
        'Temp_Lower_Limit' => 18,
        'Humid_Upper_Limit' => 70,
        'Humid_Lower_Limit' => 40,
        'acknowledged_by' => 'Jane Dela Cruz (EMP-001)',
        'acknowledged_at' => '2026-05-13 09:05:00',
        'notif_status' => 'acknowledged',
        'escalated_at' => null,
        'escalation_count' => 0,
        'opened_by' => null,
        'opened_at' => null,
        'action_type' => null,
        'maintenance_queued_at' => null,
        'action_remarks' => null,
        'verified_by' => null,
        'verified_at' => null,
        'resolved_by' => null,
        'resolved_at' => null,
        'can_notify_again' => 0,
        'verify_baseline_read_at' => null,
        'verify_attempt_count' => 0,
    ]);

    $this->actingAs(monitoringSnapshotUser(), 'mat-auth')
        ->getJson('/api/temphumid/monitoring/snapshot')
        ->assertOk()
        ->assertJsonPath('data.readings.0.areaId', 'P1F1-01')
        ->assertJsonPath('data.readings.0.status', 'ok')
        ->assertJsonPath('data.sensorStatuses.0.areaId', 'P1F1-01')
        ->assertJsonPath('data.sensorStatuses.0.status', 'Paused')
        ->assertJsonPath('data.facilitiesAlerts.0.areaId', 'P1F1-01')
        ->assertJsonPath('data.facilitiesAlerts.0.status', 'acknowledged');
});

function monitoringSnapshotInsertSensor(): void
{
    DB::connection('temphumid')->table('Temp_Logger_Chip_ID')->insert([
        'Area ID' => 'P1F1-01',
        'Chip ID' => '0xAAA',
        'Line Name' => 'Dipping',
        'Plant' => '1',
        'Floor' => '1',
        'Location' => 'P1F1',
        'ListID' => null,
        'Status' => 'Active',
        'IP_Address' => null,
        'Correction Temp' => 0,
        'Correction Humid' => 0,
        'Temp_Upper_Limit' => 30,
        'Temp_Lower_Limit' => 18,
        'Humid_Upper_Limit' => 70,
        'Humid_Lower_Limit' => 40,
    ]);
}

function monitoringSnapshotUser(): User
{
    return (new User())->forceFill([
        'employee_no' => 'EMP-001',
        'first_name' => 'Jane',
        'last_name' => 'Dela Cruz',
    ]);
}
