<?php

declare(strict_types=1);

namespace App\Models\TempHumid;

use Illuminate\Database\Eloquent\Builder;

class AcuQr extends TempHumidModel
{
    protected $table = 'vw_TempHumid_Facilities_ACU_QRs';

    protected $primaryKey = 'ID';

    public const ACU_SHORT_CATEGORY = 'ACU';
    public const ACU_CATEGORY = 'Air Conditioning Unit';

    public function scopeAcuOnly(Builder $query): Builder
    {
        return $query->where(function (Builder $category): void {
            $category
                ->where('SHORT_CATEGORY_NAME', self::ACU_SHORT_CATEGORY)
                ->orWhere('CATEGORY_NAME', self::ACU_CATEGORY);
        });
    }
}
