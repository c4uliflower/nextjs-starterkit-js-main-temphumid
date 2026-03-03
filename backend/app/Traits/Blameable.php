<?php

namespace App\Traits;

use App\Models\User;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Schema;

trait Blameable
{
    public static function bootBlameable()
    {
        static::creating(function ($model) {
            $user = Auth::user();
            if ($user && $user->employee_no) {
                $tableName = $model->getTable();

                if (Schema::hasColumn($tableName, 'created_by')) {
                    $model->created_by = $user->employee_no;
                }
                if (Schema::hasColumn($tableName, 'updated_by')) {
                    $model->updated_by = $user->employee_no;
                }
            }
        });

        static::updating(function ($model) {
            $user = Auth::user();
            if ($user && $user->employee_no) {
                $tableName = $model->getTable();

                if (Schema::hasColumn($tableName, 'updated_by')) {
                    $model->updated_by = $user->employee_no;
                }
            }
        });

        static::deleting(function ($model) {
            $user = Auth::user();
            if ($user && $user->employee_no) {
                $tableName = $model->getTable();

                if (Schema::hasColumn($tableName, 'deleted_by')) {
                    $model->deleted_by = $user->employee_no;

                    // For soft deletes, save the deleted_by before the delete
                    if (in_array(SoftDeletes::class, class_uses_recursive($model))) {
                        $model->saveQuietly();
                    }
                }
            }
        });
    }

    /**
     * Get the user who created this record
     */
    public function creator(): BelongsTo
    {
        return $this->belongsTo(
            related: User::class,
            foreignKey: 'created_by',
            ownerKey: 'employee_no'
        );
    }

    /**
     * Get the user who last updated this record
     */
    public function updater(): BelongsTo
    {
        return $this->belongsTo(
            related: User::class,
            foreignKey: 'updated_by',
            ownerKey: 'employee_no'
        );
    }

    /**
     * Get the user who deleted this record
     */
    public function deleter(): BelongsTo
    {
        return $this->belongsTo(
            related: User::class,
            foreignKey: 'deleted_by',
            ownerKey: 'employee_no'
        );
    }
}
