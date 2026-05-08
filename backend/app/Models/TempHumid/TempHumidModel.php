<?php

declare(strict_types=1);

namespace App\Models\TempHumid;

use Illuminate\Database\Eloquent\Model;

abstract class TempHumidModel extends Model
{
    protected $connection = 'temphumid';

    public $timestamps = false;

    protected $guarded = [];
}
