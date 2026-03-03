<?php

namespace App\Models\AccessControl;

use App\Models\User;
use App\Traits\Blameable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class SystemRole extends Model
{
    use Blameable, SoftDeletes;

    protected $table = 'system_roles';

    protected $fillable = [
        'name',
        'key',
        'description',
        'is_default',
        'is_active',
        'created_at',
        'created_by',
        'updated_at',
        'updated_by',
        'deleted_at',
        'deleted_by',
    ];

    protected $casts = [
        'is_default' => 'boolean',
        'is_active' => 'boolean',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
        'deleted_at' => 'datetime',
    ];

    /**
     * Role-menu pivot records
     */
    public function roleMenus(): HasMany
    {
        return $this->hasMany(related: SystemRoleMenu::class, foreignKey: 'role_id', localKey: 'id');
    }

    /**
     * Menus assigned to this role (via pivot)
     */
    public function menus(): BelongsToMany
    {
        return $this->belongsToMany(
            related: SystemMenu::class,
            table: 'system_role_menus',
            foreignPivotKey: 'role_id',
            relatedPivotKey: 'menu_id'
        )->withPivot('created_at', 'created_by');
    }

    /**
     * User role assignments
     */
    public function userRoles(): HasMany
    {
        return $this->hasMany(related: SystemUserRole::class, foreignKey: 'role_id', localKey: 'id');
    }

    /**
     * Default rules for this role
     */
    public function roleDefaults(): HasMany
    {
        return $this->hasMany(related: SystemRoleDefault::class, foreignKey: 'role_id', localKey: 'id');
    }

    /**
     * Check if role is active
     */
    public function isActive(): bool
    {
        return $this->is_active;
    }

    /**
     * Check if role is default
     */
    public function isDefault(): bool
    {
        return $this->is_default;
    }

    /**
     * Check if role has specific menu assigned
     */
    public function hasMenu(int $menuId): bool
    {
        return $this->menus()->where('menu_id', $menuId)->exists();
    }
}
