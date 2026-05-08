<?php

declare(strict_types=1);

namespace App\Models\TempHumid;

class SensorStatusLog extends TempHumidModel
{
    protected $table = 'TempHumid_Status_Log';

    protected $primaryKey = 'ID';
}
