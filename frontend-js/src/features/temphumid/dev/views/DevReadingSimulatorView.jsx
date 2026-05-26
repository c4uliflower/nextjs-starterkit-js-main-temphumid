"use client";

import { CardSkeleton } from "@/components/custom/CardSkeleton";
import { LoadingOverlay } from "@/components/ui/loadingoverlay";
import { DevReadingSimulator } from "@/features/temphumid/dev/components/DevReadingSimulator";
import { useMonitoringData } from "@/hooks/temphumid/use-monitoring-data";

export function DevReadingSimulatorView() {
  const { floors, loading, refresh } = useMonitoringData();

  return (
    <div style={{ minHeight: "100vh", overflowX: "hidden" }}>
      {loading && (
        <LoadingOverlay
          title="Fetching sensor data"
          subtitle="Please wait while live readings are loaded..."
        />
      )}

      <div style={{ padding: "14px 24px" }}>
        <div className="mt-2.5 bg-background">
          <h1 className="text-2xl font-bold">Dev Reading Simulator</h1>
          <p className="mt-1 text-muted-foreground">
            Insert local-only temp/humidity readings for alert workflow testing.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="grid gap-4 px-6 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <CardSkeleton key={index} />
          ))}
        </div>
      ) : (
        <DevReadingSimulator floors={floors} onSimulated={refresh} />
      )}
    </div>
  );
}
