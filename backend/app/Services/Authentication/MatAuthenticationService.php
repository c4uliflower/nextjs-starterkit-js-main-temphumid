<?php

declare(strict_types=1);

namespace App\Services\Authentication;

use GuzzleHttp\Promise\PromiseInterface;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Client\PendingRequest;
use Illuminate\Http\Client\Response;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Symfony\Component\HttpKernel\Exception\HttpException;

class MatAuthenticationService
{
    private string $verifyUrl;

    private string $signOutUrl;

    private bool $verifyTls;

    private bool $configLoaded = false;

    public function __construct()
    {
        $this->loadConfig();
    }

    private function loadConfig(): void
    {
        if ($this->configLoaded) {
            return;
        }

        $this->verifyUrl = (string) config('services.mat_auth.verify', '');
        $this->signOutUrl = (string) (config('services.mat_auth.sign_out') ?? config('services.mat_auth.sign-out', ''));
        $this->verifyTls = (bool) config('services.mat_auth.verify_tls', true);

        if ($this->verifyUrl === '') {
            throw new HttpException(502, 'Mat auth verify URL is not configured.');
        }

        if ($this->signOutUrl === '') {
            throw new HttpException(502, 'Mat auth sign-out URL is not configured.');
        }

        $this->configLoaded = true;
    }

    public function validateTokenAndGetUser(string $token): array
    {
        $this->loadConfig();

        $response = $this->performAuthenticatedGetRequest($this->verifyUrl, $token);

        if ($response->successful()) {
            $payload = $response->json();

            if (! is_array($payload)) {
                throw new HttpException(502, 'Authentication provider returned an invalid payload.');
            }

            return $payload;
        }

        $this->throwForUpstreamFailure('token validation', $response->status());
    }

    public function logOutWithToken(string $token): array
    {
        $this->loadConfig();

        $response = $this->performAuthenticatedPostRequest($this->signOutUrl, $token);

        if ($response->successful()) {
            return $response->json() ?? [];
        }

        $this->throwForUpstreamFailure('sign out', $response->status());
    }

    private function performAuthenticatedGetRequest(string $url, string $token): Response|PromiseInterface
    {
        $sanitizedToken = $this->normalizeToken($token);

        try {
            return $this->client()
                ->withToken($sanitizedToken)
                ->get($url);
        } catch (ConnectionException $exception) {
            Log::warning('Mat auth GET request failed to connect.', ['url' => $url]);

            throw new HttpException(502, 'Unable to reach the authentication provider.', $exception);
        }
    }

    private function performAuthenticatedPostRequest(string $url, string $token): Response|PromiseInterface
    {
        $sanitizedToken = $this->normalizeToken($token);

        try {
            return $this->client()
                ->withToken($sanitizedToken)
                ->post($url);
        } catch (ConnectionException $exception) {
            Log::warning('Mat auth POST request failed to connect.', ['url' => $url]);

            throw new HttpException(502, 'Unable to reach the authentication provider.', $exception);
        }
    }

    private function normalizeToken(string $token): string
    {
        $sanitizedToken = trim($token);

        if ($sanitizedToken === '') {
            throw new HttpException(401, 'Authentication token is required.');
        }

        return $sanitizedToken;
    }

    private function throwForUpstreamFailure(string $action, int $status): never
    {
        Log::warning("Mat auth {$action} failed.", ['status' => $status]);

        if ($status === 401) {
            throw new HttpException(401, 'The authentication token is invalid or expired.');
        }

        throw new HttpException(502, "Authentication provider {$action} failed.");
    }

    private function client(): PendingRequest
    {
        return Http::acceptJson()
            ->withOptions([
                'verify' => $this->verifyTls,
            ]);
    }
}
