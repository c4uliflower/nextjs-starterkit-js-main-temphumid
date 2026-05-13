"use client";

import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { simulateDevSensorReading } from "@/features/temphumid/shared/utils/api";

// DEV_READING_SIMULATOR_REMOVE_BEFORE_PROD: delete this whole component before shipping.
const DEV_SIMULATOR_ENABLED = process.env.NODE_ENV === "development";
const DEFAULT_AREA_ID = "P1F1-04";

function toReadingNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function midpoint(lower, upper, fallback) {
  const low = Number(lower);
  const high = Number(upper);

  if (Number.isFinite(low) && Number.isFinite(high)) {
    return Number(((low + high) / 2).toFixed(2));
  }

  return fallback;
}

function breachValue(upper, fallback) {
  const high = Number(upper);
  return Number.isFinite(high) ? Number((high + 5).toFixed(2)) : fallback;
}

export function DevReadingSimulator({ floors, onSimulated }) {
  const sensors = useMemo(
    () =>
      floors
        .flatMap((floor) =>
          floor.sensors.map((sensor) => ({
            ...sensor,
            floorLabel: floor.label,
          }))
        )
        .filter((sensor) => sensor.hasData && sensor.tempUL != null && sensor.humidUL != null),
    [floors]
  );

  const defaultSensor = sensors.find((sensor) => sensor.areaId === DEFAULT_AREA_ID) ?? sensors[0];
  const [areaId, setAreaId] = useState(defaultSensor?.areaId ?? DEFAULT_AREA_ID);
  const selectedSensor = sensors.find((sensor) => sensor.areaId === areaId) ?? defaultSensor;
  const [temperature, setTemperature] = useState(selectedSensor?.temp ?? 25);
  const [humidity, setHumidity] = useState(selectedSensor?.humid ?? 50);
  const [status, setStatus] = useState("idle");

  if (!DEV_SIMULATOR_ENABLED || sensors.length === 0) return null;

  const syncToSensor = (nextAreaId) => {
    setAreaId(nextAreaId);
    const sensor = sensors.find((item) => item.areaId === nextAreaId);

    if (!sensor) return;

    setTemperature(sensor.temp ?? midpoint(sensor.tempLL, sensor.tempUL, 25));
    setHumidity(sensor.humid ?? midpoint(sensor.humidLL, sensor.humidUL, 50));
  };

  const setStablePreset = () => {
    if (!selectedSensor) return;

    setTemperature(midpoint(selectedSensor.tempLL, selectedSensor.tempUL, 25));
    setHumidity(midpoint(selectedSensor.humidLL, selectedSensor.humidUL, 50));
  };

  const setBreachPreset = () => {
    if (!selectedSensor) return;

    setTemperature(breachValue(selectedSensor.tempUL, 40));
    setHumidity(breachValue(selectedSensor.humidUL, 85));
  };

  const submitReading = async () => {
    if (!selectedSensor) return;

    setStatus("saving");

    try {
      await simulateDevSensorReading({
        areaId: selectedSensor.areaId,
        temperature: toReadingNumber(temperature, selectedSensor.temp ?? 25),
        humidity: toReadingNumber(humidity, selectedSensor.humid ?? 50),
      });

      setStatus("saved");
      await onSimulated?.();
      window.setTimeout(() => setStatus("idle"), 1800);
    } catch (error) {
      console.error("Dev reading simulation failed:", error);
      setStatus("error");
    }
  };

  return (
    <div
      style={{
        margin: "0 24px 8px",
        padding: "12px",
        border: "1px dashed #dc3545",
        borderRadius: 5,
        background: "var(--card)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <strong style={{ fontSize: 13, color: "#dc3545" }}>Dev Reading Simulator</strong>
        <select
          value={selectedSensor?.areaId ?? areaId}
          onChange={(event) => syncToSensor(event.target.value)}
          style={{
            height: 36,
            minWidth: 260,
            border: "1px solid var(--border)",
            borderRadius: 5,
            padding: "0 8px",
            background: "var(--background)",
          }}
        >
          {sensors.map((sensor) => (
            <option key={sensor.areaId} value={sensor.areaId}>
              {sensor.areaId} - {sensor.name} ({sensor.floorLabel})
            </option>
          ))}
        </select>
        <Input
          aria-label="Simulated temperature"
          type="number"
          step="0.01"
          value={temperature}
          onChange={(event) => setTemperature(event.target.value)}
          className="h-9 w-24"
        />
        <span className="text-sm text-muted-foreground">C</span>
        <Input
          aria-label="Simulated humidity"
          type="number"
          step="0.01"
          value={humidity}
          onChange={(event) => setHumidity(event.target.value)}
          className="h-9 w-24"
        />
        <span className="text-sm text-muted-foreground">%</span>
        <Button type="button" variant="outline" size="sm" onClick={setStablePreset}>
          Stable
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={setBreachPreset}>
          Breach
        </Button>
        <Button type="button" size="sm" onClick={submitReading} disabled={status === "saving"}>
          {status === "saving" ? "Writing..." : "Write Reading"}
        </Button>
        {status === "saved" && <span className="text-sm text-green-700">Inserted and processed</span>}
        {status === "error" && <span className="text-sm text-red-700">Simulation failed</span>}
      </div>
    </div>
  );
}
