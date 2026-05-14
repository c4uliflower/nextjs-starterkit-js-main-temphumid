"use client";

import { useCallback, useEffect, useRef, useState } from "react";

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
  isValueOutOfSpec,
} from "@/utils/monitoring";
import { getFloorStatus } from "@/features/temphumid/sensor-status/utils/status";

// Copied from the current temp/humid monitoring route page as an additive scaffold.

let floorsCache = null;
let statusCache = {};
let statusCacheTime = 0;
let facilitiesAlertsCache = [];
let facilitiesAlertMapCache = new Map();
let maintenanceAreaIdsCache = new Set();
let repairAreaIdsCache = new Set();

export function useMonitoringData() {
  const [floors, setFloors] = useState(floorsCache ?? ALL_FLOORS);
  const [activeFloor, setActiveFloor] = useState(null);
  const [loading, setLoading] = useState(
    !hasMonitoringLiveData(floorsCache ?? ALL_FLOORS)
  );
  const [delayedCount, setDelayedCount] = useState(() =>
    getFacilitiesEscalatedCount(facilitiesAlertsCache)
  );
  const [maintenanceAreaIds, setMaintenanceAreaIds] = useState(
    () => new Set(maintenanceAreaIdsCache)
  );
  const [repairAreaIds, setRepairAreaIds] = useState(
    () => new Set(repairAreaIdsCache)
  );
  const [facilitiesAlertMap, setFacilitiesAlertMap] = useState(
    () => new Map(facilitiesAlertMapCache)
  );
  const abortRef = useRef(null);

  const syncFacilitiesAlerts = useCallback(async (signal) => {
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
      const nextDelayedCount = getFacilitiesEscalatedCount(alerts);
      facilitiesAlertsCache = alerts;
      facilitiesAlertMapCache = next;
      setFacilitiesAlertMap(new Map(next));
      setDelayedCount(nextDelayedCount);
      return alerts;
    } catch {
      // Non-critical; preserve current state if sync fails.
      return facilitiesAlertsCache;
    }
  }, []);

  const syncOngoingWork = useCallback((activeAlerts = []) => {
    const nextMaintenanceAreaIds = new Set();
    const nextRepairAreaIds = new Set();

    activeAlerts.forEach((alert) => {
      if (!["open", "verifying"].includes(alert.status) || !alert.areaId) return;

      if (alert.actionType === "maintenance") {
        nextMaintenanceAreaIds.add(alert.areaId);
      }

      if (alert.actionType === "repair") {
        nextRepairAreaIds.add(alert.areaId);
      }
    });

    maintenanceAreaIdsCache = nextMaintenanceAreaIds;
    repairAreaIdsCache = nextRepairAreaIds;
    setMaintenanceAreaIds(new Set(nextMaintenanceAreaIds));
    setRepairAreaIds(new Set(nextRepairAreaIds));
  }, []);

  const fetchAllFloors = useCallback(async () => {
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

      const activeAlerts = await syncFacilitiesAlerts(signal);
      syncOngoingWork(activeAlerts);

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
  }, [syncFacilitiesAlerts, syncOngoingWork]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void syncFacilitiesAlerts().then((activeAlerts) =>
        syncOngoingWork(activeAlerts)
      );
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [syncFacilitiesAlerts, syncOngoingWork]);

  useEffect(() => {
    const handleStorage = (event) => {
      if (
        event.key === "facilitiesAlertSent" ||
        event.key === "facilitiesAlertResolved"
      ) {
        syncFacilitiesAlerts().then((activeAlerts) => syncOngoingWork(activeAlerts));
      }
    };

    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        syncFacilitiesAlerts().then((activeAlerts) => syncOngoingWork(activeAlerts));
      }
    };

    window.addEventListener("storage", handleStorage);
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      window.removeEventListener("storage", handleStorage);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [syncFacilitiesAlerts, syncOngoingWork]);

  useEffect(() => {
    fetchAllFloors();
    const interval = setInterval(fetchAllFloors, 30_000);
    return () => {
      clearInterval(interval);
      if (abortRef.current) abortRef.current.abort();
    };
  }, [fetchAllFloors]);

  const tableData = buildMonitoringTableData(floors);
  const breachFloorCount = floors.filter(
    (floor) => getFloorStatus(floor) === "breach"
  ).length;
  const ongoingAreaIds = new Set([...maintenanceAreaIds, ...repairAreaIds]);
  const sensorStats = floors.reduce(
    (stats, floor) => {
      floor.sensors.forEach((sensor) => {
        stats.total += 1;
        const tempOutOfSpec = isValueOutOfSpec(sensor.temp, sensor.tempLL, sensor.tempUL);
        const humidOutOfSpec = isValueOutOfSpec(sensor.humid, sensor.humidLL, sensor.humidUL);

        if (tempOutOfSpec) stats.tempOutOfSpec += 1;
        if (humidOutOfSpec) stats.humidOutOfSpec += 1;

        if (sensor.breach) {
          stats.breach += 1;
          return;
        }
        if (!sensor.hasData) {
          stats.noData += 1;
          return;
        }
        if (sensor.hasData && !ongoingAreaIds.has(sensor.areaId)) stats.stable += 1;
      });

      return stats;
    },
    { total: 0, stable: 0, noData: 0, breach: 0, tempOutOfSpec: 0, humidOutOfSpec: 0 }
  );

  const markAreaForwarded = (areaId, alert = null) => {
    const current = facilitiesAlertMapCache.get(areaId);
    const next = new Map(facilitiesAlertMapCache);
    next.set(areaId, {
      ...current,
      ...alert,
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
    monitoringStats: {
      ...sensorStats,
      maintenance: maintenanceAreaIds.size,
      repair: repairAreaIds.size,
      ongoingAreaIds,
      maintenanceAreaIds,
      repairAreaIds,
    },
    refresh: fetchAllFloors,
    setActiveFloor,
    tableData,
  };
}

