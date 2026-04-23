"use client";

import { useState } from "react";

import { LoadingOverlay } from "@/components/ui/loadingoverlay";
import { DailyOverviewCard } from "@/components/custom/temphumid/components/DailyOverviewCard";
import { DailyStatCards } from "@/components/custom/temphumid/components/DailyStatCards";
import { useDailyDashboard } from "@/hooks/temphumid/use-daily-dashboard";
import { dailyCache, exportDailyReadingsToExcel } from "@/utils/daily";

export default function DashboardView() {
  const [summaryLoading, setSummaryLoading] = useState(!dailyCache.summary);
  const daily = useDailyDashboard();

  const handleExport = async () => {
    if (!daily.rawDataRef.current || !daily.applied) return;

    daily.setExporting(true);
    try {
      await exportDailyReadingsToExcel({
        rawData: daily.rawDataRef.current,
        limitProfiles: daily.limitProfiles,
        rangeFrom: daily.range.from,
        rangeTo: daily.range.to,
      });
    } catch (error) {
      console.error("Export failed:", error);
    } finally {
      daily.setExporting(false);
    }
  };

  return (
    <div className="space-y-6 p-6">
      {summaryLoading && (
        <LoadingOverlay
          title="Fetching sensor data"
          subtitle="Please wait while live readings are loaded..."
        />
      )}

      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="mt-1 text-muted-foreground">Temperature and Humidity Monitoring System</p>
      </div>

      <DailyStatCards onFirstLoad={() => setSummaryLoading(false)} />

      <DailyOverviewCard
        apiError={daily.apiError}
        applied={daily.applied}
        canApply={daily.canApply}
        chartKey={daily.chartKey}
        chartReady={daily.chartReady}
        chartSubtitle={daily.chartSubtitle}
        chartView={daily.chartView}
        exporting={daily.exporting}
        handleApply={daily.handleApply}
        handleClear={daily.handleClear}
        handleExport={handleExport}
        handleLocationChange={daily.handleLocationChange}
        handleRangeChange={daily.handleRangeChange}
        handleSensorChange={daily.handleSensorChange}
        handleSundayToggle={daily.handleSundayToggle}
        handleViewToggle={daily.handleViewToggle}
        hintText={daily.hintText}
        humidDS={daily.humidDS}
        includeSundays={daily.includeSundays}
        labels={daily.labels}
        limitProfiles={daily.limitProfiles}
        loading={daily.loading}
        locationOptionsList={daily.locationOptionsList}
        noData={daily.noData}
        range={daily.range}
        selLocationValues={daily.selLocationValues}
        selSensorValues={daily.selSensorValues}
        sensorOptionsList={daily.sensorOptionsList}
        tempDS={daily.tempDS}
      />
    </div>
  );
}
