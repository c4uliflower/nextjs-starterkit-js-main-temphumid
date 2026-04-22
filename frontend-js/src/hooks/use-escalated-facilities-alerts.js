"use client";

import { useState, useEffect, useCallback } from "react";
import axios from "@/lib/axios";

const API_BASE = "/api/temphumid";
const ESCALATION_THRESHOLD_MINS = 120;
const POLL_INTERVAL_MS = 60_000; // 1 minute

function minutesSince(isoString) {
  if (!isoString) return 0;
  const d = isoString.includes("Z") || isoString.includes("+")
    ? new Date(isoString)
    : new Date(isoString.replace(" ", "T") + "+08:00");
  return Math.floor((Date.now() - d.getTime()) / 60000);
}

/**
 * Polls acknowledged facilities alerts every 60s independently of the
 * facilities dashboard page. Returns only alerts that have crossed the
 * 2-hour escalation threshold.
 */
export function useEscalatedFacilitiesAlerts() {
  const [escalated, setEscalated] = useState([]);
  const [loading,   setLoading]   = useState(true);

  const fetchAndFilter = useCallback(async () => {
    try {
      const res = await axios.get(`${API_BASE}/facilities/alerts`, {
        params: { status: "acknowledged" },
      });

      const alerts = res.data?.data ?? [];
      const filtered = alerts.filter(
        (a) => minutesSince(a.acknowledgedAt) >= ESCALATION_THRESHOLD_MINS
      );

      // Attach computed delay info for display
      const enriched = filtered.map((a) => {
        const mins            = minutesSince(a.acknowledgedAt);
        const thresholdCount  = Math.floor(mins / ESCALATION_THRESHOLD_MINS);
        const delayedHours    = thresholdCount * (ESCALATION_THRESHOLD_MINS / 60);
        return { ...a, delayedHours };
      });

      setEscalated(enriched);
    } catch {
      // Non-critical — silently fail, keep stale data
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