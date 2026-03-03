<?php

namespace App\Models\AccessControl;

use App\Models\User;
use App\Traits\Blameable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class SystemRoleDefault extends Model
{
    use Blameable, SoftDeletes;

    protected $table = 'system_role_defaults';

    public $timestamps = false;

    protected $fillable = [
        'role_id',
        'priority',
        'created_at',
        'created_by',
        'updated_at',
        'updated_by',
        'deleted_at',
        'deleted_by',
    ];

    protected $casts = [
        'role_id' => 'integer',
        'priority' => 'integer',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
        'deleted_at' => 'datetime',
    ];

    /**
     * The role this default rule belongs to
     */
    public function role(): BelongsTo
    {
        return $this->belongsTo(related: SystemRole::class, foreignKey: 'role_id', ownerKey: 'id');
    }

    /**
     * Groups attached to this rule
     */
    public function groups(): HasMany
    {
        return $this->hasMany(related: SystemRoleDefaultGroup::class, foreignKey: 'role_default_id', localKey: 'id')
            ->orderBy('sort_order')
            ->orderBy('id');
    }

    /**
     * Check if this default rule matches the given user
     */
    public function matches(User $user): bool
    {
        $groups = $this->relationLoaded('groups') ? $this->groups : $this->groups()->with('conditions')->get();

        if ($groups->isEmpty()) {
            return false;
        }

        foreach ($groups as $group) {
            $conditions = $group->relationLoaded('conditions') ? $group->conditions : $group->conditions()->get();

            if ($conditions->isEmpty()) {
                continue;
            }

            $groupMatches = false;
            $currentAndTerm = null;

            foreach ($conditions as $index => $condition) {
                $matches = $this->matchesCondition($user, (string) $condition->match_field, (string) $condition->match_value);
                $operator = strtoupper((string) ($condition->condition_operator ?? 'AND')) === 'OR' ? 'OR' : 'AND';

                if ($index === 0 || $currentAndTerm === null) {
                    $currentAndTerm = $matches;

                    continue;
                }

                if ($operator === 'OR') {
                    $groupMatches = $groupMatches || (bool) $currentAndTerm;
                    $currentAndTerm = $matches;

                    continue;
                }

                // AND chain, evaluated before OR boundaries.
                $currentAndTerm = (bool) $currentAndTerm && $matches;
            }

            if ($currentAndTerm !== null) {
                $groupMatches = $groupMatches || (bool) $currentAndTerm;
            }

            // Across groups we use OR semantics: any matched group satisfies the rule.
            if ($groupMatches) {
                return true;
            }
        }

        return false;
    }

    private function matchesCondition(User $user, string $field, string $expectedValue): bool
    {
        $actualValue = match (strtoupper(trim($field))) {
            'DEPARTMENT' => data_get($user, 'department'),
            'SECTION' => data_get($user, 'section'),
            'POSITION' => data_get($user, 'position'),
            // Backward-compatible mapping: some directories expose division as "unit".
            'DIVISION' => data_get($user, 'division') ?? data_get($user, 'unit'),
            default => null,
        };

        if ($actualValue === null) {
            return false;
        }

        return $this->normalizeMatchValue((string) $actualValue) === $this->normalizeMatchValue($expectedValue);
    }

    private function normalizeMatchValue(string $value): string
    {
        return strtoupper(trim($value));
    }
}
