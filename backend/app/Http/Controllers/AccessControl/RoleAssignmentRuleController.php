<?php

declare(strict_types=1);

namespace App\Http\Controllers\AccessControl;

use App\Http\Controllers\Controller;
use App\Models\AccessControl\SystemRole;
use App\Models\AccessControl\SystemRoleDefault;
use App\Models\AccessControl\SystemRoleDefaultCondition;
use App\Models\AccessControl\SystemRoleDefaultGroup;
use App\Models\Department;
use App\Models\Division;
use App\Models\Position;
use App\Models\Sections;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class RoleAssignmentRuleController extends Controller
{
    /**
     * @var array<int, string>
     */
    private const MATCH_FIELDS = ['DEPARTMENT', 'SECTION', 'POSITION', 'DIVISION'];

    public function index(): JsonResponse
    {
        $roles = SystemRole::query()
            ->where('is_active', true)
            ->orderBy('name')
            ->get(['id', 'name', 'key', 'is_default']);

        $rules = SystemRoleDefault::query()
            ->with([
                'role:id,name,key',
                'groups.conditions',
            ])
            ->whereNull('deleted_at')
            ->orderByDesc('priority')
            ->orderBy('id')
            ->get();

        return response()->json([
            'data' => [
                'fields' => self::MATCH_FIELDS,
                'field_values' => $this->buildFieldValues(),
                'roles' => $roles
                    ->map(fn (SystemRole $role): array => [
                        'id' => (int) $role->id,
                        'name' => (string) $role->name,
                        'key' => (string) $role->key,
                        'is_default' => (bool) $role->is_default,
                    ])
                    ->values()
                    ->all(),
                'rules' => $rules
                    ->map(fn (SystemRoleDefault $rule): array => $this->serializeRule($rule))
                    ->values()
                    ->all(),
            ],
        ]);
    }

    /**
     * @return array<string, array<int, string>>
     */
    private function buildFieldValues(): array
    {
        return [
            'DEPARTMENT' => $this->getDistinctValues(Department::query(), 'department'),
            'DIVISION' => $this->getDistinctValues(Division::query(), 'division'),
            'SECTION' => $this->getDistinctValues(Sections::query(), 'section'),
            'POSITION' => $this->getDistinctValues(Position::query(), 'position'),
        ];
    }

    /**
     * @param  \Illuminate\Database\Eloquent\Builder<\Illuminate\Database\Eloquent\Model>  $query
     * @return array<int, string>
     */
    private function getDistinctValues($query, string $column): array
    {
        return $query
            ->whereNotNull($column)
            ->select($column)
            ->distinct()
            ->orderBy($column)
            ->pluck($column)
            ->filter(static fn ($value): bool => is_string($value) && trim($value) !== '')
            ->map(static fn (string $value): string => trim($value))
            ->unique()
            ->values()
            ->all();
    }

    public function store(Request $request): JsonResponse
    {
        $payload = $this->validateRulePayload($request);
        $rule = $this->persistRule(null, $payload);

        return response()->json([
            'data' => $this->serializeRule($rule),
        ], 201);
    }

    public function update(Request $request, int $ruleId): JsonResponse
    {
        $rule = SystemRoleDefault::query()
            ->whereNull('deleted_at')
            ->find($ruleId);

        if (! $rule instanceof SystemRoleDefault) {
            return response()->json([
                'message' => 'Rule not found.',
            ], 404);
        }

        $payload = $this->validateRulePayload($request);
        $updatedRule = $this->persistRule($rule, $payload);

        return response()->json([
            'data' => $this->serializeRule($updatedRule),
        ]);
    }

    public function destroy(int $ruleId): JsonResponse
    {
        $rule = SystemRoleDefault::query()
            ->whereNull('deleted_at')
            ->find($ruleId);

        if (! $rule instanceof SystemRoleDefault) {
            return response()->json([
                'message' => 'Rule not found.',
            ], 404);
        }

        DB::transaction(function () use ($rule): void {
            $groupIds = SystemRoleDefaultGroup::query()
                ->where('role_default_id', $rule->id)
                ->pluck('id');

            if ($groupIds->isNotEmpty()) {
                SystemRoleDefaultCondition::query()
                    ->whereIn('group_id', $groupIds)
                    ->delete();
            }

            SystemRoleDefaultGroup::query()
                ->where('role_default_id', $rule->id)
                ->delete();

            $rule->delete();
        });

        return response()->json([
            'message' => 'Role assignment rule deleted successfully.',
        ]);
    }

    /**
     * @param  array{
     *     role_id: int,
     *     priority: int,
     *     groups: array<int, array{
     *         sort_order: int,
     *         conditions: array<int, array{
     *             match_field: string,
     *             match_value: string,
     *             sort_order: int,
     *             condition_operator: string
     *         }>
     *     }>
     * }  $payload
     */
    private function persistRule(?SystemRoleDefault $rule, array $payload): SystemRoleDefault
    {
        return DB::transaction(function () use ($rule, $payload): SystemRoleDefault {
            $record = $rule ?? new SystemRoleDefault;

            $record->role_id = $payload['role_id'];
            $record->priority = $payload['priority'];
            $record->deleted_at = null;
            $record->deleted_by = null;
            $record->save();

            $groupIds = SystemRoleDefaultGroup::query()
                ->where('role_default_id', $record->id)
                ->pluck('id');

            if ($groupIds->isNotEmpty()) {
                SystemRoleDefaultCondition::query()
                    ->whereIn('group_id', $groupIds)
                    ->delete();
            }

            SystemRoleDefaultGroup::query()
                ->where('role_default_id', $record->id)
                ->delete();

            foreach ($payload['groups'] as $groupPayload) {
                $group = new SystemRoleDefaultGroup;
                $group->role_default_id = (int) $record->id;
                $group->sort_order = $groupPayload['sort_order'];
                $group->created_at = now();
                $group->save();

                foreach ($groupPayload['conditions'] as $conditionPayload) {
                    $condition = new SystemRoleDefaultCondition;
                    $condition->group_id = (int) $group->id;
                    $condition->match_field = $conditionPayload['match_field'];
                    $condition->match_value = $conditionPayload['match_value'];
                    $condition->sort_order = $conditionPayload['sort_order'];
                    $condition->condition_operator = $conditionPayload['condition_operator'];
                    $condition->save();
                }
            }

            return SystemRoleDefault::query()
                ->with([
                    'role:id,name,key',
                    'groups.conditions',
                ])
                ->findOrFail($record->id);
        });
    }

    /**
     * @return array{
     *     role_id: int,
     *     priority: int,
     *     groups: array<int, array{
     *         sort_order: int,
     *         conditions: array<int, array{
     *             match_field: string,
     *             match_value: string,
     *             sort_order: int,
     *             condition_operator: string
     *         }>
     *     }>
     * }
     */
    private function validateRulePayload(Request $request): array
    {
        $validated = $request->validate([
            'role_id' => [
                'required',
                'integer',
                Rule::exists('system_roles', 'id')->where(function ($query): void {
                    $query->where('is_active', true)->whereNull('deleted_at');
                }),
            ],
            'priority' => ['required', 'integer', 'min:1', 'max:100'],
            'groups' => ['required', 'array', 'min:1'],
            'groups.*.sort_order' => ['nullable', 'integer'],
            'groups.*.conditions' => ['required', 'array', 'min:1'],
            'groups.*.conditions.*.match_field' => ['required', 'string', Rule::in(self::MATCH_FIELDS)],
            'groups.*.conditions.*.match_value' => ['required', 'string', 'max:255'],
            'groups.*.conditions.*.sort_order' => ['nullable', 'integer'],
            'groups.*.conditions.*.condition_operator' => ['nullable', 'string', Rule::in(['AND', 'OR'])],
        ]);

        $groups = [];
        foreach ($validated['groups'] as $groupIndex => $group) {
            $conditions = [];

            foreach ($group['conditions'] as $conditionIndex => $condition) {
                $conditions[] = [
                    'match_field' => strtoupper(trim((string) $condition['match_field'])),
                    'match_value' => trim((string) $condition['match_value']),
                    'sort_order' => isset($condition['sort_order'])
                        ? (int) $condition['sort_order']
                        : ($conditionIndex + 1),
                    'condition_operator' => strtoupper((string) ($condition['condition_operator'] ?? 'AND')) === 'OR' ? 'OR' : 'AND',
                ];
            }

            $groups[] = [
                'sort_order' => isset($group['sort_order']) ? (int) $group['sort_order'] : ($groupIndex + 1),
                'conditions' => $conditions,
            ];
        }

        return [
            'role_id' => (int) $validated['role_id'],
            'priority' => (int) $validated['priority'],
            'groups' => $groups,
        ];
    }

    /**
     * @return array{
     *     id: int,
     *     role_id: int,
     *     role_key: string|null,
     *     role_name: string|null,
     *     priority: int,
     *     groups: array<int, array{
     *         id: int,
     *         sort_order: int,
     *         conditions: array<int, array{
     *             id: int,
     *             match_field: string,
     *             match_value: string,
     *             sort_order: int,
     *             condition_operator: string
     *         }>
     *     }>
     * }
     */
    private function serializeRule(SystemRoleDefault $rule): array
    {
        return [
            'id' => (int) $rule->id,
            'role_id' => (int) $rule->role_id,
            'role_key' => $rule->role?->key,
            'role_name' => $rule->role?->name,
            'priority' => (int) $rule->priority,
            'groups' => $rule->groups
                ->map(static fn (SystemRoleDefaultGroup $group): array => [
                    'id' => (int) $group->id,
                    'sort_order' => (int) $group->sort_order,
                    'conditions' => $group->conditions
                        ->map(static fn (SystemRoleDefaultCondition $condition): array => [
                            'id' => (int) $condition->id,
                            'match_field' => (string) $condition->match_field,
                            'match_value' => (string) $condition->match_value,
                            'sort_order' => (int) $condition->sort_order,
                            'condition_operator' => strtoupper((string) ($condition->condition_operator ?? 'AND')) === 'OR' ? 'OR' : 'AND',
                        ])
                        ->values()
                        ->all(),
                ])
                ->values()
                ->all(),
        ];
    }
}
