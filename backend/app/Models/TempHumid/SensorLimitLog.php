<?php

declare(strict_types=1);

namespace App\Models\TempHumid;

class SensorLimitLog extends TempHumidModel
{
    protected $table = 'TempHumid_Limits_Log';

    protected $primaryKey = 'ID';
}
