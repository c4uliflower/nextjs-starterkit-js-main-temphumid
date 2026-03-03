<?php

declare(strict_types=1);

namespace Database\Seeders;

use App\Models\AccessControl\SystemMenu;
use App\Models\AccessControl\SystemRole;
use App\Models\AccessControl\SystemRoleMenu;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class SystemMenuSeeder extends Seeder
{
    /**
     * Seed baseline sidebar, roles, and role-menu access control mappings.
     */
    public function run(): void
    {
        DB::transaction(function (): void {
            $roles = $this->upsertRoles();
            $menus = $this->upsertMenus();
            $this->upsertRoleMenuAssignments($roles, $menus);
        });
    }

    /**
     * @return array<string, SystemRole>
     */
    private function upsertRoles(): array
    {
        $definitions = [
            'basic_user' => [
                'name' => 'Basic User',
                'description' => 'Default role with standard navigation access.',
                'is_default' => true,
                'is_active' => true,
            ],
            'super_admin' => [
                'name' => 'Super Admin',
                'description' => 'Super administrator role with complete access control workspace access.',
                'is_default' => false,
                'is_active' => true,
            ],
            'admin' => [
                'name' => 'Admin',
                'description' => 'Administrative role with elevated access control workspace access.',
                'is_default' => false,
                'is_active' => true,
            ],
        ];

        $roles = [];
        foreach ($definitions as $key => $definition) {
            $role = SystemRole::query()
                ->withTrashed()
                ->where('key', $key)
                ->first();

            if ($role === null) {
                $role = new SystemRole;
                $role->key = $key;
            }

            $role->name = $definition['name'];
            $role->description = $definition['description'];
            $role->is_default = $definition['is_default'];
            $role->is_active = $definition['is_active'];
            $role->deleted_at = null;
            $role->deleted_by = null;
            $role->save();

            $roles[$key] = $role;
        }

        return $roles;
    }

    /**
     * @return array<string, SystemMenu>
     */
    private function upsertMenus(): array
    {
        $definitions = [
            'group_main' => [
                'type' => 'header',
                'title' => 'Main Menu',
                'icon' => null,
                'path' => null,
                'permission_key' => null,
                'display_order' => 10,
                'is_active' => true,
                'parent_key' => null,
            ],
            'dashboard' => [
                'type' => 'item',
                'title' => 'Dashboard',
                'icon' => 'LayoutDashboard',
                'path' => '/dashboard',
                'permission_key' => 'view_dashboard',
                'display_order' => 10,
                'is_active' => true,
                'parent_key' => 'group_main',
            ],
            'group_admin' => [
                'type' => 'header',
                'title' => 'Administrator',
                'icon' => null,
                'path' => null,
                'permission_key' => null,
                'display_order' => 20,
                'is_active' => true,
                'parent_key' => null,
            ],
            'access_control' => [
                'type' => 'group',
                'title' => 'Access Control',
                'icon' => 'Shield',
                'path' => null,
                'permission_key' => null,
                'display_order' => 10,
                'is_active' => true,
                'parent_key' => 'group_admin',
            ],
            'user_access' => [
                'type' => 'item',
                'title' => 'User',
                'icon' => 'Users',
                'path' => '/access-control/users',
                'permission_key' => 'manage_roles',
                'display_order' => 20,
                'is_active' => true,
                'parent_key' => 'access_control',
            ],
            'role_management' => [
                'type' => 'item',
                'title' => 'Role Management',
                'icon' => 'ShieldCheck',
                'path' => '/access-control/roles',
                'permission_key' => 'manage_roles',
                'display_order' => 30,
                'is_active' => true,
                'parent_key' => 'access_control',
            ],
            'menu_management' => [
                'type' => 'item',
                'title' => 'Menu Management',
                'icon' => 'Network',
                'path' => '/access-control/menus',
                'permission_key' => 'manage_roles',
                'display_order' => 35,
                'is_active' => true,
                'parent_key' => 'access_control',
            ],
            'role_assignment_rules' => [
                'type' => 'item',
                'title' => 'Role Assignment Rules',
                'icon' => 'Workflow',
                'path' => '/access-control/role-assignment-rules',
                'permission_key' => 'manage_roles',
                'display_order' => 40,
                'is_active' => true,
                'parent_key' => 'access_control',
            ],
        ];

        $menus = [];
        $pending = $definitions;

        while ($pending !== []) {
            $progressed = false;

            foreach ($pending as $key => $definition) {
                $parentKey = $definition['parent_key'];
                $parentId = $parentKey === null ? null : ($menus[$parentKey]->id ?? null);

                if ($parentKey !== null && $parentId === null) {
                    continue;
                }

                $menu = $this->findMenu(
                    type: $definition['type'],
                    title: $definition['title'],
                    path: $definition['path'],
                    parentId: $parentId
                );

                if ($menu === null) {
                    $menu = new SystemMenu;
                }

                $menu->parent_id = $parentId;
                $menu->type = $definition['type'];
                $menu->title = $definition['title'];
                $menu->icon = $definition['icon'];
                $menu->path = $definition['path'];
                $menu->permission_key = $definition['permission_key'];
                $menu->display_order = $definition['display_order'];
                $menu->is_active = $definition['is_active'];
                $menu->deleted_at = null;
                $menu->deleted_by = null;
                $menu->save();

                $menus[$key] = $menu;

                unset($pending[$key]);
                $progressed = true;
            }

            if (! $progressed) {
                throw new \RuntimeException('Unable to resolve sidebar menu parent dependencies.');
            }
        }

        return $menus;
    }

    private function findMenu(string $type, string $title, ?string $path, ?int $parentId): ?SystemMenu
    {
        $query = SystemMenu::query()
            ->withTrashed()
            ->where('type', $type)
            ->where('title', $title)
            ->where('parent_id', $parentId);

        if ($path === null) {
            $query->whereNull('path');
        } else {
            $query->where('path', $path);
        }

        $match = $query->first();
        if ($match !== null) {
            return $match;
        }

        // For actionable items, prefer matching by path to preserve identity when regrouping.
        if ($type === 'item' && $path !== null && $path !== '') {
            $pathMatch = SystemMenu::query()
                ->withTrashed()
                ->where('type', $type)
                ->where('path', $path)
                ->first();

            if ($pathMatch !== null) {
                return $pathMatch;
            }
        }

        return null;
    }

    /**
     * @param  array<string, SystemRole>  $roles
     * @param  array<string, SystemMenu>  $menus
     */
    private function upsertRoleMenuAssignments(array $roles, array $menus): void
    {
        $standardRole = $roles['basic_user'] ?? null;
        $superAdminRole = $roles['super_admin'] ?? null;
        $adminRole = $roles['admin'] ?? null;

        if ($standardRole !== null && isset($menus['dashboard'])) {
            $this->assignMenuToRole((int) $standardRole->id, (int) $menus['dashboard']->id);
        }

        $this->assignAllActiveItemMenusToRole($superAdminRole);
        $this->assignAllActiveItemMenusToRole($adminRole);
    }

    private function assignAllActiveItemMenusToRole(?SystemRole $role): void
    {
        if ($role === null) {
            return;
        }

        $allActiveItemMenuIds = SystemMenu::query()
            ->where('is_active', true)
            ->whereNull('deleted_at')
            ->where('type', 'item')
            ->pluck('id');

        foreach ($allActiveItemMenuIds as $menuId) {
            $this->assignMenuToRole((int) $role->id, (int) $menuId);
        }
    }

    private function assignMenuToRole(int $roleId, int $menuId): void
    {
        SystemRoleMenu::query()->updateOrCreate(
            [
                'role_id' => $roleId,
                'menu_id' => $menuId,
            ],
            [
                'created_at' => now(),
                'created_by' => '0',
            ]
        );
    }
}
