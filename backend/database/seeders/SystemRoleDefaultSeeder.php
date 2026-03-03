<?php

declare(strict_types=1);

namespace Database\Seeders;

use App\Models\AccessControl\SystemRole;
use App\Models\AccessControl\SystemRoleDefault;
use App\Models\AccessControl\SystemRoleDefaultCondition;
use App\Models\AccessControl\SystemRoleDefaultGroup;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class SystemRoleDefaultSeeder extends Seeder
{
    /**
     * Seed conditional default role rules.
     */
    public function run(): void
    {
        DB::transaction(function (): void {
            $superAdminRole = SystemRole::query()
                ->where('key', 'super_admin')
                ->where('is_active', true)
                ->first();

            $adminRole = SystemRole::query()
                ->where('key', 'admin')
                ->where('is_active', true)
                ->first();

            if ($superAdminRole !== null) {
                $superAdminRule = $this->upsertRuleForRole(
                    roleId: (int) $superAdminRole->id,
                    priority: 100
                );
                $this->deleteRuleGroups((int) $superAdminRule->id);

                $this->createGroupWithConditions((int) $superAdminRule->id, 1, [
                    ['match_field' => 'DEPARTMENT', 'match_value' => 'CIS', 'condition_operator' => 'AND'],
                ]);
            }

            if ($adminRole !== null) {
                $adminRule = $this->upsertRuleForRole(
                    roleId: (int) $adminRole->id,
                    priority: 90
                );
                $this->deleteRuleGroups((int) $adminRule->id);

                $this->createGroupWithConditions((int) $adminRule->id, 1, [
                    ['match_field' => 'POSITION', 'match_value' => 'Chairman', 'condition_operator' => 'AND'],
                    ['match_field' => 'POSITION', 'match_value' => 'General Manager', 'condition_operator' => 'OR'],
                    ['match_field' => 'DEPARTMENT', 'match_value' => 'Administration', 'condition_operator' => 'AND'],
                ]);

                $this->createGroupWithConditions((int) $adminRule->id, 2, [
                    ['match_field' => 'POSITION', 'match_value' => 'Asst. Factory Manager', 'condition_operator' => 'AND'],
                    ['match_field' => 'DIVISION', 'match_value' => 'Manufacturing', 'condition_operator' => 'AND'],
                ]);

                $this->createGroupWithConditions((int) $adminRule->id, 3, [
                    ['match_field' => 'POSITION', 'match_value' => 'President', 'condition_operator' => 'AND'],
                    ['match_field' => 'DEPARTMENT', 'match_value' => 'Sales and Customer Support', 'condition_operator' => 'AND'],
                ]);
            }
        });
    }

    private function upsertRuleForRole(int $roleId, int $priority): SystemRoleDefault
    {
        $rule = SystemRoleDefault::query()
            ->withTrashed()
            ->where('role_id', $roleId)
            ->orderBy('id')
            ->first();

        if ($rule === null) {
            $rule = new SystemRoleDefault;
            $rule->role_id = $roleId;
        }

        $rule->priority = $priority;
        $rule->deleted_at = null;
        $rule->deleted_by = null;
        $rule->save();

        return $rule;
    }

    private function deleteRuleGroups(int $ruleId): void
    {
        $groupIds = SystemRoleDefaultGroup::query()
            ->where('role_default_id', $ruleId)
            ->pluck('id');

        if ($groupIds->isNotEmpty()) {
            SystemRoleDefaultCondition::query()
                ->whereIn('group_id', $groupIds)
                ->delete();
        }

        SystemRoleDefaultGroup::query()
            ->where('role_default_id', $ruleId)
            ->delete();
    }

    /**
     * @param  array<int, array{match_field: string, match_value: string, condition_operator: string}>  $conditions
     */
    private function createGroupWithConditions(int $ruleId, int $groupSortOrder, array $conditions): void
    {
        $group = new SystemRoleDefaultGroup;
        $group->role_default_id = $ruleId;
        $group->sort_order = $groupSortOrder;
        $group->created_at = now();
        $group->save();

        foreach ($conditions as $index => $payload) {
            $condition = new SystemRoleDefaultCondition;
            $condition->group_id = (int) $group->id;
            $condition->match_field = $payload['match_field'];
            $condition->match_value = $payload['match_value'];
            $condition->sort_order = $index + 1;
            $condition->condition_operator = $payload['condition_operator'];
            $condition->save();
        }
    }
}
