<?php

use App\Models\User;
use App\Services\AccessControl\UserAccessService;

it('returns json unauthenticated responses for protected api routes', function (): void {
    $this->getJson('/api/temphumid/sensors/status')
        ->assertStatus(401)
        ->assertJson([
            'message' => 'Unauthenticated.',
        ]);
});

it('returns forbidden when an authenticated user lacks a required permission', function (): void {
    $this->mock(UserAccessService::class, function ($mock): void {
        $mock->shouldReceive('hasPermission')
            ->once()
            ->withArgs(fn (User $user, string $permission): bool => $permission === 'manage_roles')
            ->andReturn(false);
    });

    $this->actingAs(apiTestUser(), 'mat-auth')
        ->getJson('/api/access-control/roles')
        ->assertStatus(403)
        ->assertJson([
            'message' => 'Forbidden: missing required permission.',
            'required_permission' => 'manage_roles',
        ]);
});

function apiTestUser(): User
{
    return (new User())->forceFill([
        'employee_no' => 'EMP-001',
        'first_name' => 'Jane',
        'last_name' => 'Dela Cruz',
    ]);
}
