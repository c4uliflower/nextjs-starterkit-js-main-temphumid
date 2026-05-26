<?php

use App\Models\User;
use App\Services\TempHumid\FacilitiesAlertService;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Http\Request;
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
        $table->string('last_sensor_state')->nullable();
        $table->dateTime('last_sensor_read_at')->nullable();
        $table->dateTime('verify_baseline_read_at')->nullable();
        $table->integer('verify_attempt_count')->default(0);
    });

    Schema::connection('temphumid')->create('TempHumid_Facilities_Action_Log', function (Blueprint $table): void {
        $table->increments('ID');
        $table->integer('alert_id');
        $table->string('Area ID');
        $table->string('Line Name');
        $table->string('action_type');
        $table->text('action_remarks')->nullable();
        $table->string('action_by');
        $table->dateTime('action_at');
        $table->string('action_result')->nullable();
        $table->dateTime('evaluated_at')->nullable();
        $table->dateTime('evaluation_reading_at')->nullable();
    });

    Schema::connection('temphumid')->create('Temp_Logger_Chip_ID', function (Blueprint $table): void {
        $table->string('Area ID')->primary();
        $table->string('Chip ID');
        $table->string('Line Name');
        $table->string('Status')->default('Active');
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
    });

    Schema::connection('temphumid')->create('TempHumid_Limits_Log', function (Blueprint $table): void {
        $table->increments('ID');
        $table->string('Area ID');
        $table->decimal('Temp_Upper_Limit', 8, 2);
        $table->decimal('Temp_Lower_Limit', 8, 2);
        $table->decimal('Humid_Upper_Limit', 8, 2);
        $table->decimal('Humid_Lower_Limit', 8, 2);
        $table->dateTime('changed_at');
    });
});

it('creates an acknowledged facilities alert with the authenticated actor name', function (): void {
    $response = facilitiesService()->store(facilitiesRequest());

    $payload = $response->getData(true);
    $row = facilitiesAlertRow((int) $payload['data']['id']);

    expect($response->getStatusCode())->toBe(201)
        ->and($row->{'Area ID'})->toBe('P1F1-01')
        ->and($row->notif_status)->toBe('acknowledged')
        ->and($row->acknowledged_by)->toBe('Jane Dela Cruz (EMP-001)');
});

it('runs the scheduled facilities alert processing command', function (): void {
    $this->artisan('temphumid:process-facilities-alerts')
        ->expectsOutput('Processed facilities alerts. readings=0 transitions=0 verifying_updates=0')
        ->assertExitCode(0);
});

it('returns the existing active alert instead of creating a duplicate', function (): void {
    facilitiesService()->store(facilitiesRequest());

    $response = facilitiesService()->store(facilitiesRequest([
        'temperature' => 40,
        'humidity' => 85,
    ]));

    expect($response->getStatusCode())->toBe(200)
        ->and($response->getData(true)['message'])->toBe('Alert already exists.')
        ->and(DB::connection('temphumid')->table('TempHumid_Facilities_Alert_Log')->count())->toBe(1);
});

it('creates a new alert when an existing active alert can notify again', function (): void {
    $first = facilitiesService()->store(facilitiesRequest())->getData(true);
    DB::connection('temphumid')
        ->table('TempHumid_Facilities_Alert_Log')
        ->where('ID', $first['data']['id'])
        ->update(['can_notify_again' => 1]);

    $response = facilitiesService()->store(facilitiesRequest([
        'temperature' => 41,
        'humidity' => 86,
    ]));

    $original = facilitiesAlertRow($first['data']['id']);

    expect($response->getStatusCode())->toBe(201)
        ->and(DB::connection('temphumid')->table('TempHumid_Facilities_Alert_Log')->count())->toBe(2)
        ->and((bool) $original->can_notify_again)->toBeFalse();
});

it('moves an acknowledged alert to open when acknowledged by facilities', function (): void {
    $alertId = facilitiesService()->store(facilitiesRequest())->getData(true)['data']['id'];

    $response = facilitiesService()->acknowledge(facilitiesRequest(), $alertId);
    $row = facilitiesAlertRow($alertId);

    expect($response->getStatusCode())->toBe(200)
        ->and($row->notif_status)->toBe('open')
        ->and($row->opened_by)->toBe('Jane Dela Cruz (EMP-001)')
        ->and($row->opened_at)->not->toBeNull();
});

it('schedules and unschedules an open alert for maintenance', function (): void {
    $alertId = openFacilitiesAlert();

    $scheduled = facilitiesService()->schedule(facilitiesRequest([
        'actionType' => 'maintenance',
        'actionRemarks' => 'Inspect ACU',
    ]), $alertId);
    $afterSchedule = facilitiesAlertRow($alertId);

    $unscheduled = facilitiesService()->unschedule(facilitiesRequest(), $alertId);
    $afterUnschedule = facilitiesAlertRow($alertId);

    expect($scheduled->getStatusCode())->toBe(200)
        ->and($afterSchedule->action_type)->toBe('maintenance')
        ->and($afterSchedule->action_remarks)->toBe('Inspect ACU')
        ->and($afterSchedule->maintenance_queued_at)->not->toBeNull()
        ->and($unscheduled->getStatusCode())->toBe(200)
        ->and($afterUnschedule->action_type)->toBeNull()
        ->and($afterUnschedule->maintenance_queued_at)->toBeNull()
        ->and($afterUnschedule->action_remarks)->toBeNull();
});

it('moves an open alert to verifying and records an action log', function (): void {
    $alertId = openFacilitiesAlert();
    insertFacilitiesSensor();
    insertFacilitiesReading('0xAAA', '2026-05-13 09:00:00', 35, 80);

    $response = facilitiesService()->verify(facilitiesRequest([
        'actionType' => 'adjust_temp',
        'actionRemarks' => 'Lowered thermostat',
    ]), $alertId);

    $alert = facilitiesAlertRow($alertId);
    $action = DB::connection('temphumid')
        ->table('TempHumid_Facilities_Action_Log')
        ->where('alert_id', $alertId)
        ->first();

    expect($response->getStatusCode())->toBe(200)
        ->and($alert->notif_status)->toBe('verifying')
        ->and($alert->verified_by)->toBe('Jane Dela Cruz (EMP-001)')
        ->and($alert->verify_baseline_read_at)->toBe('2026-05-13 09:00:00.000000')
        ->and($action->action_type)->toBe('adjust_temp')
        ->and($action->action_remarks)->toBe('Lowered thermostat')
        ->and($action->action_result)->toBeNull();
});

it('requires remarks when verifying with the others action type', function (): void {
    $alertId = openFacilitiesAlert();

    $response = facilitiesService()->verify(facilitiesRequest([
        'actionType' => 'others',
        'actionRemarks' => '',
    ]), $alertId);

    expect($response->getStatusCode())->toBe(422)
        ->and($response->getData(true)['errors'])->toHaveKey('actionRemarks');
});

it('allows verifying with the both action type', function (): void {
    $alertId = openFacilitiesAlert();
    insertFacilitiesSensor();
    insertFacilitiesReading('0xAAA', '2026-05-13 09:00:00', 35, 80);

    $response = facilitiesService()->verify(facilitiesRequest([
        'actionType' => 'both',
        'actionRemarks' => 'Adjusted temperature and humidity',
    ]), $alertId);

    $action = DB::connection('temphumid')
        ->table('TempHumid_Facilities_Action_Log')
        ->where('alert_id', $alertId)
        ->first();

    expect($response->getStatusCode())->toBe(200)
        ->and(facilitiesAlertRow($alertId)->notif_status)->toBe('verifying')
        ->and($action->action_type)->toBe('both');
});

it('requires maintenance and repair alerts to be scheduled before that verify path', function (): void {
    $alertId = openFacilitiesAlert();

    $response = facilitiesService()->verify(facilitiesRequest([
        'actionType' => 'maintenance',
        'actionRemarks' => 'Done',
    ]), $alertId);

    expect($response->getStatusCode())->toBe(422)
        ->and($response->getData(true)['message'])->toBe('Alert is not scheduled for maintenance.');
});

it('records escalation counts without downgrading an existing escalation', function (): void {
    $alertId = openFacilitiesAlert();

    $first = facilitiesService()->escalate(facilitiesRequest(['escalationCount' => 2]), $alertId);
    $duplicate = facilitiesService()->escalate(facilitiesRequest(['escalationCount' => 1]), $alertId);
    $alert = facilitiesAlertRow($alertId);

    expect($first->getStatusCode())->toBe(200)
        ->and($duplicate->getStatusCode())->toBe(200)
        ->and((int) $alert->escalation_count)->toBe(2)
        ->and($alert->escalated_at)->not->toBeNull();
});

function facilitiesService(): FacilitiesAlertService
{
    return app(FacilitiesAlertService::class);
}

function facilitiesRequest(array $overrides = []): Request
{
    $request = Request::create('/testing', 'POST', array_merge([
        'areaId' => 'P1F1-01',
        'lineName' => 'Dipping',
        'temperature' => 35,
        'humidity' => 80,
        'tempUL' => 30,
        'tempLL' => 18,
        'humidUL' => 70,
        'humidLL' => 40,
    ], $overrides));

    $request->setUserResolver(fn (): User => (new User())->forceFill([
        'first_name' => 'Jane',
        'last_name' => 'Dela Cruz',
        'employee_no' => 'EMP-001',
    ]));

    return $request;
}

function openFacilitiesAlert(): int
{
    $alertId = facilitiesService()->store(facilitiesRequest())->getData(true)['data']['id'];
    facilitiesService()->acknowledge(facilitiesRequest(), $alertId);

    return $alertId;
}

function facilitiesAlertRow(int $alertId): object
{
    return DB::connection('temphumid')
        ->table('TempHumid_Facilities_Alert_Log')
        ->where('ID', $alertId)
        ->first();
}

function insertFacilitiesSensor(): void
{
    DB::connection('temphumid')->table('Temp_Logger_Chip_ID')->insert([
        'Area ID' => 'P1F1-01',
        'Chip ID' => '0xAAA',
        'Line Name' => 'Dipping',
        'Status' => 'Active',
        'Temp_Upper_Limit' => 30,
        'Temp_Lower_Limit' => 18,
        'Humid_Upper_Limit' => 70,
        'Humid_Lower_Limit' => 40,
    ]);
}

function insertFacilitiesReading(
    string $chipId,
    string $dayTime,
    float $temperature,
    float $humidity,
): void {
    DB::connection('temphumid')->table('TempHumid_Calib_Log')->insert([
        'Chip ID' => $chipId,
        'Day_Time' => $dayTime,
        'Temperature' => $temperature,
        'Humidity' => $humidity,
    ]);
}
