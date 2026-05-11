<?php

declare(strict_types=1);

namespace App\Models\TempHumid;

class BreachEvent extends TempHumidModel
{
    protected $table = 'TempHumid_Breach_Events';

    protected $primaryKey = 'ID';
}
