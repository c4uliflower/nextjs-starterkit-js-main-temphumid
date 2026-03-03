<?php

declare(strict_types=1);

namespace App\Http\Controllers\AccessControl;

use App\Http\Controllers\Controller;
use App\Models\AccessControl\SystemMenu;
use App\Models\AccessControl\SystemRoleMenu;
use App\Models\AccessControl\SystemUserOverride;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class MenuManagementController extends Controller
{
    /**
     * @var array<int, string>
     */
    private const MENU_TYPES = ['group', 'header', 'item'];

    /**
     * @var array<int, string>
     */
    private const PARENT_TYPES = ['header', 'group'];

    public function index(): JsonResponse
    {
        $menus = SystemMenu::query()
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
                'is_active',
            ]);

        $menuById = $menus->keyBy('id');
        $childrenByParent = $menus->groupBy(
            static fn (SystemMenu $menu): string => $menu->parent_id === null ? 'root' : (string) $menu->parent_id
        );

        $roleLinkCounts = SystemRoleMenu::query()
            ->selectRaw('menu_id, COUNT(*) as total')
            ->groupBy('menu_id')
            ->pluck('total', 'menu_id');

        $overrideCounts = SystemUserOverride::query()
            ->whereNull('deleted_at')
            ->selectRaw('menu_id, COUNT(*) as total')
            ->groupBy('menu_id')
            ->pluck('total', 'menu_id');

        $descendantCountCache = [];

        $records = $menus
            ->map(function (SystemMenu $menu) use (
                $menuById,
                $childrenByParent,
                $roleLinkCounts,
                $overrideCounts,
                &$descendantCountCache
            ): array {
                $menuId = (int) $menu->id;

                return [
                    'id' => $menuId,
                    'parent_id' => $menu->parent_id === null ? null : (int) $menu->parent_id,
                    'type' => (string) $menu->type,
                    'title' => (string) $menu->title,
                    'icon' => $menu->icon,
                    'path' => $menu->path,
                    'permission_key' => $menu->permission_key,
                    'display_order' => (int) $menu->display_order,
                    'is_active' => (bool) $menu->is_active,
                    'label' => $this->buildMenuLabel($menu, $menuById),
                    'children_count' => $childrenByParent->get((string) $menuId, collect())->count(),
                    'descendant_count' => $this->countDescendants($menuId, $childrenByParent, $descendantCountCache),
                    'role_links_count' => (int) ($roleLinkCounts->get($menuId) ?? 0),
                    'user_overrides_count' => (int) ($overrideCounts->get($menuId) ?? 0),
                ];
            })
            ->values()
            ->all();

        $parentOptions = $menus
            ->whereIn('type', self::PARENT_TYPES)
            ->values()
            ->map(fn (SystemMenu $menu): array => [
                'id' => (int) $menu->id,
                'parent_id' => $menu->parent_id === null ? null : (int) $menu->parent_id,
                'type' => (string) $menu->type,
                'title' => (string) $menu->title,
                'path' => $menu->path,
                'permission_key' => $menu->permission_key,
                'icon' => $menu->icon,
                'label' => $this->buildMenuLabel($menu, $menuById),
            ])
            ->all();

        return response()->json([
            'data' => [
                'menus' => $records,
                'parent_options' => $parentOptions,
                'summary' => [
                    'total' => $menus->count(),
                    'active' => $menus->where('is_active', true)->count(),
                    'linked' => $menus->whereNotNull('parent_id')->count(),
                    'actionable' => $menus->where('type', 'item')->count(),
                ],
            ],
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $payload = $this->validateMenuPayload($request);
        $parent = $this->resolveParent($payload['parent_id']);

        $hierarchyError = $this->validateHierarchyConstraints($payload, $parent, null);
        if ($hierarchyError !== null) {
            return $hierarchyError;
        }

        $uniquenessError = $this->validateUniqueness($payload, null);
        if ($uniquenessError !== null) {
            return $uniquenessError;
        }

        $menu = DB::transaction(function () use ($payload): SystemMenu {
            $menu = new SystemMenu;

            $menu->parent_id = $payload['parent_id'];
            $menu->type = $payload['type'];
            $menu->title = $payload['title'];
            $menu->icon = $payload['icon'];
            $menu->path = $payload['path'];
            $menu->permission_key = $payload['permission_key'];
            $menu->display_order = $payload['display_order'];
            $menu->is_active = $payload['is_active'];
            $menu->deleted_at = null;
            $menu->deleted_by = null;
            $menu->save();

            return $menu->fresh();
        });

        return response()->json([
            'data' => $this->serializeMutationRecord($menu),
        ], 201);
    }

    public function update(Request $request, int $menuId): JsonResponse
    {
        $menu = SystemMenu::query()
            ->whereNull('deleted_at')
            ->find($menuId);

        if (! $menu instanceof SystemMenu) {
            return response()->json([
                'message' => 'Menu not found.',
            ], 404);
        }

        $payload = $this->validateMenuPayload($request);
        $parent = $this->resolveParent($payload['parent_id']);

        $hierarchyError = $this->validateHierarchyConstraints($payload, $parent, $menu);
        if ($hierarchyError !== null) {
            return $hierarchyError;
        }

        $uniquenessError = $this->validateUniqueness($payload, $menu);
        if ($uniquenessError !== null) {
            return $uniquenessError;
        }

        $updated = DB::transaction(function () use ($menu, $payload): SystemMenu {
            $typeChangedFromItem = $menu->type === 'item' && $payload['type'] !== 'item';

            $menu->parent_id = $payload['parent_id'];
            $menu->type = $payload['type'];
            $menu->title = $payload['title'];
            $menu->icon = $payload['icon'];
            $menu->path = $payload['path'];
            $menu->permission_key = $payload['permission_key'];
            $menu->display_order = $payload['display_order'];
            $menu->is_active = $payload['is_active'];
            $menu->save();

            if ($typeChangedFromItem) {
                SystemRoleMenu::query()
                    ->where('menu_id', $menu->id)
                    ->delete();

                $overrides = SystemUserOverride::query()
                    ->where('menu_id', $menu->id)
                    ->whereNull('deleted_at')
                    ->get();

                foreach ($overrides as $override) {
                    $override->delete();
                }
            }

            return $menu->fresh();
        });

        return response()->json([
            'data' => $this->serializeMutationRecord($updated),
        ]);
    }

    public function link(Request $request, int $menuId): JsonResponse
    {
        $menu = SystemMenu::query()
            ->whereNull('deleted_at')
            ->find($menuId);

        if (! $menu instanceof SystemMenu) {
            return response()->json([
                'message' => 'Menu not found.',
            ], 404);
        }

        $validated = $request->validate([
            'parent_id' => [
                'present',
                'nullable',
                'integer',
                Rule::exists('system_menus', 'id')->where(function ($query): void {
                    $query->whereNull('deleted_at');
                }),
            ],
            'display_order' => ['nullable', 'integer', 'min:0', 'max:10000'],
        ]);

        $parentId = $validated['parent_id'] === null ? null : (int) $validated['parent_id'];
        $parent = $this->resolveParent($parentId);

        if ($menu->type === 'header' && $parent !== null) {
            return response()->json([
                'message' => 'Header menus cannot be linked under another parent.',
            ], 422);
        }

        if ($parent !== null && ! in_array($parent->type, self::PARENT_TYPES, true)) {
            return response()->json([
                'message' => 'Parent menu must be a header or group.',
            ], 422);
        }

        if ($parent !== null && (int) $parent->id === (int) $menu->id) {
            return response()->json([
                'message' => 'A menu cannot be linked to itself.',
            ], 422);
        }

        if ($parent !== null && $this->wouldCreateCycle((int) $menu->id, (int) $parent->id)) {
            return response()->json([
                'message' => 'Invalid link: parent cannot be a descendant of the menu.',
            ], 422);
        }

        $menu->parent_id = $parent?->id;
        $menu->display_order = isset($validated['display_order'])
            ? (int) $validated['display_order']
            : (int) $menu->display_order;
        $menu->save();

        return response()->json([
            'data' => [
                'id' => (int) $menu->id,
                'parent_id' => $menu->parent_id === null ? null : (int) $menu->parent_id,
                'display_order' => (int) $menu->display_order,
            ],
        ]);
    }

    public function destroy(int $menuId): JsonResponse
    {
        $menu = SystemMenu::query()
            ->whereNull('deleted_at')
            ->find($menuId);

        if (! $menu instanceof SystemMenu) {
            return response()->json([
                'message' => 'Menu not found.',
            ], 404);
        }

        $subtreeMenuIds = $this->collectSubtreeMenuIds((int) $menu->id);

        [$menuCount, $roleLinkCount, $overrideCount] = DB::transaction(function () use ($subtreeMenuIds): array {
            $roleLinkCount = SystemRoleMenu::query()
                ->whereIn('menu_id', $subtreeMenuIds)
                ->count();

            SystemRoleMenu::query()
                ->whereIn('menu_id', $subtreeMenuIds)
                ->delete();

            $overrides = SystemUserOverride::query()
                ->whereIn('menu_id', $subtreeMenuIds)
                ->whereNull('deleted_at')
                ->get();

            $overrideCount = $overrides->count();
            foreach ($overrides as $override) {
                $override->delete();
            }

            $menus = SystemMenu::query()
                ->whereIn('id', $subtreeMenuIds)
                ->whereNull('deleted_at')
                ->orderByDesc('id')
                ->get();

            $menuCount = $menus->count();
            foreach ($menus as $record) {
                $record->delete();
            }

            return [$menuCount, $roleLinkCount, $overrideCount];
        });

        return response()->json([
            'message' => 'Menu deleted successfully.',
            'data' => [
                'deleted_menu_count' => $menuCount,
                'deleted_role_links' => $roleLinkCount,
                'deleted_user_overrides' => $overrideCount,
            ],
        ]);
    }

    /**
     * @return array{
     *     parent_id: int|null,
     *     type: string,
     *     title: string,
     *     icon: string|null,
     *     path: string|null,
     *     permission_key: string|null,
     *     display_order: int,
     *     is_active: bool
     * }
     */
    private function validateMenuPayload(Request $request): array
    {
        $validated = $request->validate([
            'parent_id' => [
                'present',
                'nullable',
                'integer',
                Rule::exists('system_menus', 'id')->where(function ($query): void {
                    $query->whereNull('deleted_at');
                }),
            ],
            'type' => ['required', 'string', Rule::in(self::MENU_TYPES)],
            'title' => ['required', 'string', 'max:100'],
            'icon' => ['nullable', 'string', 'max:50'],
            'path' => ['nullable', 'string', 'max:255'],
            'permission_key' => ['nullable', 'string', 'max:100', 'regex:/^[A-Za-z0-9._-]+$/'],
            'display_order' => ['nullable', 'integer', 'min:0', 'max:10000'],
            'is_active' => ['required', 'boolean'],
        ]);

        $type = strtolower(trim((string) $validated['type']));
        $title = trim((string) $validated['title']);
        $icon = $this->normalizeOptionalString($validated['icon'] ?? null);
        $path = $this->normalizeOptionalString($validated['path'] ?? null);
        $permissionKey = $this->normalizeOptionalString($validated['permission_key'] ?? null);

        if ($path !== null && ! str_starts_with($path, '/')) {
            $path = '/'.$path;
        }

        if ($type !== 'item') {
            $path = null;
            $permissionKey = null;
        }

        if ($type === 'header') {
            $icon = null;
        }

        return [
            'parent_id' => $validated['parent_id'] === null ? null : (int) $validated['parent_id'],
            'type' => $type,
            'title' => $title,
            'icon' => $icon,
            'path' => $path,
            'permission_key' => $permissionKey,
            'display_order' => isset($validated['display_order']) ? (int) $validated['display_order'] : 0,
            'is_active' => (bool) $validated['is_active'],
        ];
    }

    /**
     * @param  array{
     *     parent_id: int|null,
     *     type: string,
     *     title: string,
     *     icon: string|null,
     *     path: string|null,
     *     permission_key: string|null,
     *     display_order: int,
     *     is_active: bool
     * }  $payload
     */
    private function validateHierarchyConstraints(array $payload, ?SystemMenu $parent, ?SystemMenu $current): ?JsonResponse
    {
        if ($payload['type'] === 'header' && $parent !== null) {
            return response()->json([
                'message' => 'Header menus must be top-level and cannot have a parent.',
            ], 422);
        }

        if ($parent !== null && ! in_array((string) $parent->type, self::PARENT_TYPES, true)) {
            return response()->json([
                'message' => 'Parent menu must be a header or group.',
            ], 422);
        }

        if ($current !== null && $parent !== null && (int) $current->id === (int) $parent->id) {
            return response()->json([
                'message' => 'A menu cannot be linked to itself.',
            ], 422);
        }

        if ($current !== null && $parent !== null && $this->wouldCreateCycle((int) $current->id, (int) $parent->id)) {
            return response()->json([
                'message' => 'Invalid hierarchy: parent cannot be a descendant of the menu.',
            ], 422);
        }

        return null;
    }

    /**
     * @param  array{
     *     parent_id: int|null,
     *     type: string,
     *     title: string,
     *     icon: string|null,
     *     path: string|null,
     *     permission_key: string|null,
     *     display_order: int,
     *     is_active: bool
     * }  $payload
     */
    private function validateUniqueness(array $payload, ?SystemMenu $current): ?JsonResponse
    {
        $duplicateTitle = SystemMenu::query()
            ->whereNull('deleted_at')
            ->where('type', $payload['type'])
            ->where('title', $payload['title'])
            ->when(
                $payload['parent_id'] === null,
                fn ($query) => $query->whereNull('parent_id'),
                fn ($query) => $query->where('parent_id', $payload['parent_id'])
            )
            ->when($current !== null, fn ($query) => $query->where('id', '!=', $current->id))
            ->exists();

        if ($duplicateTitle) {
            return response()->json([
                'message' => 'A menu with the same title and type already exists under the selected parent.',
            ], 422);
        }

        if ($payload['type'] === 'item' && $payload['path'] !== null) {
            $duplicatePath = SystemMenu::query()
                ->whereNull('deleted_at')
                ->where('type', 'item')
                ->where('path', $payload['path'])
                ->when($current !== null, fn ($query) => $query->where('id', '!=', $current->id))
                ->exists();

            if ($duplicatePath) {
                return response()->json([
                    'message' => 'Another active item menu already uses this path.',
                ], 422);
            }
        }

        return null;
    }

    private function resolveParent(?int $parentId): ?SystemMenu
    {
        if ($parentId === null) {
            return null;
        }

        return SystemMenu::query()
            ->whereNull('deleted_at')
            ->find($parentId);
    }

    /**
     * @return array{
     *     id: int,
     *     parent_id: int|null,
     *     type: string,
     *     title: string,
     *     icon: string|null,
     *     path: string|null,
     *     permission_key: string|null,
     *     display_order: int,
     *     is_active: bool
     * }
     */
    private function serializeMutationRecord(SystemMenu $menu): array
    {
        return [
            'id' => (int) $menu->id,
            'parent_id' => $menu->parent_id === null ? null : (int) $menu->parent_id,
            'type' => (string) $menu->type,
            'title' => (string) $menu->title,
            'icon' => $menu->icon,
            'path' => $menu->path,
            'permission_key' => $menu->permission_key,
            'display_order' => (int) $menu->display_order,
            'is_active' => (bool) $menu->is_active,
        ];
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

    /**
     * @param  Collection<string, Collection<int, SystemMenu>>  $childrenByParent
     * @param  array<int, int>  $cache
     */
    private function countDescendants(int $menuId, Collection $childrenByParent, array &$cache, array $trail = []): int
    {
        if (array_key_exists($menuId, $cache)) {
            return $cache[$menuId];
        }

        if (in_array($menuId, $trail, true)) {
            return 0;
        }

        $trail[] = $menuId;

        /** @var Collection<int, SystemMenu> $children */
        $children = $childrenByParent->get((string) $menuId, collect());
        $total = 0;

        foreach ($children as $child) {
            $total++;
            $total += $this->countDescendants((int) $child->id, $childrenByParent, $cache, $trail);
        }

        $cache[$menuId] = $total;

        return $total;
    }

    /**
     * @return array<int, int>
     */
    private function collectSubtreeMenuIds(int $menuId): array
    {
        $menus = SystemMenu::query()
            ->whereNull('deleted_at')
            ->get(['id', 'parent_id']);

        $childrenByParent = $menus->groupBy(
            static fn (SystemMenu $menu): string => $menu->parent_id === null ? 'root' : (string) $menu->parent_id
        );

        $collected = [];
        $stack = [$menuId];
        $visited = [];

        while ($stack !== []) {
            $currentId = array_pop($stack);
            if ($currentId === null) {
                continue;
            }

            if (isset($visited[$currentId])) {
                continue;
            }

            $visited[$currentId] = true;
            $collected[] = $currentId;

            /** @var Collection<int, SystemMenu> $children */
            $children = $childrenByParent->get((string) $currentId, collect());
            foreach ($children as $child) {
                $stack[] = (int) $child->id;
            }
        }

        return collect($collected)->unique()->values()->all();
    }

    private function wouldCreateCycle(int $menuId, int $parentId): bool
    {
        $parentById = SystemMenu::query()
            ->whereNull('deleted_at')
            ->pluck('parent_id', 'id');

        $currentId = $parentId;
        $visited = [];

        while (true) {
            if (isset($visited[$currentId])) {
                return true;
            }

            $visited[$currentId] = true;

            if ($currentId === $menuId) {
                return true;
            }

            $nextParent = $parentById->get($currentId);
            if (! is_numeric($nextParent)) {
                return false;
            }

            $currentId = (int) $nextParent;
        }
    }

    private function normalizeOptionalString(mixed $value): ?string
    {
        if (! is_string($value)) {
            return null;
        }

        $trimmed = trim($value);

        return $trimmed === '' ? null : $trimmed;
    }
}
