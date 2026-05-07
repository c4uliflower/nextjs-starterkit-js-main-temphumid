"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  ESCALATION_THRESHOLD_MINS,
  buildFacilitiesStats,
  getFacilitiesEscalatedCount,
} from "@/features/temphumid/facilities-alerts/utils/facilities";
import {
  escalateFacilitiesAlert,
  fetchDowntimeActive,
  fetchFacilitiesAlerts,
  processFacilitiesReadings,
  processFacilitiesVerifying,
} from "@/features/temphumid/shared/utils/api";
import { minutesSince, parseUTC } from "@/utils/time";

// Copied from the current temp/humid facilities route page as an additive scaffold.

let alertsCache = null;

export function useFacilitiesDashboard() {
  const [alerts, setAlerts] = useState(alertsCache || []);
  const [loading, setLoading] = useState(alertsCache === null);
  const [fetchError, setFetchError] = useState(null);
  const [selectedResolved, setSelectedResolved] = useState(null);

  const processVerifyingAlerts = useCallback(async (currentAlerts) => {
    const verifying = currentAlerts.filter((alert) => alert.status === "verifying");
    if (verifying.length === 0) return false;
    try {
      const updated = await processFacilitiesVerifying();
      return Array.isArray(updated) && updated.length > 0;
    } catch {
      return false;
    }
  }, []);

  const processReadings = useCallback(async () => {
    try {
      await processFacilitiesReadings();
    } catch {
      // Non-critical.
    }
  }, []);

  const fetchAlerts = useCallback(async () => {
    try {
      if (!alertsCache) setLoading(true);

      let nextAlerts = await fetchFacilitiesAlerts();

      const didUpdateVerifying = await processVerifyingAlerts(nextAlerts);
      await processReadings();

      if (didUpdateVerifying) {
        nextAlerts = await fetchFacilitiesAlerts();
      }

      const downtime = await fetchDowntimeActive().catch(() => []);
      const downtimeByArea = {};
      downtime.forEach((item) => {
        downtimeByArea[item.area_id] = item;
      });

      const enrichedAlerts = nextAlerts.map((alert) => ({
        ...alert,
        maintenanceOngoing: !!downtimeByArea[alert.areaId],
        maintenanceStartedAt: downtimeByArea[alert.areaId]?.processed_at ?? null,
      }));

      setAlerts(enrichedAlerts);
      alertsCache = enrichedAlerts;
      setFetchError(null);
    } catch {
      setFetchError("Failed to load alerts. Please refresh.");
    } finally {
      setLoading(false);
    }
  }, [processReadings, processVerifyingAlerts]);

  useEffect(() => {
    if (alertsCache !== null) setLoading(false);
    else setLoading(true);
    fetchAlerts();
  }, [fetchAlerts]);

  useEffect(() => {
    const interval = setInterval(fetchAlerts, 30_000);
    return () => clearInterval(interval);
  }, [fetchAlerts]);

  useEffect(() => {
    const handleStorage = (event) => {
      if (event.key === "facilitiesAlertSent") {
        alertsCache = null;
        fetchAlerts();
      }
    };
    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        try {
          const sent = localStorage.getItem("facilitiesAlertSent");
          if (
            sent &&
            (!alertsCache ||
              Number(sent) >
                (parseUTC(alertsCache[alertsCache.length - 1]?.acknowledgedAt)?.getTime() ??
                  0))
          ) {
            fetchAlerts();
          }
        } catch {}
      }
    };

    window.addEventListener("storage", handleStorage);
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      window.removeEventListener("storage", handleStorage);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [fetchAlerts]);

  const acknowledgedAlerts = useMemo(
    () =>
      alerts
        .filter((alert) => alert.status === "acknowledged")
        .sort((left, right) => parseUTC(left.acknowledgedAt) - parseUTC(right.acknowledgedAt)),
    [alerts]
  );
  const openAlerts = useMemo(
    () =>
      alerts
        .filter((alert) => alert.status === "open" || alert.status === "verifying")
        .sort((left, right) => parseUTC(left.acknowledgedAt) - parseUTC(right.acknowledgedAt)),
    [alerts]
  );
  const resolvedAlerts = useMemo(
    () =>
      alerts
        .filter((alert) => alert.status === "resolved")
        .sort((left, right) => parseUTC(right.resolvedAt) - parseUTC(left.resolvedAt)),
    [alerts]
  );

  const escalatedCount = useMemo(
    () => getFacilitiesEscalatedCount(alerts.filter((alert) => alert.status !== "resolved")),
    [alerts]
  );
  const escalatableAlerts = useMemo(
    () =>
      alerts.filter(
        (alert) =>
          (alert.status === "acknowledged" || alert.status === "open") &&
          !(alert.actionType === "maintenance" || alert.actionType === "repair")
      ),
    [alerts]
  );
  const stats = useMemo(
    () =>
      buildFacilitiesStats({
        acknowledgedCount: acknowledgedAlerts.length,
        escalatedCount,
        openCount: openAlerts.length,
        resolvedCount: resolvedAlerts.length,
      }),
    [acknowledgedAlerts.length, escalatedCount, openAlerts.length, resolvedAlerts.length]
  );

  const handleAcknowledge = useCallback(() => fetchAlerts(), [fetchAlerts]);
  const handleResolve = useCallback(
    (updatedAlert) => {
      setAlerts((previous) => {
        const next = previous.map((alert) =>
          alert.id === updatedAlert.id
            ? {
                ...alert,
                ...updatedAlert,
                maintenanceOngoing: alert.maintenanceOngoing,
                maintenanceStartedAt: alert.maintenanceStartedAt,
              }
            : alert
        );
        alertsCache = next;
        return next;
      });

      if (updatedAlert.status === "resolved") {
        try {
          localStorage.setItem("facilitiesAlertResolved", String(Date.now()));
        } catch {}
      }

      fetchAlerts();
    },
    [fetchAlerts]
  );
  const handleConflict = useCallback(() => fetchAlerts(), [fetchAlerts]);

  const alertsByCol = useMemo(
    () => ({ acknowledged: acknowledgedAlerts, open: openAlerts }),
    [acknowledgedAlerts, openAlerts]
  );

  const firedThresholds = useRef({});
  const isMounted = useRef(false);

  useEffect(() => {
    const checkEscalations = () => {
      escalatableAlerts.forEach((alert) => {
        const mins = minutesSince(alert.acknowledgedAt);
        const threshold = Math.floor(mins / ESCALATION_THRESHOLD_MINS);
        if (threshold >= 1) {
          const prev = firedThresholds.current[alert.id] ?? 0;
          if (threshold > prev) {
            firedThresholds.current[alert.id] = threshold;
            if (isMounted.current) {
              escalateFacilitiesAlert(alert.id, {
                escalationCount: threshold,
              })
                .then((updated) => {
                  setAlerts((previous) => {
                    const next = previous.map((item) =>
                      item.id === updated.id ? updated : item
                    );
                    alertsCache = next;
                    return next;
                  });
                })
                .catch(() => {
                  firedThresholds.current[alert.id] = prev;
                });
            }
          }
        }
      });
    };

    checkEscalations();
    isMounted.current = true;
    const interval = setInterval(checkEscalations, 60_000);
    return () => {
      clearInterval(interval);
      isMounted.current = false;
    };
  }, [escalatableAlerts]);

  useEffect(() => {
    const activeIds = new Set(escalatableAlerts.map((alert) => alert.id));
    Object.keys(firedThresholds.current).forEach((id) => {
      if (!activeIds.has(Number(id))) delete firedThresholds.current[id];
    });
  }, [escalatableAlerts]);

  return {
    acknowledgedAlerts,
    alerts,
    alertsByCol,
    escalatedCount,
    fetchError,
    handleAcknowledge,
    handleConflict,
    handleResolve,
    loading,
    openAlerts,
    resolvedAlerts,
    selectedResolved,
    stats,
    setSelectedResolved,
  };
}

