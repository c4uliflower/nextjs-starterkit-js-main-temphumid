<?php

it('validates batch sensor status update payloads', function (): void {
    $this->actingAs(apiTestUser(), 'mat-auth')
        ->postJson('/api/temphumid/sensors/status/batch', [
            'sensors' => [
                ['areaId' => 'P1F1-01', 'status' => 'Paused'],
            ],
        ])
        ->assertStatus(422)
        ->assertJsonValidationErrors(['sensors.0.status']);
});

it('validates batch sensor limit payloads', function (): void {
    $this->actingAs(apiTestUser(), 'mat-auth')
        ->postJson('/api/temphumid/sensors/limits/batch', [
            'sensors' => [
                [
                    'areaId' => 'P1F1-01',
                    'tempUL' => 'not-a-number',
                    'tempLL' => 18,
                    'humidUL' => 70,
                    'humidLL' => 40,
                ],
            ],
        ])
        ->assertStatus(422)
        ->assertJsonValidationErrors(['sensors.0.tempUL']);
});

it('validates facilities verify remarks for the others action type', function (): void {
    $this->actingAs(apiTestUser(), 'mat-auth')
        ->patchJson('/api/temphumid/facilities/alerts/123/verify', [
            'actionType' => 'others',
            'actionRemarks' => '',
        ])
        ->assertStatus(422)
        ->assertJsonValidationErrors(['actionRemarks']);
});
