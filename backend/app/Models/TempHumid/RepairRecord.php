<?php

declare(strict_types=1);

namespace App\Models\TempHumid;

class RepairRecord extends TempHumidModel
{
    protected $table = 'TempHumid_Repair_Downtime_Log';

    protected $primaryKey = 'ID';

    public const STATUS_ONGOING = 'ongoing';
    public const STATUS_UPLOADED = 'uploaded';
}
