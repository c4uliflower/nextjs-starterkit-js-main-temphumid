<?php

namespace App\Models\AccessControl;

use App\Models\User;
use App\Traits\Blameable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

class SystemUserRole extends Model
{
    use Blameable, SoftDeletes;

    protected $table = 'system_user_roles';

    protected $primaryKey = 'id';

    public $incrementing = true;

    protected $keyType = 'int';

    public $timestamps = false;

    protected $fillable = [
        'id',
        'employee_no',
        'role_id',
        'assigned_at',
        'assigned_by',
        'updated_at',
        'updated_by',
        'deleted_at',
        'deleted_by',
    ];

    protected $casts = [
        'role_id' => 'integer',
        'assigned_at' => 'datetime',
        'updated_at' => 'datetime',
        'deleted_at' => 'datetime',
    ];

    /**
     * The role assigned to this user
     */
    public function role(): BelongsTo
    {
        return $this->belongsTo(related: SystemRole::class, foreignKey: 'role_id', ownerKey: 'id');
    }

    /**
     * The user this assignment belongs to
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(related: User::class, foreignKey: 'employee_no', ownerKey: 'employee_no');
    }

    /**
     * The user who assigned this role
     */
    public function assignedByUser(): BelongsTo
    {
        return $this->belongsTo(related: User::class, foreignKey: 'assigned_by', ownerKey: 'employee_no');
    }
}
