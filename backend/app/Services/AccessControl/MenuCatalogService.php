<?php

declare(strict_types=1);

namespace App\Services\AccessControl;

use App\Models\AccessControl\SystemMenu;
use Illuminate\Support\Collection;

class MenuCatalogService
{
    /**
     * @return array<int, array{
     *     id: int,
     *     parent_id: int|null,
     *     type: string,
     *     title: string,
     *     path: string|null,
     *     permission_key: string|null,
     *     icon: string|null,
     *     label: string
     * }>
     */
    public function listActiveActionableMenus(): array
    {
        $menus = SystemMenu::query()
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
            ]);

        $menuById = $menus->keyBy('id');

        return $menus
            ->where('type', 'item')
            ->values()
            ->map(function (SystemMenu $menu) use ($menuById): array {
                return [
                    'id' => (int) $menu->id,
                    'parent_id' => $menu->parent_id === null ? null : (int) $menu->parent_id,
                    'type' => (string) $menu->type,
                    'title' => (string) $menu->title,
                    'path' => $menu->path,
                    'permission_key' => $menu->permission_key,
                    'icon' => $menu->icon,
                    'label' => $this->buildMenuLabel($menu, $menuById),
                ];
            })
            ->all();
    }

    /**
     * @param  Collection<int, SystemMenu>  $menuById
     */
    private function buildMenuLabel(SystemMenu $menu, Collection $menuById): string
    {
        $segments = [];
        $current = $menu;

        while ($current !== null) {
            $segments[] = (string) $current->title;

            if ($current->parent_id === null) {
                break;
            }

            $current = $menuById->get((int) $current->parent_id);
        }

        return implode(' / ', array_reverse($segments));
    }
}
