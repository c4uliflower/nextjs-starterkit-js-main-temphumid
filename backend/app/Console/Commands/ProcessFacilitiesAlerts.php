<?php

namespace App\Console\Commands;

use App\Services\TempHumid\FacilitiesAlertService;
use Illuminate\Console\Command;
use Throwable;

class ProcessFacilitiesAlerts extends Command
{
    protected $signature = 'temphumid:process-facilities-alerts';

    protected $description = 'Process temp/humidity facilities alert readings and verification states.';

    public function handle(FacilitiesAlertService $alerts): int
    {
        try {
            $readings = $alerts->processReadings();
            $verifying = $alerts->processVerifying();
        } catch (Throwable $exception) {
            $this->error($exception->getMessage());

            return self::FAILURE;
        }

        $this->info(sprintf(
            'Processed facilities alerts. readings=%s transitions=%s verifying_updates=%s',
            $readings['processed'] ?? 0,
            $readings['transitions'] ?? 0,
            count($verifying['data'] ?? [])
        ));

        return self::SUCCESS;
    }
}
