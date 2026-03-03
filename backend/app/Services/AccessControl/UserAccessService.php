<?php

declare(strict_types=1);

namespace App\Services\AccessControl;

use App\Models\AccessControl\SystemMenu;
use App\Models\AccessControl\SystemRole;
use App\Models\AccessControl\SystemRoleDefault;
use App\Models\AccessControl\SystemRoleMenu;
use App\Models\AccessControl\SystemUserOverride;
use App\Models\AccessControl\SystemUserRole;
use App\Models\User;
use Illuminate\Support\Collection;

class UserAccessService
{
    /**
     * Build a frontend-ready auth payload with profile, roles, permissions, and sidebar.
     *
     * @return array{
     *     profile: array<string, mixed>,
     *     roles: array<int, array{id: int, key: string, name: string, description: string|null}>,
     *     permissions: array<int, string>,
     *     sidebar: array<int, array{label: string, items: array<int, array<string, mixed>>}>
     * }
     */
    public function buildAuthPayload(User $user): array
    {
        $roles = $this->resolveRolesForUser($user);
        $menus = $this->resolveMenusForUser($user, $roles);
        $serializedRoles = $this->serializeRoles($roles);

        return [
            'profile' => $user->toArray(),
            'roles' => $serializedRoles,
            'permissions' => $this->extractPermissions($menus),
            'sidebar' => $this->buildSidebar($menus),
        ];
    }

    public function hasPermission(User $user, string $permission): bool
    {
        if ($permission === '') {
            return false;
        }

        $roles = $this->resolveRolesForUser($user);
        $menus = $this->resolveMenusForUser($user, $roles);

        return in_array($permission, $this->extractPermissions($menus), true);
    }

    public function resolveRoleForUser(User $user): ?SystemRole
    {
        return $this->resolveRolesForUser($user)->first();
    }

    /**
     * Resolve effective roles for a user.
     * Resolution order:
     * 1) Explicit user roles
     * 2) Highest-priority matching role-assignment rule
     * 3) Active fallback role marked as default
     *
     * @return Collection<int, SystemRole>
     */
    public function resolveRolesForUser(User $user): Collection
    {
        $employeeNo = (string) $user->employee_no;

        if ($employeeNo === '') {
            return collect();
        }

        $explicitRoles = $this->resolveExplicitRoles($employeeNo);
        if ($explicitRoles->isNotEmpty()) {
            return $explicitRoles;
        }

        $defaultRole = $this->resolveRoleFromDefaultRules($user);
        if ($defaultRole !== null) {
            return collect([$defaultRole]);
        }

        $fallbackRole = SystemRole::query()
            ->where('is_active', true)
            ->where('is_default', true)
            ->orderBy('id')
            ->first();

        return $fallbackRole === null ? collect() : collect([$fallbackRole]);
    }

    /**
     * @return Collection<int, SystemRole>
     */
    public function resolveExplicitRoles(string $employeeNo): Collection
    {
        $roleIds = SystemUserRole::query()
            ->where('employee_no', $employeeNo)
            ->whereNull('deleted_at')
            ->orderBy('assigned_at')
            ->orderBy('id')
            ->pluck('role_id')
            ->filter(static fn ($roleId): bool => is_numeric($roleId))
            ->map(static fn ($roleId): int => (int) $roleId)
            ->unique()
            ->values();

        if ($roleIds->isEmpty()) {
            return collect();
        }

        /** @var Collection<int, int> $orderedRoleIds */
        $orderedRoleIds = $roleIds;
        $orderMap = $orderedRoleIds->flip();

        return SystemRole::query()
            ->where('is_active', true)
            ->whereIn('id', $orderedRoleIds)
            ->get()
            ->sortBy(static fn (SystemRole $role): int => (int) ($orderMap->get((int) $role->id) ?? PHP_INT_MAX))
            ->values();
    }

    private function resolveRoleFromDefaultRules(User $user): ?SystemRole
    {
        $rules = SystemRoleDefault::query()
            ->with([
                'role',
                'groups.conditions',
            ])
            ->whereNull('deleted_at')
            ->orderByDesc('priority')
            ->orderBy('id')
            ->get();

        foreach ($rules as $rule) {
            $role = $rule->role;

            if ($role === null || ! $role->is_active) {
                continue;
            }

            if ($rule->matches($user)) {
                return $role;
            }
        }

        return null;
    }

    /**
     * @param  Collection<int, SystemRole>  $roles
     * @return Collection<int, SystemMenu>
     */
    private function resolveMenusForUser(User $user, Collection $roles): Collection
    {
        $allowedMenuIds = collect();

        $roleIds = $roles
            ->pluck('id')
            ->filter(static fn ($id): bool => is_numeric($id))
            ->map(static fn ($id): int => (int) $id)
            ->unique()
            ->values();

        if ($roleIds->isNotEmpty()) {
            $roleMenuIds = SystemRoleMenu::query()
                ->whereIn('role_id', $roleIds)
                ->pluck('menu_id');

            $allowedMenuIds = $allowedMenuIds->merge($roleMenuIds);
        }

        $overrideMenuIds = SystemUserOverride::query()
            ->where('employee_no', (string) $user->employee_no)
            ->whereNull('deleted_at')
            ->pluck('menu_id');

        $allowedMenuIds = $allowedMenuIds
            ->merge($overrideMenuIds)
            ->filter(static fn ($id): bool => is_numeric($id))
            ->map(static fn ($id): int => (int) $id)
            ->unique()
            ->values();

        if ($allowedMenuIds->isEmpty()) {
            return collect();
        }

        $allMenus = SystemMenu::query()
            ->where('is_active', true)
            ->whereNull('deleted_at')
            ->orderBy('display_order')
            ->orderBy('id')
            ->get([
                'id',
                'parent_id',
                'type',
                'title',
                'icon',
                'path',
                'permission_key',
                'display_order',
            ]);

        $menuById = $allMenus->keyBy('id');
        $includeMenuIds = $allowedMenuIds->flip();

        foreach ($allowedMenuIds as $menuId) {
            $this->appendAncestors($menuById, $includeMenuIds, $menuId);
        }

        return $allMenus
            ->filter(static fn (SystemMenu $menu): bool => $includeMenuIds->has($menu->id))
            ->values();
    }

    private function appendAncestors(Collection $menuById, Collection $includeMenuIds, int $menuId): void
    {
        $current = $menuById->get($menuId);

        while ($current !== null) {
            $includeMenuIds->put((int) $current->id, true);

            if ($current->parent_id === null) {
                break;
            }

            $current = $menuById->get((int) $current->parent_id);
        }
    }

    /**
     * @return array<int, string>
     */
    private function extractPermissions(Collection $menus): array
    {
        return $menus
            ->pluck('permission_key')
            ->filter(static fn ($permission): bool => is_string($permission) && $permission !== '')
            ->map(static fn (string $permission): string => trim($permission))
            ->unique()
            ->values()
            ->all();
    }

    /**
     * @param  Collection<int, SystemRole>  $roles
     * @return array<int, array{id: int, key: string, name: string, description: string|null}>
     */
    private function serializeRoles(Collection $roles): array
    {
        return $roles
            ->map(fn (SystemRole $role): array => $this->serializeRole($role))
            ->values()
            ->all();
    }

    /**
     * @return array{id: int, key: string, name: string, description: string|null}
     */
    private function serializeRole(SystemRole $role): array
    {
        return [
            'id' => (int) $role->id,
            'key' => (string) $role->key,
            'name' => (string) $role->name,
            'description' => $role->description,
        ];
    }

    /**
     * @return array<int, array{label: string, items: array<int, array<string, mixed>>}>
     */
    private function buildSidebar(Collection $menus): array
    {
        if ($menus->isEmpty()) {
            return [];
        }

        /** @var Collection<int, Collection<int, SystemMenu>> $childrenByParent */
        $childrenByParent = $menus
            ->whereNotNull('parent_id')
            ->groupBy(static fn (SystemMenu $menu): int => (int) $menu->parent_id);

        $groups = $menus
            ->whereNull('parent_id')
            ->where('type', 'header')
            ->values();

        $sidebar = [];
        foreach ($groups as $group) {
            $items = $this->transformChildren($childrenByParent, (int) $group->id);

            if ($items === []) {
                continue;
            }

            $sidebar[] = [
                'label' => $group->title,
                'items' => $items,
            ];
        }

        // Fallback for legacy flat top-level items.
        if ($sidebar === []) {
            $rootItems = $this->transformLegacyRootItems($menus, $childrenByParent);
            if ($rootItems !== []) {
                $sidebar[] = [
                    'label' => 'Main Menu',
                    'items' => $rootItems,
                ];
            }
        }

        return $sidebar;
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function transformChildren(Collection $childrenByParent, int $parentId): array
    {
        /** @var Collection<int, SystemMenu> $children */
        $children = $childrenByParent->get($parentId, collect());

        return $children
            ->sortBy([
                ['display_order', 'asc'],
                ['id', 'asc'],
            ])
            ->map(function (SystemMenu $menu) use ($childrenByParent): array {
                $children = $this->transformChildren($childrenByParent, (int) $menu->id);
                $type = $menu->type === 'header' ? 'header' : ($menu->type === 'divider' ? 'divider' : 'item');

                $item = [
                    'type' => $type,
                    'title' => $menu->title,
                    'icon' => $menu->icon,
                    'permission' => $menu->permission_key,
                    'href' => $menu->path,
                    'badge' => null,
                ];

                if ($children !== []) {
                    $item['children'] = $children;
                }

                return $item;
            })
            ->values()
            ->all();
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function transformLegacyRootItems(Collection $menus, Collection $childrenByParent): array
    {
        return $menus
            ->whereNull('parent_id')
            ->reject(static fn (SystemMenu $menu): bool => $menu->type === 'header')
            ->sortBy([
                ['display_order', 'asc'],
                ['id', 'asc'],
            ])
            ->map(function (SystemMenu $menu) use ($childrenByParent): array {
                $children = $this->transformChildren($childrenByParent, (int) $menu->id);
                $type = $menu->type === 'header' ? 'header' : ($menu->type === 'divider' ? 'divider' : 'item');

                $item = [
                    'type' => $type,
                    'title' => $menu->title,
                    'icon' => $menu->icon,
                    'permission' => $menu->permission_key,
                    'href' => $menu->path,
                    'badge' => null,
                ];

                if ($children !== []) {
                    $item['children'] = $children;
                }

                return $item;
            })
            ->values()
            ->all();
    }
}
