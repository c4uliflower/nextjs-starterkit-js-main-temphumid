<?php

namespace App\Models;

use App\Traits\ReadOnlyTrait;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;

class User extends Authenticatable
{
    use HasFactory, Notifiable, ReadOnlyTrait;

    protected $connection = 'sqlsrv_matgallery_reader';

    protected $table = 'vw_accounts';

    protected $fillable = [];

    protected $guarded = ['*'];

    protected $hidden = ['password'];

    protected $casts = [
        'id' => 'integer',
        'employee_id' => 'string',
        'username' => 'string',
        'employee_no' => 'string',
        'first_name' => 'string',
        'last_name' => 'string',
        'middle_name' => 'string',
        'extension' => 'string',
        'salutation' => 'string',
        'position' => 'string',
        'status' => 'string',
        'date_hired' => 'date',
        'date_regularized' => 'date',
        'date_separated' => 'date',
        'is_active' => 'boolean',
        'facility' => 'string',
        'department' => 'string',
        'section' => 'string',
        'unit' => 'string',
        'division' => 'string',
        'payroll_group' => 'string',
        'is_password_reset' => 'boolean',
    ];
}
