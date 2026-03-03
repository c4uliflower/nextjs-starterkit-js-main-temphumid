<?php

declare(strict_types=1);

namespace App\Http\Controllers\AccessControl;

use App\Http\Controllers\Controller;
use App\Models\AccessControl\SystemMenu;
use App\Models\AccessControl\SystemRole;
use App\Models\AccessControl\SystemUserOverride;
use App\Models\AccessControl\SystemUserRole;
use App\Models\User;
use App\Services\AccessControl\MenuCatalogService;
use App\Services\AccessControl\UserAccessService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class UserAccessController extends Controller
{
    public function __construct(
        private readonly UserAccessService $accessService,
        private readonly MenuCatalogService $menuCatalogService
    ) {}

    public function index(Request $request): JsonResponse
    {
        $search = trim((string) $request->query('search', ''));
        $page = max(1, (int) $request->query('page', 1));
        $perPage = min(50, max(5, (int) $request->query('per_page', 15)));

        $query = User::query()
            ->select([
                'employee_no',
                'first_name',
                'last_name',
                'department',
                'section',
                'position',
                'unit',
            ]);

        if ($search !== '') {
            $like = '%'.$search.'%';

            $query->where(function ($builder) use ($like): void {
                $builder
                    ->where('employee_no', 'like', $like)
                    ->orWhere('first_name', 'like', $like)
                    ->orWhere('last_name', 'like', $like)
                    ->orWhere(DB::raw("CONCAT(first_name, ' ', last_name)"), 'like', $like)
                    ->orWhere('department', 'like', $like)
                    ->orWhere('section', 'like', $like)
                    ->orWhere('position', 'like', $like);
            });
        }

        $paginator = $query
            ->orderBy('last_name')
            ->orderBy('first_name')
            ->orderBy('employee_no')
            ->paginate($perPage, ['*'], 'page', $page);

        $users = collect($paginator->items());
        $employeeNos = $users
            ->pluck('employee_no')
            ->filter(static fn ($employeeNo): bool => is_string($employeeNo) && $employeeNo !== '')
            ->values();

        $assignedRolesByEmployee = $this->loadAssignedRoleMap($employeeNos);
        $overrideMenuIdsByEmployee = $this->loadOverrideMenuMap($employeeNos);

        $items = $users->map(function (User $user) use ($assignedRolesByEmployee, $overrideMenuIdsByEmployee): array {
            $employeeNo = (string) $user->employee_no;
            $assignedRoles = $assignedRolesByEmployee->get($employeeNo, collect());

            $effectiveRoles = $assignedRoles->isNotEmpty()
                ? $assignedRoles
                : $this->accessService->resolveRolesForUser($user);

            $overrideMenuIds = $overrideMenuIdsByEmployee->get($employeeNo, []);

            return [
                'employee_no' => $employeeNo,
                'first_name' => (string) $user->first_name,
                'last_name' => (string) $user->last_name,
                'full_name' => trim((string) $user->first_name.' '.(string) $user->last_name),
                'department' => (string) $user->department,
                'section' => (string) $user->section,
                'position' => (string) $user->position,
                'unit' => $user->unit,
                'assigned_roles' => $this->serializeRoles($assignedRoles),
                'effective_roles' => $this->serializeRoles($effectiveRoles),
                'override_count' => count($overrideMenuIds),
                'override_menu_ids' => $overrideMenuIds,
            ];
        })->values()->all();

        $roleOptions = SystemRole::query()
            ->where('is_active', true)
            ->orderByDesc('is_default')
            ->orderBy('name')
            ->get(['id', 'name', 'key', 'is_default'])
            ->map(fn (SystemRole $role): array => [
                'id' => (int) $role->id,
                'name' => (string) $role->name,
                'key' => (string) $role->key,
                'is_default' => (bool) $role->is_default,
            ])
            ->values()
            ->all();

        return response()->json([
            'data' => [
                'items' => $items,
                'roles' => $roleOptions,
                'menus' => $this->menuCatalogService->listActiveActionableMenus(),
                'pagination' => [
                    'current_page' => $paginator->currentPage(),
                    'last_page' => $paginator->lastPage(),
                    'per_page' => $paginator->perPage(),
                    'total' => $paginator->total(),
                ],
            ],
        ]);
    }

    public function syncRoles(Request $request, string $employeeNo): JsonResponse
    {
        $user = User::query()
            ->where('employee_no', $employeeNo)
            ->first();

        if (! $user instanceof User) {
            return response()->json([
                'message' => 'User not found.',
            ], 404);
        }

        $validated = $request->validate([
            'role_ids' => ['nullable', 'array'],
            'role_ids.*' => [
                'integer',
                'distinct',
                Rule::exists('system_roles', 'id')->where(function ($query): void {
                    $query->where('is_active', true)->whereNull('deleted_at');
                }),
            ],
        ]);

        $requestedRoleIds = collect($validated['role_ids'] ?? [])
            ->map(static fn ($roleId): int => (int) $roleId)
            ->unique()
            ->values();

        $actorEmployeeNo = $this->resolveActorEmployeeNo($request);

        DB::transaction(function () use ($employeeNo, $requestedRoleIds, $actorEmployeeNo): void {
            $existingAssignments = SystemUserRole::query()
                ->withTrashed()
                ->where('employee_no', $employeeNo)
                ->get()
                ->keyBy(static fn (SystemUserRole $assignment): int => (int) $assignment->role_id);

            foreach ($existingAssignments as $roleId => $assignment) {
                if ($requestedRoleIds->contains($roleId)) {
                    $assignment->deleted_at = null;
                    $assignment->deleted_by = null;
                    $assignment->updated_at = now();
                    $assignment->updated_by = $actorEmployeeNo;
                    $assignment->save();

                    continue;
                }

                if ($assignment->deleted_at === null) {
                    $assignment->deleted_by = $actorEmployeeNo;
                    $assignment->save();
                    $assignment->delete();
                }
            }

            foreach ($requestedRoleIds as $roleId) {
                if ($existingAssignments->has($roleId)) {
                    continue;
                }

                $assignment = new SystemUserRole;
                $assignment->employee_no = $employeeNo;
                $assignment->role_id = $roleId;
                $assignment->assigned_at = now();
                $assignment->assigned_by = $actorEmployeeNo;
                $assignment->save();
            }
        });

        $assignedRoles = $this->loadAssignedRolesForEmployee($employeeNo);
        $effectiveRoles = $assignedRoles->isNotEmpty()
            ? $assignedRoles
            : $this->accessService->resolveRolesForUser($user);

        return response()->json([
            'data' => [
                'employee_no' => $employeeNo,
                'assigned_roles' => $this->serializeRoles($assignedRoles),
                'effective_roles' => $this->serializeRoles($effectiveRoles),
            ],
        ]);
    }

    public function syncOverrides(Request $request, string $employeeNo): JsonResponse
    {
        $user = User::query()
            ->where('employee_no', $employeeNo)
            ->first();

        if (! $user instanceof User) {
            return response()->json([
                'message' => 'User not found.',
            ], 404);
        }

        $validated = $request->validate([
            'menu_ids' => ['nullable', 'array'],
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

        $actorEmployeeNo = $this->resolveActorEmployeeNo($request);

        DB::transaction(function () use ($employeeNo, $menuIds, $actorEmployeeNo): void {
            $existingOverrides = SystemUserOverride::query()
                ->withTrashed()
                ->where('employee_no', $employeeNo)
                ->get()
                ->keyBy(static fn (SystemUserOverride $override): int => (int) $override->menu_id);

            foreach ($existingOverrides as $menuId => $override) {
                if ($menuIds->contains($menuId)) {
                    $override->deleted_at = null;
                    $override->deleted_by = null;
                    $override->updated_at = now();
                    $override->updated_by = $actorEmployeeNo;
                    $override->save();

                    continue;
                }

                if ($override->deleted_at === null) {
                    $override->deleted_by = $actorEmployeeNo;
                    $override->save();
                    $override->delete();
                }
            }

            foreach ($menuIds as $menuId) {
                if ($existingOverrides->has($menuId)) {
                    continue;
                }

                $override = new SystemUserOverride;
                $override->employee_no = $employeeNo;
                $override->menu_id = $menuId;
                $override->created_at = now();
                $override->created_by = $actorEmployeeNo;
                $override->save();
            }
        });

        $overrideMenuIds = $this->loadOverrideMenuIdsForEmployee($employeeNo);

        return response()->json([
            'data' => [
                'employee_no' => $employeeNo,
                'override_count' => count($overrideMenuIds),
                'override_menu_ids' => $overrideMenuIds,
                'ignored_menu_ids' => $requestedMenuIds
                    ->diff($menuIds)
                    ->values()
                    ->all(),
            ],
        ]);
    }

    /**
     * @param  Collection<int, string>  $employeeNos
     * @return Collection<string, Collection<int, SystemRole>>
     */
    private function loadAssignedRoleMap(Collection $employeeNos): Collection
    {
        if ($employeeNos->isEmpty()) {
            return collect();
        }

        $assignments = SystemUserRole::query()
            ->with(['role:id,key,name,is_active,description'])
            ->whereIn('employee_no', $employeeNos)
            ->whereNull('deleted_at')
            ->orderBy('assigned_at')
            ->orderBy('id')
            ->get();

        return $assignments
            ->groupBy('employee_no')
            ->map(static function (Collection $rows): Collection {
                return $rows
                    ->map(static fn (SystemUserRole $assignment): ?SystemRole => $assignment->role)
                    ->filter(static fn ($role): bool => $role instanceof SystemRole && $role->is_active)
                    ->unique('id')
                    ->values();
            });
    }

    /**
     * @param  Collection<int, string>  $employeeNos
     * @return Collection<string, array<int, int>>
     */
    private function loadOverrideMenuMap(Collection $employeeNos): Collection
    {
        if ($employeeNos->isEmpty()) {
            return collect();
        }

        $overrides = SystemUserOverride::query()
            ->whereIn('employee_no', $employeeNos)
            ->whereNull('deleted_at')
            ->get(['employee_no', 'menu_id']);

        return $overrides
            ->groupBy('employee_no')
            ->map(static fn (Collection $rows): array => $rows
                ->pluck('menu_id')
                ->map(static fn ($menuId): int => (int) $menuId)
                ->unique()
                ->values()
                ->all());
    }

    /**
     * @return Collection<int, SystemRole>
     */
    private function loadAssignedRolesForEmployee(string $employeeNo): Collection
    {
        return $this->loadAssignedRoleMap(collect([$employeeNo]))
            ->get($employeeNo, collect());
    }

    /**
     * @return array<int, int>
     */
    private function loadOverrideMenuIdsForEmployee(string $employeeNo): array
    {
        return $this->loadOverrideMenuMap(collect([$employeeNo]))
            ->get($employeeNo, []);
    }

    private function resolveActorEmployeeNo(Request $request): ?string
    {
        $actor = $request->user();

        if (! $actor instanceof User) {
            return null;
        }

        $employeeNo = (string) $actor->employee_no;

        return $employeeNo === '' ? null : $employeeNo;
    }

    /**
     * @param  Collection<int, SystemRole>  $roles
     * @return array<int, array{id: int, key: string, name: string, description: string|null}>
     */
    private function serializeRoles(Collection $roles): array
    {
        return $roles
            ->map(static fn (SystemRole $role): array => [
                'id' => (int) $role->id,
                'key' => (string) $role->key,
                'name' => (string) $role->name,
                'description' => $role->description,
            ])
            ->values()
            ->all();
    }
}
