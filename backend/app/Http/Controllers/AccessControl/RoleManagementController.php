<?php

declare(strict_types=1);

namespace App\Http\Controllers\AccessControl;

use App\Http\Controllers\Controller;
use App\Models\AccessControl\SystemMenu;
use App\Models\AccessControl\SystemRole;
use App\Models\AccessControl\SystemRoleDefault;
use App\Models\AccessControl\SystemRoleMenu;
use App\Models\AccessControl\SystemUserRole;
use App\Services\AccessControl\MenuCatalogService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class RoleManagementController extends Controller
{
    public function __construct(
        private readonly MenuCatalogService $menuCatalogService
    ) {}

    public function index(): JsonResponse
    {
        $roles = SystemRole::query()
            ->orderByDesc('is_default')
            ->orderByDesc('is_active')
            ->orderBy('name')
            ->get([
                'id',
                'name',
                'key',
                'description',
                'is_default',
                'is_active',
            ]);

        $roleIds = $roles
            ->pluck('id')
            ->map(static fn ($id): int => (int) $id)
            ->values();

        $menuAssignments = SystemRoleMenu::query()
            ->join('system_menus', 'system_menus.id', '=', 'system_role_menus.menu_id')
            ->whereIn('role_id', $roleIds)
            ->where('system_menus.type', 'item')
            ->where('system_menus.is_active', true)
            ->whereNull('system_menus.deleted_at')
            ->get(['system_role_menus.role_id', 'system_role_menus.menu_id'])
            ->groupBy('role_id')
            ->map(static fn ($rows): array => $rows
                ->pluck('menu_id')
                ->map(static fn ($menuId): int => (int) $menuId)
                ->values()
                ->all());

        $userCounts = SystemUserRole::query()
            ->whereNull('deleted_at')
            ->selectRaw('role_id, COUNT(*) as total')
            ->groupBy('role_id')
            ->pluck('total', 'role_id');

        return response()->json([
            'data' => [
                'roles' => $roles
                    ->map(function (SystemRole $role) use ($menuAssignments, $userCounts): array {
                        $roleId = (int) $role->id;

                        return [
                            'id' => $roleId,
                            'name' => (string) $role->name,
                            'key' => (string) $role->key,
                            'description' => $role->description,
                            'is_default' => (bool) $role->is_default,
                            'is_active' => (bool) $role->is_active,
                            'users_count' => (int) ($userCounts->get($roleId) ?? 0),
                            'menu_ids' => $menuAssignments->get($roleId, []),
                        ];
                    })
                    ->values()
                    ->all(),
                'menus' => $this->menuCatalogService->listActiveActionableMenus(),
            ],
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $payload = $this->validateRolePayload($request);

        $existing = SystemRole::query()
            ->withTrashed()
            ->where('key', $payload['key'])
            ->first();

        if ($existing !== null && $existing->deleted_at === null) {
            return response()->json([
                'message' => 'Role key already exists.',
            ], 422);
        }

        $conflictByName = SystemRole::query()
            ->withTrashed()
            ->where('name', $payload['name'])
            ->when($existing !== null, fn ($query) => $query->where('id', '!=', $existing->id))
            ->exists();

        if ($conflictByName) {
            return response()->json([
                'message' => 'Role name already exists.',
            ], 422);
        }

        $role = DB::transaction(function () use ($existing, $payload): SystemRole {
            $role = $existing ?? new SystemRole;

            $role->name = $payload['name'];
            $role->key = $payload['key'];
            $role->description = $payload['description'];
            $role->is_active = $payload['is_active'];
            $role->is_default = $payload['is_default'];
            $role->deleted_at = null;
            $role->deleted_by = null;
            $role->save();

            if ($role->is_default) {
                SystemRole::query()
                    ->where('id', '!=', $role->id)
                    ->update(['is_default' => false]);
            }

            return $role->fresh();
        });

        return response()->json([
            'data' => [
                'id' => (int) $role->id,
                'name' => (string) $role->name,
                'key' => (string) $role->key,
                'description' => $role->description,
                'is_default' => (bool) $role->is_default,
                'is_active' => (bool) $role->is_active,
            ],
        ], 201);
    }

    public function update(Request $request, int $roleId): JsonResponse
    {
        $role = SystemRole::query()->find($roleId);

        if (! $role instanceof SystemRole) {
            return response()->json([
                'message' => 'Role not found.',
            ], 404);
        }

        $payload = $this->validateRolePayload($request);

        $conflictByKey = SystemRole::query()
            ->withTrashed()
            ->where('key', $payload['key'])
            ->where('id', '!=', $role->id)
            ->exists();

        if ($conflictByKey) {
            return response()->json([
                'message' => 'Role key already exists.',
            ], 422);
        }

        $conflictByName = SystemRole::query()
            ->withTrashed()
            ->where('name', $payload['name'])
            ->where('id', '!=', $role->id)
            ->exists();

        if ($conflictByName) {
            return response()->json([
                'message' => 'Role name already exists.',
            ], 422);
        }

        $updatedRole = DB::transaction(function () use ($role, $payload): SystemRole {
            $role->name = $payload['name'];
            $role->key = $payload['key'];
            $role->description = $payload['description'];
            $role->is_active = $payload['is_active'];
            $role->is_default = $payload['is_default'];
            $role->save();

            if ($role->is_default) {
                SystemRole::query()
                    ->where('id', '!=', $role->id)
                    ->update(['is_default' => false]);
            }

            return $role->fresh();
        });

        return response()->json([
            'data' => [
                'id' => (int) $updatedRole->id,
                'name' => (string) $updatedRole->name,
                'key' => (string) $updatedRole->key,
                'description' => $updatedRole->description,
                'is_default' => (bool) $updatedRole->is_default,
                'is_active' => (bool) $updatedRole->is_active,
            ],
        ]);
    }

    public function destroy(int $roleId): JsonResponse
    {
        $role = SystemRole::query()->find($roleId);

        if (! $role instanceof SystemRole) {
            return response()->json([
                'message' => 'Role not found.',
            ], 404);
        }

        $hasAssignedUsers = SystemUserRole::query()
            ->where('role_id', $roleId)
            ->whereNull('deleted_at')
            ->exists();

        if ($hasAssignedUsers) {
            return response()->json([
                'message' => 'Role cannot be deleted while it is assigned to users.',
            ], 422);
        }

        $hasActiveRules = SystemRoleDefault::query()
            ->where('role_id', $roleId)
            ->whereNull('deleted_at')
            ->exists();

        if ($hasActiveRules) {
            return response()->json([
                'message' => 'Role cannot be deleted while assignment rules still target it.',
            ], 422);
        }

        DB::transaction(function () use ($roleId, $role): void {
            SystemRoleMenu::query()
                ->where('role_id', $roleId)
                ->delete();

            $role->delete();
        });

        return response()->json([
            'message' => 'Role deleted successfully.',
        ]);
    }

    public function syncMenus(Request $request, int $roleId): JsonResponse
    {
        $role = SystemRole::query()->find($roleId);

        if (! $role instanceof SystemRole) {
            return response()->json([
                'message' => 'Role not found.',
            ], 404);
        }

        $validated = $request->validate([
            'menu_ids' => ['required', 'array'],
            'menu_ids.*' => [
                'integer',
                'distinct',
            ],
        ]);

        $requestedMenuIds = collect($validated['menu_ids'] ?? [])
            ->map(static fn ($menuId): int => (int) $menuId)
            ->unique()
            ->values();

        $menuIds = SystemMenu::query()
            ->whereIn('id', $requestedMenuIds)
            ->where('type', 'item')
            ->where('is_active', true)
            ->whereNull('deleted_at')
            ->pluck('id')
            ->map(static fn ($menuId): int => (int) $menuId)
            ->values();

        DB::transaction(function () use ($roleId, $menuIds): void {
            SystemRoleMenu::query()
                ->where('role_id', $roleId)
                ->when(
                    $menuIds->isNotEmpty(),
                    fn ($query) => $query->whereNotIn('menu_id', $menuIds)
                )
                ->delete();

            foreach ($menuIds as $menuId) {
                SystemRoleMenu::query()->updateOrCreate(
                    [
                        'role_id' => $roleId,
                        'menu_id' => $menuId,
                    ],
                    [
                        'created_at' => now(),
                    ]
                );
            }
        });

        return response()->json([
            'data' => [
                'role_id' => $roleId,
                'menu_ids' => $menuIds->all(),
                'ignored_menu_ids' => $requestedMenuIds
                    ->diff($menuIds)
                    ->values()
                    ->all(),
            ],
        ]);
    }

    /**
     * @return array{
     *     name: string,
     *     key: string,
     *     description: string|null,
     *     is_default: bool,
     *     is_active: bool
     * }
     */
    private function validateRolePayload(Request $request): array
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:100'],
            'key' => ['required', 'string', 'max:100', 'alpha_dash'],
            'description' => ['nullable', 'string', 'max:255'],
            'is_default' => ['required', 'boolean'],
            'is_active' => ['required', 'boolean'],
        ]);

        return [
            'name' => trim((string) $validated['name']),
            'key' => strtolower(trim((string) $validated['key'])),
            'description' => isset($validated['description']) && trim((string) $validated['description']) !== ''
                ? trim((string) $validated['description'])
                : null,
            'is_default' => (bool) $validated['is_default'],
            'is_active' => (bool) $validated['is_active'],
        ];
    }
}
