<?php

declare(strict_types=1);

namespace App\Traits;

use Illuminate\Http\Request;

trait ExtractsMatToken
{
    private function extractToken(Request $request): ?string
    {
        $token = $request->bearerToken() ?? $request->cookie('mat_token');

        if (! is_string($token)) {
            return null;
        }

        $token = trim($token);

        return $token === '' ? null : $token;
    }
}
