<?php

namespace App\Models;

use App\Traits\ReadOnlyTrait;
use Illuminate\Database\Eloquent\Model;

/**
 * @property int $id
 * @property string $division
 * @property int $created_by
 * @property string $date_created
 * @property int $modified_by
 * @property string $date_modified
 * @property bool $is_deleted
 * @property int $deleted_by
 * @property string $date_deleted
 */
class Division extends Model
{
    use ReadOnlyTrait;

    protected $table = 'tbl_divisions';

    protected $connection = 'sqlsrv_matemployees_reader';

    protected $guarded = ['*'];
}
