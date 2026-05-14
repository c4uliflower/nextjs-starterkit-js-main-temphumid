"use client";

import { useMemo, useState } from "react";

import { CardSkeleton } from "@/components/custom/CardSkeleton";
import { DashboardCard } from "@/components/custom/DashboardCard";
import { DataTable } from "@/components/custom/DataTable";
import { Activity, Droplets, Hammer, Radio, Thermometer, Wrench } from "lucide-react";

import { MonitoringAlertBanner } from "@/components/custom/temphumid/components/MonitoringAlertBanner";
import { MonitoringFloorCard } from "@/components/custom/temphumid/components/MonitoringFloorCard";
import { MonitoringFloorModal } from "@/components/custom/temphumid/components/MonitoringFloorModal";
import { useMonitoringData } from "@/hooks/temphumid/use-monitoring-data";
import { LoadingOverlay } from "@/components/ui/loadingoverlay";
import {
  MONITORING_GLOBAL_STYLES,
  MONITORING_SENSOR_TABLE_COLUMNS,
  buildMonitoringHeaderText,
} from "@/utils/monitoring";
import { ALL_FLOORS } from "@/utils/floors";

const ACTIVITY_FILTER_LABELS = {
  total: "Active",
  stable: "Stable",
  maintenance: "On Maintenance",
  repair: "In Repair",
  humidOutOfSpec: "Out of Spec Humidity",
  tempOutOfSpec: "Out of Spec Temperature",
};

export default function MonitoringView({ currentUser = null }) {
  const {
    activeFloor,
    breachFloorCount,
    delayedCount,
    facilitiesAlertMap,
    floors,
    loading,
    markAreaForwarded,
    monitoringStats,
    setActiveFloor,
    tableData,
  } = useMonitoringData();

  const [activityFilter, setActivityFilter] = useState("total");
  const filteredTableData = useMemo(() => {
    const ongoingAreaIds = monitoringStats.ongoingAreaIds ?? new Set();
    const maintenanceAreaIds = monitoringStats.maintenanceAreaIds ?? new Set();
    const repairAreaIds = monitoringStats.repairAreaIds ?? new Set();

    if (activityFilter === "stable") {
      return tableData.filter(
        (sensor) => sensor.hasData && !sensor.breach && !ongoingAreaIds.has(sensor.areaId)
      );
    }

    if (activityFilter === "maintenance") {
      return tableData.filter((sensor) => maintenanceAreaIds.has(sensor.areaId));
    }

    if (activityFilter === "repair") {
      return tableData.filter((sensor) => repairAreaIds.has(sensor.areaId));
    }

    if (activityFilter === "humidOutOfSpec") {
      return tableData.filter((sensor) => sensor.humidOutOfSpec);
    }

    if (activityFilter === "tempOutOfSpec") {
      return tableData.filter((sensor) => sensor.tempOutOfSpec);
    }

    return tableData;
  }, [
    activityFilter,
    monitoringStats.maintenanceAreaIds,
    monitoringStats.ongoingAreaIds,
    monitoringStats.repairAreaIds,
    tableData,
  ]);
  const activeFilterLabel = ACTIVITY_FILTER_LABELS[activityFilter];

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
            <MonitoringAlertBanner delayedCount={delayedCount} />
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
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            <DashboardCard
              value={String(monitoringStats.total)}
              label="Active"
              icon={Activity}
              variant="primary"
              onFilterClick={() => setActivityFilter("total")}
            />
            <DashboardCard
              value={String(monitoringStats.stable)}
              label="Stable"
              icon={Radio}
              variant="success"
              onFilterClick={() => setActivityFilter("stable")}
            />
            <DashboardCard
              value={String(monitoringStats.maintenance)}
              label="On Maintenance"
              icon={Wrench}
              variant="warning"
              onFilterClick={() => setActivityFilter("maintenance")}
            />
            <DashboardCard
              value={String(monitoringStats.repair)}
              label="In Repair"
              icon={Hammer}
              variant="info"
              onFilterClick={() => setActivityFilter("repair")}
            />
            <DashboardCard
              value={String(monitoringStats.humidOutOfSpec)}
              label="Humidity Out of Spec"
              icon={Droplets}
              variant="secondary"
              onFilterClick={() => setActivityFilter("humidOutOfSpec")}
            />
            <DashboardCard
              value={String(monitoringStats.tempOutOfSpec)}
              label="Temperature Out of Spec"
              icon={Thermometer}
              variant="destructive"
              onFilterClick={() => setActivityFilter("tempOutOfSpec")}
            />
          </div>

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
            <div className="mb-4 flex items-center justify-between gap-3">
              <p className="font-bold">Activity Log</p>
              <span className="rounded-md bg-muted px-2.5 py-1 text-xs font-semibold text-muted-foreground">
                {activeFilterLabel}
              </span>
            </div>
            {filteredTableData.length === 0 ? (
              <p
                className="text-center text-sm text-muted-foreground"
                style={{ padding: "24px 0" }}
              >
                No sensor data available for this filter.
              </p>
            ) : (
              <DataTable columns={MONITORING_SENSOR_TABLE_COLUMNS} data={filteredTableData} />
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

