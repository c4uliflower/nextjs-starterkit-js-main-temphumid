"use client";

import { useEffect, useRef, useState } from "react";

import { ALL_FLOORS, FLOOR_SLUG } from "@/utils/floors";
import {
  fetchDowntimeActive,
  fetchFacilitiesAlerts,
  fetchSensorStatusByFloor,
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
let forwardedAreaIdsCache = new Set();

export function useMonitoringData() {
  const [floors, setFloors] = useState(floorsCache ?? ALL_FLOORS);
  const [activeFloor, setActiveFloor] = useState(null);
  const [loading, setLoading] = useState(
    !hasMonitoringLiveData(floorsCache ?? ALL_FLOORS)
  );
  const [delayedCount, setDelayedCount] = useState(0);
  const [forwardedAreaIds, setForwardedAreaIds] = useState(
    () => new Set(forwardedAreaIdsCache)
  );
  const abortRef = useRef(null);

  const syncForwardedAreaIds = async (signal) => {
    try {
      const alerts = await fetchFacilitiesAlerts(
        { status: ["open", "acknowledged", "verifying"] },
        { signal }
      );
      const next = new Set(alerts.map((alert) => alert.areaId));
      forwardedAreaIdsCache = next;
      setForwardedAreaIds(new Set(next));
    } catch {
      // Non-critical; preserve current state if sync fails.
    }
  };

  const syncDelayedCount = async (signal) => {
    try {
      const alerts = await fetchFacilitiesAlerts({ status: ["acknowledged"] }, { signal });
      setDelayedCount(getFacilitiesEscalatedCount(alerts));
    } catch {
      // Non-critical.
    }
  };

  useEffect(() => {
    syncForwardedAreaIds();
    syncDelayedCount();
  }, []);

  useEffect(() => {
    const handleStorage = (event) => {
      if (
        event.key === "facilitiesAlertSent" ||
        event.key === "facilitiesAlertResolved"
      ) {
        syncForwardedAreaIds();
        syncDelayedCount();
      }
    };

    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        syncForwardedAreaIds();
        syncDelayedCount();
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

        await syncForwardedAreaIds(signal);
        await syncDelayedCount(signal);

        const downtime = await fetchDowntimeActive({ signal }).catch((error) => {
          if (error?.name === "CanceledError") return null;
          return [];
        });
        if (downtime === null) return;

        const downtimeByArea = {};
        downtime.forEach((item) => {
          downtimeByArea[item.area_id] = item;
        });

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
              const downtimeRecord = downtimeByArea[sensor.areaId] ?? null;
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
                  maintenanceOngoing: !!downtimeRecord,
                  maintenanceStartedAt: downtimeRecord?.processed_at ?? null,
                  maintenanceRecordId: downtimeRecord?.id ?? null,
                };
              }

              const breach =
                live.status === "breach" && !isInactive && !downtimeRecord;

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
                maintenanceOngoing: !!downtimeRecord,
                maintenanceStartedAt: downtimeRecord?.processed_at ?? null,
                maintenanceRecordId: downtimeRecord?.id ?? null,
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
    forwardedAreaIdsCache = new Set(forwardedAreaIdsCache).add(areaId);
    setForwardedAreaIds(new Set(forwardedAreaIdsCache));
  };

  return {
    activeFloor,
    breachFloorCount,
    delayedCount,
    floors,
    forwardedAreaIds,
    loading,
    markAreaForwarded,
    setActiveFloor,
    tableData,
  };
}

