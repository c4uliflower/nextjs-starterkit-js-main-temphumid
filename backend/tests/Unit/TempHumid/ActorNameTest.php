<?php

use App\Models\User;
use App\Services\TempHumid\ActorName;
use Illuminate\Http\Request;

it('formats authenticated users as name with employee number', function (): void {
    $request = Request::create('/testing');
    $request->setUserResolver(fn (): User => (new User())->forceFill([
        'first_name' => 'Jane',
        'last_name' => 'Dela Cruz',
        'employee_no' => 'EMP-001',
    ]));

    expect((new ActorName())->fromRequest($request))->toBe('Jane Dela Cruz (EMP-001)');
});

it('returns unknown when the request has no app user', function (): void {
    $request = Request::create('/testing');

    expect((new ActorName())->fromRequest($request))->toBe('unknown');
});
