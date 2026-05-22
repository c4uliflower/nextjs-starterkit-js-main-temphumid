"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  ESCALATION_THRESHOLD_MINS,
  buildFacilitiesStats,
  getFacilitiesEscalatedCount,
  isFacilitiesDelayActionable,
} from "@/features/temphumid/facilities-alerts/utils/facilities";
import {
  escalateFacilitiesAlert,
  fetchDowntimeActive,
  fetchFacilitiesAlerts,
} from "@/features/temphumid/shared/utils/api";
import { minutesSince, parseUTC } from "@/utils/time";

// Copied from the current temp/humid facilities route page as an additive scaffold.

let alertsCache = null;

function readSentAlertPayload() {
  try {
    const raw = localStorage.getItem("facilitiesAlertSentPayload");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function mergeAlert(alerts, incomingAlert) {
  if (!incomingAlert?.id) return alerts;

  const exists = alerts.some((alert) => alert.id === incomingAlert.id);
  if (exists) {
    return alerts.map((alert) =>
      alert.id === incomingAlert.id ? { ...alert, ...incomingAlert } : alert
    );
  }

  return [incomingAlert, ...alerts];
}

export function useFacilitiesDashboard() {
  const [alerts, setAlerts] = useState(alertsCache || []);
  const [loading, setLoading] = useState(alertsCache === null);
  const [fetchError, setFetchError] = useState(null);
  const [selectedResolved, setSelectedResolved] = useState(null);

  const fetchAlerts = useCallback(async () => {
    try {
      if (!alertsCache) setLoading(true);

      const nextAlerts = await fetchFacilitiesAlerts();

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
  }, []);

  const applyIncomingAlert = useCallback((incomingAlert) => {
    if (!incomingAlert?.id) return false;

    setAlerts((previous) => {
      const next = mergeAlert(previous, incomingAlert);
      alertsCache = mergeAlert(alertsCache ?? [], incomingAlert);
      return next;
    });
    setLoading(false);
    setFetchError(null);
    try {
      localStorage.removeItem("facilitiesAlertSentPayload");
    } catch {}
    return true;
  }, []);

  useEffect(() => {
    if (alertsCache !== null) setLoading(false);
    else setLoading(true);
    applyIncomingAlert(readSentAlertPayload());
    fetchAlerts();
  }, [applyIncomingAlert, fetchAlerts]);

  useEffect(() => {
    const interval = setInterval(fetchAlerts, 30_000);
    return () => clearInterval(interval);
  }, [fetchAlerts]);

  useEffect(() => {
    const handleStorage = (event) => {
      if (event.key === "facilitiesAlertSent") {
        const incomingAlert = readSentAlertPayload();
        if (!applyIncomingAlert(incomingAlert)) {
          alertsCache = null;
          fetchAlerts();
        }
      }
    };
    const handleAlertSent = (event) => {
      if (!applyIncomingAlert(event.detail)) {
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
    window.addEventListener("facilitiesAlertSent", handleAlertSent);
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener("facilitiesAlertSent", handleAlertSent);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [applyIncomingAlert, fetchAlerts]);

  const acknowledgedAlerts = useMemo(
    () =>
      alerts
        .filter((alert) => alert.status === "acknowledged" && !isFacilitiesDelayActionable(alert))
        .sort((left, right) => parseUTC(left.acknowledgedAt) - parseUTC(right.acknowledgedAt)),
    [alerts]
  );
  const delayedAlerts = useMemo(
    () =>
      alerts
        .filter(isFacilitiesDelayActionable)
        .sort((left, right) => parseUTC(left.acknowledgedAt) - parseUTC(right.acknowledgedAt)),
    [alerts]
  );
  const openAlerts = useMemo(
    () =>
      alerts
        .filter(
          (alert) =>
            (alert.status === "open" || alert.status === "verifying") &&
            !isFacilitiesDelayActionable(alert)
        )
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

  const applyUpdatedAlert = useCallback((updatedAlert) => {
    if (!updatedAlert) return;

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
  }, []);

  const handleAcknowledge = useCallback(
    (updatedAlert) => {
      applyUpdatedAlert(updatedAlert);
    },
    [applyUpdatedAlert]
  );
  const handleResolve = useCallback(
    (updatedAlert) => {
      applyUpdatedAlert(updatedAlert);
      if (updatedAlert.status === "resolved") {
        try {
          localStorage.setItem("facilitiesAlertResolved", String(Date.now()));
        } catch {}
      }
    },
    [applyUpdatedAlert]
  );
  const handleConflict = useCallback(() => fetchAlerts(), [fetchAlerts]);

  const alertsByCol = useMemo(
    () => ({ acknowledged: acknowledgedAlerts, delayed: delayedAlerts, open: openAlerts }),
    [acknowledgedAlerts, delayedAlerts, openAlerts]
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
    delayedAlerts,
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

