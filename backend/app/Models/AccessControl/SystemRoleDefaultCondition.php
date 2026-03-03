<?php

namespace App\Models\AccessControl;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SystemRoleDefaultCondition extends Model
{
    protected $table = 'system_role_default_conditions';

    public $timestamps = false;

    protected $fillable = [
        'group_id',
        'match_field',
        'match_value',
        'sort_order',
        'condition_operator',
    ];

    protected $casts = [
        'group_id' => 'integer',
        'sort_order' => 'integer',
        'condition_operator' => 'string',
    ];

    /**
     * The group this condition belongs to
     */
    public function group(): BelongsTo
    {
        return $this->belongsTo(related: SystemRoleDefaultGroup::class, foreignKey: 'group_id', ownerKey: 'id');
    }
}
