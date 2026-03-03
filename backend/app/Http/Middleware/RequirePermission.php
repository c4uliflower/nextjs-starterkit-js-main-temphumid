<?php

declare(strict_types=1);

namespace App\Http\Middleware;

use App\Models\User;
use App\Services\AccessControl\UserAccessService;
use Closure;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class RequirePermission
{
    public function __construct(
        private readonly UserAccessService $accessService
    ) {}

    public function handle(Request $request, Closure $next, string $permission): Response|JsonResponse
    {
        $user = $request->user();

        if (! $user instanceof User) {
            return response()->json([
                'message' => 'Unauthenticated.',
            ], 401);
        }

        if ($permission === '') {
            return response()->json([
                'message' => 'Permission key is required.',
            ], 500);
        }

        if (! $this->accessService->hasPermission($user, $permission)) {
            return response()->json([
                'message' => 'Forbidden: missing required permission.',
                'required_permission' => $permission,
            ], 403);
        }

        return $next($request);
    }
}
