<?php

use App\Http\Controllers\AccessControl\MenuManagementController;
use App\Http\Controllers\AccessControl\RoleAssignmentRuleController;
use App\Http\Controllers\AccessControl\RoleManagementController;
use App\Http\Controllers\AccessControl\UserAccessController;
use App\Http\Controllers\AuthController;
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
});
