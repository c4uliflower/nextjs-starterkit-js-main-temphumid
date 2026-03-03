<?php

namespace App\Models\AccessControl;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SystemRoleMenu extends Model
{
    protected $table = 'system_role_menus';

    public $timestamps = false;

    protected $fillable = [
        'role_id',
        'menu_id',
        'created_at',
        'created_by',
    ];

    protected $casts = [
        'role_id' => 'integer',
        'menu_id' => 'integer',
        'created_at' => 'datetime',
    ];

    /**
     * The role this assignment belongs to
     */
    public function role(): BelongsTo
    {
        return $this->belongsTo(related: SystemRole::class, foreignKey: 'role_id', ownerKey: 'id');
    }

    /**
     * The menu this assignment belongs to
     */
    public function menu(): BelongsTo
    {
        return $this->belongsTo(related: SystemMenu::class, foreignKey: 'menu_id', ownerKey: 'id');
    }
}
