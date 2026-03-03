<?php

declare(strict_types=1);

namespace App\Providers;

use App\Models\User;
use App\Services\Authentication\MatAuthenticationService;
use App\Traits\ExtractsMatToken;
use Exception;
use Illuminate\Foundation\Support\Providers\AuthServiceProvider as ServiceProvider;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Log;
use Symfony\Component\HttpKernel\Exception\HttpException;

class MatAuthenticationProvider extends ServiceProvider
{
    use ExtractsMatToken;

    public function boot(): void
    {
        $this->registerPolicies();

        Auth::viaRequest('mat-token', function (Request $request) {
            if ($request->attributes->has('_mat_auth_user')) {
                return $request->attributes->get('_mat_auth_user');
            }

            $token = $this->extractToken($request);

            if (! $token) {
                return null;
            }

            try {
                $externalUser = app(MatAuthenticationService::class)->validateTokenAndGetUser($token);
                $employeeNo = data_get($externalUser, 'data.user.employee_no');

                if (! is_string($employeeNo) && ! is_int($employeeNo)) {
                    Log::warning('Mat auth payload is missing a valid employee number.');

                    return null;
                }

                $user = User::query()
                    ->where('employee_no', (string) $employeeNo)
                    ->first();

                $request->attributes->set('_mat_auth_user', $user);

                return $user;
            } catch (HttpException $exception) {
                Log::notice('External token validation failed.', [
                    'upstream_status' => $exception->getStatusCode(),
                    'message' => $exception->getMessage(),
                ]);
            } catch (Exception $exception) {
                Log::error('Unexpected failure while validating external token.', [
                    'message' => $exception->getMessage(),
                ]);

                return null;
            }

            return null;
        });
    }
}
