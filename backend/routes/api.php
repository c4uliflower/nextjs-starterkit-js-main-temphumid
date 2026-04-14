<?php

use App\Http\Controllers\AccessControl\MenuManagementController;
use App\Http\Controllers\AccessControl\RoleAssignmentRuleController;
use App\Http\Controllers\AccessControl\RoleManagementController;
use App\Http\Controllers\AccessControl\UserAccessController;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\TempHumid\BreachEventController;
use App\Http\Controllers\TempHumid\FacilitiesAlertController;
use App\Http\Controllers\TempHumid\DowntimeController;
use App\Http\Controllers\TempHumid\SensorController;
use App\Http\Controllers\TempHumid\SensorLimitController;
use App\Http\Controllers\TempHumid\SensorReadingController;
use App\Http\Controllers\TempHumid\SensorStatusController;
use Illuminate\Support\Facades\Route;

Route::middleware(['auth:mat-auth'])->group(function () {
    Route::prefix('auth')->group(function () {
        Route::controller(AuthController::class)->group(function () {
            Route::get('/user', 'getUser');
            Route::post('/logout', 'handleLogout');
        });
    });

    Route::prefix('access-control')
        ->middleware(['permission:manage_roles'])
        ->group(function (): void {
            Route::get('/users', [UserAccessController::class, 'index']);
            Route::put('/users/{employeeNo}/roles', [UserAccessController::class, 'syncRoles']);
            Route::put('/users/{employeeNo}/overrides', [UserAccessController::class, 'syncOverrides']);

            Route::get('/roles', [RoleManagementController::class, 'index']);
            Route::post('/roles', [RoleManagementController::class, 'store']);
            Route::put('/roles/{roleId}', [RoleManagementController::class, 'update']);
            Route::delete('/roles/{roleId}', [RoleManagementController::class, 'destroy']);
            Route::put('/roles/{roleId}/menus', [RoleManagementController::class, 'syncMenus']);

            Route::get('/menus', [MenuManagementController::class, 'index']);
            Route::post('/menus', [MenuManagementController::class, 'store']);
            Route::put('/menus/{menuId}', [MenuManagementController::class, 'update']);
            Route::put('/menus/{menuId}/link', [MenuManagementController::class, 'link']);
            Route::delete('/menus/{menuId}', [MenuManagementController::class, 'destroy']);

            Route::get('/rules', [RoleAssignmentRuleController::class, 'index']);
            Route::post('/rules', [RoleAssignmentRuleController::class, 'store']);
            Route::put('/rules/{ruleId}', [RoleAssignmentRuleController::class, 'update']);
            Route::delete('/rules/{ruleId}', [RoleAssignmentRuleController::class, 'destroy']);
        });

    Route::prefix('temphumid')->group(function (): void {
        Route::get('/sensors/readings/history/batch',    [SensorReadingController::class, 'batchHistory']);
        Route::get('/sensors/{areaId}/readings/history', [SensorReadingController::class, 'history']);
        Route::get('/sensors',                           [SensorController::class, 'index']);
        Route::get('/sensors/readings/current',          [SensorController::class, 'currentReadings']);
        Route::get('/sensors/readings/by-area/{areaId}', [SensorController::class, 'readingByAreaId']);
        Route::get('/dashboard/summary',                 [SensorController::class, 'summary']);
        Route::get('/sensors/{areaId}/readings/history', [SensorReadingController::class, 'history']);
        Route::get('/sensors/{areaId}/limits',           [SensorLimitController::class, 'show']);
        Route::post('/sensors/{areaId}/limits',          [SensorLimitController::class, 'update']);
        Route::post('/sensors/limits/batch',             [SensorLimitController::class, 'batchUpdate']);
        Route::get('sensors/limits/batch-show',          [SensorLimitController::class, 'batchShow']);
        Route::get('sensors/status',                     [SensorStatusController::class, 'index']);
        Route::post('sensors/status/batch',              [SensorStatusController::class, 'batchUpdate']);
        Route::prefix('facilities')->group(function () {
            Route::get  ('alerts',                      [FacilitiesAlertController::class, 'index']);
            Route::post ('alerts',                      [FacilitiesAlertController::class, 'store']);
            Route::patch('alerts/{id}/acknowledge',     [FacilitiesAlertController::class, 'acknowledge']);
            Route::patch('alerts/{id}/verify',          [FacilitiesAlertController::class, 'verify']);
            Route::patch('alerts/{id}/escalate',        [FacilitiesAlertController::class, 'escalate']);
            Route::post ('alerts/process-verifying',    [FacilitiesAlertController::class, 'processVerifying']);
            Route::patch('alerts/{id}/schedule',        [FacilitiesAlertController::class, 'schedule']);
            Route::patch('alerts/{id}/unschedule',      [FacilitiesAlertController::class, 'unschedule']);
            Route::post('alerts/process-readings',      [FacilitiesAlertController::class, 'processReadings']);
            Route::get('alerts/{id}/breach-events',     [BreachEventController::class, 'index']);
        });
        Route::prefix('downtime')->group(function () {
            Route::post('validate-sensor',            [DowntimeController::class, 'validateSensor']);
            Route::post('start',                      [DowntimeController::class, 'start']);
            Route::post('mark-done/{id}',             [DowntimeController::class, 'markDone']);
            Route::post('upload',                     [DowntimeController::class, 'upload']);
            Route::get('active',                      [DowntimeController::class, 'active']);
            Route::get('history',                     [DowntimeController::class, 'history']);

        });
    });
});
