<?php

declare(strict_types=1);

namespace App\Models\TempHumid;

class SensorReading extends TempHumidModel
{
    protected $table = 'TempHumid_Calib_Log';

    protected $primaryKey = 'ID';
}
