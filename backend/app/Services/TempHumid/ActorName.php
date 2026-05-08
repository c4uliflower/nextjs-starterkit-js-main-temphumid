<?php

declare(strict_types=1);

namespace App\Services\TempHumid;

use App\Models\User;
use Illuminate\Http\Request;

class ActorName
{
    public function fromRequest(Request $request): string
    {
        $user = $request->user();

        if (! $user instanceof User) {
            return 'unknown';
        }

        return trim($user->first_name . ' ' . $user->last_name) . ' (' . $user->employee_no . ')';
    }
}
