"use client";

import { CardSkeleton } from "@/components/custom/CardSkeleton";
import { DataTable } from "@/components/custom/DataTable";

import { MonitoringAlertBanner } from "@/components/custom/temphumid/components/MonitoringAlertBanner";
import { MonitoringFloorCard } from "@/components/custom/temphumid/components/MonitoringFloorCard";
import { MonitoringFloorModal } from "@/components/custom/temphumid/components/MonitoringFloorModal";
import { useMonitoringData } from "@/hooks/temphumid/use-monitoring-data";
import { LoadingOverlay } from "@/components/ui/loadingoverlay";
import {
  MONITORING_GLOBAL_STYLES,
  MONITORING_SENSOR_TABLE_COLUMNS,
  buildMonitoringHeaderText,
  hasMonitoringBreaches,
} from "@/utils/monitoring";
import { ALL_FLOORS } from "@/utils/floors";

export default function MonitoringView({ currentUser = null }) {
  const {
    activeFloor,
    breachFloorCount,
    delayedCount,
    facilitiesAlertMap,
    floors,
    loading,
    markAreaForwarded,
    setActiveFloor,
    tableData,
  } = useMonitoringData();

  const hasBreaches = hasMonitoringBreaches(floors);

  return (
    <>
      <style>{MONITORING_GLOBAL_STYLES}</style>
      {loading && (
        <LoadingOverlay
          title="Fetching sensor data"
          subtitle="Please wait while live readings are loaded..."
        />
      )}

      <div style={{ minHeight: "100vh", overflowX: "hidden" }}>
        <div
          style={{
            padding: "14px 24px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div className="mt-2.5 bg-background">
            <h1 className="text-2xl font-bold">Monitoring</h1>
            <p className="mt-1 text-muted-foreground">
              {buildMonitoringHeaderText(loading, breachFloorCount)}
            </p>
          </div>
          {!loading && (
            <MonitoringAlertBanner delayedCount={delayedCount} hasBreaches={hasBreaches} />
          )}
        </div>

        <div
          style={{
            padding: "14px 24px",
            display: "flex",
            flexDirection: "column",
            gap: 28,
          }}
        >
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 20 }}>
            {loading
              ? Array.from({ length: ALL_FLOORS.length }).map((_, index) => (
                  <CardSkeleton key={index} />
                ))
              : floors.map((floor) => (
                  <MonitoringFloorCard
                    key={floor.id}
                    floor={floor}
                    onClick={(selected) =>
                      setActiveFloor(floors.find((item) => item.id === selected.id) ?? selected)
                    }
                  />
                ))}
          </div>

          <div
            style={{
              background: "var(--card)",
              border: "1px solid var(--border)",
              borderRadius: 5,
              padding: "20px 24px",
            }}
          >
            <p className="mb-4 font-bold">Activity Log</p>
            {tableData.length === 0 ? (
              <p
                className="text-center text-sm text-muted-foreground"
                style={{ padding: "24px 0" }}
              >
                No sensor data available.
              </p>
            ) : (
              <DataTable columns={MONITORING_SENSOR_TABLE_COLUMNS} data={tableData} />
            )}
          </div>
        </div>
      </div>

      {activeFloor && (
        <MonitoringFloorModal
          floor={activeFloor}
          onClose={() => setActiveFloor(null)}
          facilitiesAlertMap={facilitiesAlertMap}
          onForwarded={markAreaForwarded}
          currentUser={currentUser}
        />
      )}
    </>
  );
}

