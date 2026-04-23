"use client";

import { memo, useEffect, useState } from "react";
import { Droplets, Radio, Thermometer, TriangleAlert } from "lucide-react";

import { DashboardCard } from "@/components/custom/DashboardCard";
import { fetchDashboardSummary } from "@/utils/api";
import { dailyCache } from "@/utils/daily";

export const DailyStatCards = memo(function DailyStatCards({ onFirstLoad }) {
  const [summary, setSummary] = useState(
    dailyCache.summary ?? {
      avgTemperature: null,
      avgHumidity: null,
      activeSensorCount: null,
      breachCount: null,
    }
  );

  useEffect(() => {
    let isFirst = !dailyCache.summary;

    const fetchSummary = async () => {
      try {
        const nextSummary = await fetchDashboardSummary();
        dailyCache.summary = nextSummary;
        setSummary(nextSummary);
      } catch (error) {
        console.error("Failed to fetch dashboard summary:", error);
      } finally {
        if (isFirst) {
          isFirst = false;
          onFirstLoad?.();
        }
      }
    };

    if (dailyCache.summary) onFirstLoad?.();
    fetchSummary();
    const interval = setInterval(fetchSummary, 30_000);
    return () => clearInterval(interval);
  }, [onFirstLoad]);

  const formatTemp = (value) => (value != null ? `${value}°C` : "—");
  const formatHumid = (value) => (value != null ? `${value}%` : "—");
  const formatCount = (value) => (value != null ? String(value) : "—");

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <DashboardCard
        value={formatTemp(summary.avgTemperature)}
        label="Avg. Temperature"
        icon={Thermometer}
        variant="primary"
      />
      <DashboardCard
        value={formatHumid(summary.avgHumidity)}
        label="Avg. Humidity"
        icon={Droplets}
        variant="info"
      />
      <DashboardCard
        value={formatCount(summary.activeSensorCount)}
        label="Active Sensors"
        icon={Radio}
        variant="warning"
      />
      <DashboardCard
        value={formatCount(summary.breachCount)}
        label="Critical Alerts"
        icon={TriangleAlert}
        variant="destructive"
      />
    </div>
  );
});
