"use client";

import { useEffect, useState } from "react";

import { fetchSensorStatusByFloor } from "@/features/temphumid/shared/utils/api";
import { fetchCurrentReadingsByFloor } from "@/utils/api";
import { FLOOR_MAP_CONFIGS } from "@/utils/floor-map-configs";

// Copied from the current temp/humid p1f1 route page and kept additive.

const statusCacheByFloor = {};
const mapSensorsCacheByFloor = {};
const dessSensorsCacheByFloor = {};

const hasLiveData = (sensors) => sensors?.some((sensor) => sensor.hasData) ?? false;

export function useP1F1MapData() {
  const config = FLOOR_MAP_CONFIGS.p1f1;
  const mapSensorTemplate = config.mapSensors;
  const dessicatorTemplate = config.dessicatorSensors ?? [];
  const inactiveAreas = config.inactiveAreas ?? new Set([]);
  const allSensors = [...mapSensorTemplate, ...dessicatorTemplate];
  const allEditableSensors = [
    ...mapSensorTemplate.map((sensor) => ({ id: sensor.id, areaId: sensor.areaId, group: "Sensors" })),
    ...dessicatorTemplate.map((sensor) => ({ id: sensor.id, areaId: sensor.areaId, group: "Dessicators" })),
  ];

  const [activeSensorIds, setActiveSensorIds] = useState(
    () => new Set(allSensors.filter((sensor) => (statusCacheByFloor.p1f1 ?? {})[sensor.id] !== "Inactive").map((sensor) => sensor.id))
  );
  const [selectedIds, setSelectedIds] = useState(() => new Set(mapSensorTemplate.map((sensor) => sensor.id)));
  const [dessOpen, setDessOpen] = useState(false);
  const [mapSensors, setMapSensors] = useState(mapSensorsCacheByFloor.p1f1 ?? mapSensorTemplate);
  const [dessSensors, setDessSensors] = useState(dessSensorsCacheByFloor.p1f1 ?? dessicatorTemplate);
  const [loading, setLoading] = useState(!hasLiveData(mapSensorsCacheByFloor.p1f1 ?? []));

  const visibleSensors = mapSensors.filter((sensor) => activeSensorIds.has(sensor.id));
  const visibleDessSensors = dessSensors.filter((sensor) => activeSensorIds.has(sensor.id));

  const allIds = visibleSensors.map((sensor) => sensor.id);
  const allSelected = selectedIds.size === allIds.length;
  const totalActiveCount = mapSensors.filter((sensor) => sensor.hasData).length;

  useEffect(() => {
    let interval;

    const fetchReadings = async () => {
      try {
        const currentReadings = await fetchCurrentReadingsByFloor("p1f1");

        const merge = (sensors) =>
          sensors.map((sensor) => {
            const live = currentReadings.find((reading) => reading.areaId === sensor.areaId);
            if (!live) return sensor;

            const activeLocation = !inactiveAreas.has(sensor.areaId);
            let status = live.status;
            if (status === "breach" && !activeLocation) status = "inactive-breach";

            return {
              ...sensor,
              temp: live.temperature,
              humid: live.humidity,
              hasData: live.hasData,
              lastSeen: live.lastSeen,
              activeLocation,
              status,
              limits: live.limits,
            };
          });

        const newMapSensors = merge(mapSensorTemplate);
        const newDessicatorSensors = merge(dessicatorTemplate);

        mapSensorsCacheByFloor.p1f1 = newMapSensors;
        dessSensorsCacheByFloor.p1f1 = newDessicatorSensors;
        setMapSensors(newMapSensors);
        setDessSensors(newDessicatorSensors);

        if (hasLiveData(newMapSensors) || hasLiveData(newDessicatorSensors)) setLoading(false);

        if (Object.keys(statusCacheByFloor.p1f1 ?? {}).length === 0) {
          try {
            const statuses = await fetchSensorStatusByFloor("p1f1");
            const entries = statuses
              .map((status) => {
                const sensor = allSensors.find((item) => item.areaId === status.areaId);
                return sensor ? [sensor.id, status.status] : null;
              })
              .filter(Boolean);

            statusCacheByFloor.p1f1 = Object.fromEntries(entries);
            setActiveSensorIds(
              new Set(allSensors.filter((sensor) => statusCacheByFloor.p1f1[sensor.id] !== "Inactive").map((sensor) => sensor.id))
            );
          } catch {
            statusCacheByFloor.p1f1 = Object.fromEntries(allEditableSensors.map((sensor) => [sensor.id, "Active"]));
          }
        }
      } catch (error) {
        console.error("Failed to fetch P1F1 readings:", error);
      }
    };

    fetchReadings();
    interval = setInterval(fetchReadings, 30_000);
    return () => clearInterval(interval);
  }, []);

  const toggle = (id) =>
    setSelectedIds((previous) => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const toggleAll = () => setSelectedIds(allSelected ? new Set() : new Set(allIds));

  return {
    allSelected,
    dessOpen,
    dessicatorTemplate,
    loading,
    selectedIds,
    setDessOpen,
    toggle,
    toggleAll,
    totalActiveCount,
    visibleDessSensors,
    visibleSensors,
  };
}

