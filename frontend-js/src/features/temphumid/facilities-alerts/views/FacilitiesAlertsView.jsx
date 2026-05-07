"use client";

import { useMemo } from "react";

import { DataTable } from "@/components/custom/DataTable";
import { DashboardCard } from "@/components/custom/DashboardCard";
import { CustomModal } from "@/components/custom/CustomModal";
import { BellRing, CheckCheck, Clock, TriangleAlert } from "lucide-react";

import {
  buildFacilitiesResolvedColumns,
} from "@/features/temphumid/facilities-alerts/components/FacilitiesBreachReadingsParts";
import {FacilitiesResolvedDetailContent,} from "@/features/temphumid/facilities-alerts/components/FacilitiesBreachReadings"
import { FacilitiesKanbanColumn } from "@/features/temphumid/facilities-alerts/components/FacilitiesAlertCard";
import { useFacilitiesDashboard } from "@/features/temphumid/facilities-alerts/hooks/use-facilities-dashboard";
import { LoadingOverlay } from "@/components/ui/loadingoverlay";
import { ACTIVE_COLUMNS, FACILITIES_STYLES } from "@/features/temphumid/facilities-alerts/utils/facilities";

export default function FacilitiesAlertsView() {
  const {
    alertsByCol,
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
  } = useFacilitiesDashboard();

  const resolvedColumns = useMemo(
    () => buildFacilitiesResolvedColumns(setSelectedResolved),
    [setSelectedResolved]
  );

  return (
    <>
      <style>{FACILITIES_STYLES}</style>
      {loading && (
        <LoadingOverlay
          title="Loading alerts..."
          subtitle="Fetching the latest breach alerts"
        />
      )}

      <div className="flex h-full flex-col overflow-hidden" style={{ minHeight: 0 }}>
        <div
          style={{ marginTop: 10, padding: "14px 24px", flexShrink: 0 }}
          className="bg-background"
        >
          <h1 className="text-2xl font-bold">Manage Sensor Breach Alerts</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {stats.acknowledgedCount} Acknowledged {"\u00B7"} {stats.openCount} Open {"\u00B7"}{" "}
            {stats.resolvedCount} Resolved
            {stats.escalatedCount > 0 && (
              <span style={{ marginLeft: 10, fontWeight: 700, color: "#b45309" }}>
                {"\u00B7"} {stats.escalatedCount} Delayed
              </span>
            )}
          </p>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "0 24px 24px" }}>
          {fetchError && (
            <div
              style={{
                marginBottom: 16,
                padding: "10px 14px",
                borderRadius: 8,
                background: "#fef2f2",
                border: "1px solid #fca5a5",
                fontSize: 13,
                color: "#b91c1c",
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <TriangleAlert size={14} style={{ flexShrink: 0 }} />
              {fetchError}
            </div>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <DashboardCard
                value={String(stats.resolvedCount)}
                label="Resolved"
                icon={CheckCheck}
                variant="success"
              />
              <DashboardCard
                value={String(stats.openCount)}
                label="Open"
                icon={Clock}
                variant="warning"
              />
              <DashboardCard
                value={String(stats.escalatedCount)}
                label="Delayed"
                icon={TriangleAlert}
                variant="secondary"
              />
              <DashboardCard
                value={String(stats.acknowledgedCount)}
                label="Acknowledged"
                icon={BellRing}
                variant="destructive"
              />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              {ACTIVE_COLUMNS.map((col) => (
                <FacilitiesKanbanColumn
                  key={col.key}
                  col={col}
                  alerts={alertsByCol[col.key]}
                  onAcknowledge={handleAcknowledge}
                  onResolve={handleResolve}
                  onConflict={handleConflict}
                />
              ))}
            </div>

            <div
              style={{
                background: "var(--card)",
                border: "1px solid var(--border)",
                borderRadius: 8,
                overflow: "hidden",
              }}
            >
              <div style={{ padding: "14px 20px", background: "var(--card)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span
                    style={{
                      width: 7,
                      height: 7,
                      borderRadius: "50%",
                      flexShrink: 0,
                      background: "var(--success)",
                      display: "inline-block",
                    }}
                  />
                  <p
                    style={{
                      fontWeight: 700,
                      fontSize: 14,
                      color: "var(--foreground)",
                      marginLeft: 3,
                    }}
                  >
                    Resolved
                  </p>
                </div>
              </div>
              <div style={{ padding: "16px 20px" }}>
                {resolvedAlerts.length === 0 ? (
                  <p
                    className="text-center text-sm text-muted-foreground"
                    style={{ padding: "16px 0" }}
                  >
                    No resolved alerts yet.
                  </p>
                ) : (
                  <DataTable columns={resolvedColumns} data={resolvedAlerts} />
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <CustomModal
        open={!!selectedResolved}
        onOpenChange={(open) => {
          if (!open) setSelectedResolved(null);
        }}
        title="Alert Details"
        description={
          selectedResolved
            ? `${selectedResolved.lineName} \u00B7 ${selectedResolved.areaId}`
            : ""
        }
        size="xl"
      >
        <FacilitiesResolvedDetailContent alert={selectedResolved} />
      </CustomModal>
    </>
  );
}




