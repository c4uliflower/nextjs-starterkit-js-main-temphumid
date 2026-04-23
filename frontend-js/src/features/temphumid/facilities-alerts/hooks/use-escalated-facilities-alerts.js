"use client";

import { useState, useEffect, useCallback } from "react";
import axios from "@/lib/axios";

// Copied from src/hooks/use-escalated-facilities-alerts.js as an additive scaffold.

const API_BASE = "/api/temphumid";
const ESCALATION_THRESHOLD_MINS = 120;
const POLL_INTERVAL_MS = 60_000;

function minutesSince(isoString) {
  if (!isoString) return 0;
  const date = isoString.includes("Z") || isoString.includes("+")
    ? new Date(isoString)
    : new Date(isoString.replace(" ", "T") + "+08:00");

  return Math.floor((Date.now() - date.getTime()) / 60000);
}

export function useEscalatedFacilitiesAlerts() {
  const [escalated, setEscalated] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchAndFilter = useCallback(async () => {
    try {
      const response = await axios.get(`${API_BASE}/facilities/alerts`, {
        params: { status: "acknowledged" },
      });

      const alerts = response.data?.data ?? [];
      const filtered = alerts.filter(
        (alert) => minutesSince(alert.acknowledgedAt) >= ESCALATION_THRESHOLD_MINS
      );

      const enriched = filtered.map((alert) => {
        const mins = minutesSince(alert.acknowledgedAt);
        const thresholdCount = Math.floor(mins / ESCALATION_THRESHOLD_MINS);
        const delayedHours = thresholdCount * (ESCALATION_THRESHOLD_MINS / 60);
        return { ...alert, delayedHours };
      });

      setEscalated(enriched);
    } catch {
      // Non-critical; preserve stale data.
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAndFilter();
    const interval = setInterval(fetchAndFilter, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [fetchAndFilter]);

  return { escalated, loading, count: escalated.length };
}
