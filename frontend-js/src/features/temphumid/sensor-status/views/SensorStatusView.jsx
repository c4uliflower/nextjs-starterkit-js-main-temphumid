"use client";

import { Accordion } from "@/components/ui/accordion";

import { StatusFloorSection } from "@/features/temphumid/sensor-status/components/StatusFloorSection";
import { useSensorStatusManager } from "@/features/temphumid/sensor-status/hooks/use-sensor-status-manager";
import { LoadingOverlay } from "@/components/ui/loadingoverlay";
import { FLOORS } from "@/utils/floors";

export default function SensorStatusView() {
  const {
    apiError,
    draft,
    handleSave,
    handleToggle,
    hasAnyUnsaved,
    loading,
    openFloors,
    original,
    saving,
    sensors,
    setOpenFloors,
    totalActive,
    totalCount,
    totalInactive,
  } = useSensorStatusManager();

  return (
    <div className="flex h-full flex-col overflow-hidden" style={{ minHeight: 0 }}>
      {loading && (
        <LoadingOverlay
          title="Loading sensor statuses"
          subtitle="Fetching all floors..."
        />
      )}

      <div
        style={{ marginTop: 10, padding: "14px 24px", flexShrink: 0 }}
        className="bg-background"
      >
        <h1 className="text-2xl font-bold">Manage Sensor Status</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {totalCount} Sensors across {FLOORS.length} floors - {totalActive} Active -{" "}
          {totalInactive} Inactive
          {hasAnyUnsaved && (
            <span style={{ marginLeft: 10, fontWeight: 700, color: "#435ebe" }}>
              Unsaved Changes Present
            </span>
          )}
        </p>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "0 24px 24px" }}>
        <Accordion
          type="multiple"
          value={openFloors}
          onValueChange={setOpenFloors}
          className="flex flex-col gap-3"
        >
          {FLOORS.map((floor) => {
            const floorSensors = sensors[floor.slug] ?? [];
            if (!loading && floorSensors.length === 0) return null;

            return (
              <StatusFloorSection
                key={floor.slug}
                floor={floor}
                sensors={floorSensors}
                original={original[floor.slug] ?? {}}
                draft={draft[floor.slug] ?? {}}
                saving={saving[floor.slug] ?? false}
                apiError={apiError[floor.slug] ?? null}
                onToggle={handleToggle}
                onSave={handleSave}
              />
            );
          })}
        </Accordion>
      </div>
    </div>
  );
}




