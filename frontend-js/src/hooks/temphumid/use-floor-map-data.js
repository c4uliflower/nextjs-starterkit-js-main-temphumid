"use client";

import { useEffect, useState } from "react";

import { fetchSensorStatusByFloor } from "@/features/temphumid/shared/utils/api";
import { fetchCurrentReadingsByFloor } from "@/utils/api";
import { FLOOR_MAP_CONFIGS } from "@/utils/floor-map-configs";

// Copied from the current temp/humid floor-map route pages and consolidated as an additive scaffold.

const mapSensorsCacheByFloor = {};
const statusCacheByFloor = {};

const hasLiveData = (sensors) => sensors?.some((sensor) => sensor.hasData) ?? false;

function buildEditableSensors(mapSensors) {
  return mapSensors.map((sensor) => ({
    id: sensor.id,
    name: sensor.name,
    areaId: sensor.areaId,
    group: "Sensors",
  }));
}

export function useFloorMapData(floorKey) {
  const config = FLOOR_MAP_CONFIGS[floorKey];
  const mapSensorTemplate = config?.mapSensors ?? [];
  const inactiveAreas = config?.inactiveAreas ?? new Set([]);
  const editableSensors = buildEditableSensors(mapSensorTemplate);

  const [activeSensorIds, setActiveSensorIds] = useState(() => {
    const cachedStatuses = statusCacheByFloor[floorKey] ?? {};
    return new Set(mapSensorTemplate.filter((sensor) => cachedStatuses[sensor.id] !== "Inactive").map((sensor) => sensor.id));
  });

  const [selectedIds, setSelectedIds] = useState(() => {
    const cachedStatuses = statusCacheByFloor[floorKey] ?? {};
    return new Set(mapSensorTemplate.filter((sensor) => cachedStatuses[sensor.id] !== "Inactive").map((sensor) => sensor.id));
  });

  const [mapSensors, setMapSensors] = useState(mapSensorsCacheByFloor[floorKey] ?? mapSensorTemplate);
  const [loading, setLoading] = useState(!hasLiveData(mapSensorsCacheByFloor[floorKey] ?? []));

  const visibleSensors = mapSensors.filter((sensor) => activeSensorIds.has(sensor.id));
  const allIds = visibleSensors.map((sensor) => sensor.id);
  const allSelected = selectedIds.size === allIds.length && allIds.length > 0;
  const totalActiveCount = mapSensors.filter((sensor) => sensor.hasData).length;

  const recomputeActiveFromCache = () => {
    const cachedStatuses = statusCacheByFloor[floorKey] ?? {};
    const activeIds = new Set(mapSensorTemplate.filter((sensor) => cachedStatuses[sensor.id] !== "Inactive").map((sensor) => sensor.id));
    setActiveSensorIds(activeIds);
    setSelectedIds(activeIds);
  };

  useEffect(() => {
    let interval;

    const fetchReadings = async () => {
      try {
        const currentReadings = await fetchCurrentReadingsByFloor(floorKey);

        const newSensors = mapSensorTemplate.map((sensor) => {
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

        mapSensorsCacheByFloor[floorKey] = newSensors;
        setMapSensors(newSensors);
        if (hasLiveData(newSensors)) setLoading(false);

        if (Object.keys(statusCacheByFloor[floorKey] ?? {}).length === 0) {
          try {
            const statuses = await fetchSensorStatusByFloor(floorKey);
            const entries = statuses
              .map((status) => {
                const sensor = mapSensorTemplate.find((item) => item.areaId === status.areaId);
                return sensor ? [sensor.id, status.status] : null;
              })
              .filter(Boolean);

            statusCacheByFloor[floorKey] = Object.fromEntries(entries);
            recomputeActiveFromCache();
          } catch {
            statusCacheByFloor[floorKey] = Object.fromEntries(editableSensors.map((sensor) => [sensor.id, "Active"]));
            recomputeActiveFromCache();
          }
        }
      } catch (error) {
        console.error(`Failed to fetch ${floorKey} readings:`, error);
      }
    };

    fetchReadings();
    interval = setInterval(fetchReadings, 30_000);
    return () => clearInterval(interval);
  }, [floorKey]);

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
    loading,
    selectedIds,
    toggle,
    toggleAll,
    totalActiveCount,
    visibleSensors,
  };
}

