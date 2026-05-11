<?php

declare(strict_types=1);

namespace App\Models\TempHumid;

class FacilitiesAlert extends TempHumidModel
{
    protected $table = 'TempHumid_Facilities_Alert_Log';

    protected $primaryKey = 'ID';
}
