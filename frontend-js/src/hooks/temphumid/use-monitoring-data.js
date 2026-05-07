"use client";

import { useEffect, useRef, useState } from "react";

import { ALL_FLOORS, FLOOR_SLUG } from "@/utils/floors";
import {
  fetchFacilitiesAlerts,
  fetchSensorStatusByFloor,
  processFacilitiesReadings,
} from "@/features/temphumid/shared/utils/api";
import { fetchCurrentReadingsByFloor } from "@/utils/api";
import {
  getFacilitiesEscalatedCount,
} from "@/features/temphumid/facilities-alerts/utils/facilities";
import {
  INACTIVE_MONITORING_AREAS,
  MONITORING_STATUS_CACHE_TTL_MS,
  buildMonitoringTableData,
  hasMonitoringLiveData,
} from "@/utils/monitoring";
import { getFloorStatus } from "@/features/temphumid/sensor-status/utils/status";

// Copied from the current temp/humid monitoring route page as an additive scaffold.

let floorsCache = null;
let statusCache = {};
let statusCacheTime = 0;
let facilitiesAlertMapCache = new Map();

export function useMonitoringData() {
  const [floors, setFloors] = useState(floorsCache ?? ALL_FLOORS);
  const [activeFloor, setActiveFloor] = useState(null);
  const [loading, setLoading] = useState(
    !hasMonitoringLiveData(floorsCache ?? ALL_FLOORS)
  );
  const [delayedCount, setDelayedCount] = useState(0);
  const [facilitiesAlertMap, setFacilitiesAlertMap] = useState(
    () => new Map(facilitiesAlertMapCache)
  );
  const abortRef = useRef(null);

  const syncFacilitiesAlerts = async (signal) => {
    try {
      await processFacilitiesReadings();
      const alerts = await fetchFacilitiesAlerts(
        { status: ["open", "acknowledged", "verifying"] },
        { signal }
      );
      const next = new Map();
      alerts.forEach((alert) => {
        const current = next.get(alert.areaId);
        if (!current) {
          next.set(alert.areaId, { ...alert, duplicateCount: 1 });
          return;
        }

        next.set(alert.areaId, {
          ...current,
          canNotifyAgain: current.canNotifyAgain || alert.canNotifyAgain,
          duplicateCount: (current.duplicateCount ?? 1) + 1,
        });
      });
      facilitiesAlertMapCache = next;
      setFacilitiesAlertMap(new Map(next));
      setDelayedCount(getFacilitiesEscalatedCount(alerts));
    } catch {
      // Non-critical; preserve current state if sync fails.
    }
  };

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void syncFacilitiesAlerts();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, []);

  useEffect(() => {
    const handleStorage = (event) => {
      if (
        event.key === "facilitiesAlertSent" ||
        event.key === "facilitiesAlertResolved"
      ) {
        syncFacilitiesAlerts();
      }
    };

    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        syncFacilitiesAlerts();
      }
    };

    window.addEventListener("storage", handleStorage);
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      window.removeEventListener("storage", handleStorage);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, []);

  useEffect(() => {
    const fetchAllFloors = async () => {
      if (abortRef.current) abortRef.current.abort();
      abortRef.current = new AbortController();
      const signal = abortRef.current.signal;

      try {
        if (
          Object.keys(statusCache).length === 0 ||
          Date.now() - statusCacheTime > MONITORING_STATUS_CACHE_TTL_MS
        ) {
          const statusResults = await Promise.all(
            ALL_FLOORS.map((floor) =>
              fetchSensorStatusByFloor(FLOOR_SLUG[floor.id], { signal }).catch(() => [])
            )
          );

          statusCache = {};
          statusResults.flat().forEach((item) => {
            statusCache[item.areaId] = item.status;
          });
          statusCacheTime = Date.now();
          floorsCache = null;
        }

        await syncFacilitiesAlerts(signal);

        const results = await Promise.all(
          ALL_FLOORS.map((floor) =>
            fetchCurrentReadingsByFloor(FLOOR_SLUG[floor.id], { signal })
              .then((data) => ({ floorId: floor.id, data }))
              .catch((error) => {
                if (error?.name === "CanceledError") return null;
                return { floorId: floor.id, data: [] };
              })
          )
        );

        if (results.some((result) => result === null)) return;

        const liveByFloor = {};
        results.forEach(({ floorId, data }) => {
          liveByFloor[floorId] = {};
          data.forEach((item) => {
            liveByFloor[floorId][item.areaId] = item;
          });
        });

        const nextFloors = ALL_FLOORS.map((floor) => ({
          ...floor,
          sensors: floor.sensors
            .filter((sensor) => statusCache[sensor.areaId] !== "Inactive")
            .map((sensor) => {
              const live = liveByFloor[floor.id]?.[sensor.areaId];
              const isInactive = INACTIVE_MONITORING_AREAS.has(sensor.areaId);

              if (!live) {
                return {
                  ...sensor,
                  hasData: false,
                  breach: false,
                  temp: null,
                  humid: null,
                  lastSeen: null,
                  limits: null,
                };
              }

              const breach = live.status === "breach" && !isInactive;

              return {
                ...sensor,
                temp: live.temperature,
                humid: live.humidity,
                hasData: live.hasData,
                lastSeen: live.lastSeen,
                breach,
                limits: live.limits,
                tempUL: live.limits?.tempUL ?? null,
                tempLL: live.limits?.tempLL ?? null,
                humidUL: live.limits?.humidUL ?? null,
                humidLL: live.limits?.humidLL ?? null,
              };
            }),
        }));

        floorsCache = nextFloors;
        setFloors(nextFloors);
        if (hasMonitoringLiveData(nextFloors)) setLoading(false);
        setActiveFloor((previous) => {
          if (!previous) return null;
          return nextFloors.find((floor) => floor.id === previous.id) ?? previous;
        });
      } catch (error) {
        console.error("Failed to fetch monitoring data:", error);
      }
    };

    fetchAllFloors();
    const interval = setInterval(fetchAllFloors, 30_000);
    return () => {
      clearInterval(interval);
      if (abortRef.current) abortRef.current.abort();
    };
  }, []);

  const tableData = buildMonitoringTableData(floors);
  const breachFloorCount = floors.filter(
    (floor) => getFloorStatus(floor) === "breach"
  ).length;

  const markAreaForwarded = (areaId) => {
    const current = facilitiesAlertMapCache.get(areaId);
    const next = new Map(facilitiesAlertMapCache);
    next.set(areaId, {
      ...current,
      areaId,
      canNotifyAgain: false,
    });
    facilitiesAlertMapCache = next;
    setFacilitiesAlertMap(new Map(next));
  };

  return {
    activeFloor,
    breachFloorCount,
    delayedCount,
    facilitiesAlertMap,
    floors,
    loading,
    markAreaForwarded,
    setActiveFloor,
    tableData,
  };
}

