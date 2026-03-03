<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * @property int $id
 * @property string $section
 * @property int $created_by
 * @property string $date_created
 * @property int $modified_by
 * @property string $date_modified
 * @property bool $is_deleted
 * @property int $deleted_by
 * @property string $date_deleted
 */
class Sections extends Model
{
    protected $table = 'tbl_sections';

    protected $connection = 'sqlsrv_matemployees_reader';

    protected $guarded = ['*'];
}
