<?php

namespace App\Models\AccessControl;

use App\Models\User;
use App\Traits\Blameable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

class SystemUserOverride extends Model
{
    use Blameable, SoftDeletes;

    protected $table = 'system_user_overrides';

    public $timestamps = false;

    protected $fillable = [
        'employee_no',
        'menu_id',
        'created_at',
        'created_by',
        'updated_at',
        'updated_by',
        'deleted_at',
        'deleted_by',
    ];

    protected $casts = [
        'menu_id' => 'integer',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
        'deleted_at' => 'datetime',
    ];

    /**
     * The menu this override grants access to
     */
    public function menu(): BelongsTo
    {
        return $this->belongsTo(related: SystemMenu::class, foreignKey: 'menu_id', ownerKey: 'id');
    }

    /**
     * The user this override belongs to
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(related: User::class, foreignKey: 'employee_no', ownerKey: 'employee_no');
    }
}
