<?php

declare(strict_types=1);

namespace App\Models\TempHumid;

class DowntimeRecord extends TempHumidModel
{
    protected $table = 'TempHumid_Maintenance_Downtime_Log';

    protected $primaryKey = 'ID';

    public const STATUS_ONGOING = 'ongoing';
    public const STATUS_UPLOADED = 'uploaded';
    public const VALID_SYMPTOMS = ['Breach', 'No Data', 'Stable', '-'];
}
