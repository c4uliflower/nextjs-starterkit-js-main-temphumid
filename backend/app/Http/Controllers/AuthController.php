<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Models\User;
use App\Services\AccessControl\UserAccessService;
use App\Services\Authentication\MatAuthenticationService;
use App\Traits\ExtractsMatToken;
use Exception;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Symfony\Component\HttpKernel\Exception\HttpException;
use Throwable;

class AuthController extends Controller
{
    use ExtractsMatToken;

    public function __construct(
        private readonly MatAuthenticationService $authService,
        private readonly UserAccessService $accessService,
    ) {}

    public function getUser(Request $request): JsonResponse
    {
        try {
            $user = $request->user();

            if (! $user instanceof User) {
                return response()->json([
                    'message' => 'Unauthenticated.',
                ], 401);
            }

            return response()->json([
                'data' => $this->accessService->buildAuthPayload($user),
            ], 200);
        } catch (Throwable $exception) {
            Log::error('AuthController::getUser failed.', [
                'error' => $exception->getMessage(),
            ]);

            return response()->json([
                'message' => 'Unable to fetch authenticated user.',
            ], 500);
        }
    }

    public function handleLogout(Request $request): JsonResponse
    {
        try {
            $token = $this->extractToken($request);

            if ($token === null) {
                return response()->json([
                    'message' => 'Authentication token is required.',
                ], 401);
            }

            $this->authService->logOutWithToken($token);

            return response()->json([
                'message' => 'Successfully signed out.',
            ], 200);
        } catch (HttpException $exception) {
            $status = $exception->getStatusCode();

            if ($status === 401) {
                return response()->json([
                    'message' => 'The authentication token is invalid or expired.',
                ], 401);
            }

            return response()->json([
                'message' => 'Unable to sign out at the authentication provider.',
            ], 502);
        } catch (Exception $exception) {
            Log::error('AuthController::handleLogout failed.', [
                'error' => $exception->getMessage(),
            ]);

            return response()->json([
                'message' => 'Unable to complete sign out.',
            ], 500);
        }
    }
}
