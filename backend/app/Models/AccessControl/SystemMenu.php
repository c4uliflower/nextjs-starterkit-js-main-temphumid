<?php

namespace App\Models\AccessControl;

use App\Traits\Blameable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class SystemMenu extends Model
{
    use Blameable, SoftDeletes;

    protected $table = 'system_menus';

    protected $fillable = [
        'parent_id',
        'type',
        'title',
        'icon',
        'path',
        'permission_key',
        'display_order',
        'is_active',
        'created_at',
        'created_by',
        'updated_at',
        'updated_by',
        'deleted_at',
        'deleted_by',
    ];

    protected $casts = [
        'parent_id' => 'integer',
        'display_order' => 'integer',
        'is_active' => 'boolean',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
        'deleted_at' => 'datetime',
    ];

    /**
     * Parent menu (self-referencing)
     */
    public function parent(): BelongsTo
    {
        return $this->belongsTo(related: SystemMenu::class, foreignKey: 'parent_id', ownerKey: 'id');
    }

    /**
     * Child menus (self-referencing)
     */
    public function children(): HasMany
    {
        return $this->hasMany(related: SystemMenu::class, foreignKey: 'parent_id', localKey: 'id');
    }

    /**
     * Role-menu assignments
     */
    public function roleMenus(): HasMany
    {
        return $this->hasMany(related: SystemRoleMenu::class, foreignKey: 'menu_id', localKey: 'id');
    }

    /**
     * User overrides for this menu
     */
    public function userOverrides(): HasMany
    {
        return $this->hasMany(related: SystemUserOverride::class, foreignKey: 'menu_id', localKey: 'id');
    }

    /**
     * Check if menu is active
     */
    public function isActive(): bool
    {
        return $this->is_active;
    }

    /**
     * Check if menu is header type
     */
    public function isHeader(): bool
    {
        return $this->type === 'header';
    }

    /**
     * Check if menu is group type
     */
    public function isGroup(): bool
    {
        return $this->type === 'group';
    }

    /**
     * Check if menu is item type
     */
    public function isItem(): bool
    {
        return $this->type === 'item';
    }
}
