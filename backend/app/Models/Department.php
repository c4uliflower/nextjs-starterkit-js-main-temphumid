<?php

namespace App\Models;

use App\Traits\ReadOnlyTrait;
use Illuminate\Database\Eloquent\Model;

/**
 * @property int $id
 * @property string $department
 * @property int $created_by
 * @property string $date_created
 * @property int $modified_by
 * @property string $date_modified
 * @property bool $is_deleted
 * @property int $deleted_by
 * @property string $date_deleted
 */
class Department extends Model
{
    use ReadOnlyTrait;

    protected $table = 'tbl_departments';

    protected $connection = 'sqlsrv_matemployees_reader';

    protected $guarded = ['*'];
}
