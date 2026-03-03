<?php

namespace App\Models\AccessControl;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class SystemRoleDefaultGroup extends Model
{
    protected $table = 'system_role_default_groups';

    public $timestamps = false;

    protected $fillable = [
        'role_default_id',
        'sort_order',
        'created_at',
    ];

    protected $casts = [
        'role_default_id' => 'integer',
        'sort_order' => 'integer',
        'created_at' => 'datetime',
    ];

    /**
     * The rule this group belongs to
     */
    public function rule(): BelongsTo
    {
        return $this->belongsTo(related: SystemRoleDefault::class, foreignKey: 'role_default_id', ownerKey: 'id');
    }

    /**
     * Conditions in this group
     */
    public function conditions(): HasMany
    {
        return $this->hasMany(related: SystemRoleDefaultCondition::class, foreignKey: 'group_id', localKey: 'id')
            ->orderBy('sort_order')
            ->orderBy('id');
    }
}
