"use client";

import { Accordion } from "@/components/ui/accordion";

import { LimitsEditPanel } from "@/features/temphumid/sensor-limits/components/LimitsEditPanel";
import { LimitsFloorAccordionItem } from "@/features/temphumid/sensor-limits/components/LimitsFloorAccordionItem";
import { useSensorLimitsManager } from "@/features/temphumid/sensor-limits/hooks/use-sensor-limits-manager";
import { LoadingOverlay } from "@/components/ui/loadingoverlay";
import { ALL_SENSORS } from "@/features/temphumid/sensor-limits/utils/sensors";
import { FLOORS } from "@/utils/floors";

export default function SensorLimitsView() {
  const {
    activeId,
    activeSensor,
    apiError,
    changedCount,
    draft,
    errorCount,
    errors,
    handleApplyToGroup,
    handleDiscard,
    handleSave,
    handleSetField,
    hasChanges,
    hasRowError,
    isChanged,
    loading,
    openFloor,
    saving,
    sensorStatuses,
    sensorsByFloor,
    setActiveId,
    setOpenFloor,
  } = useSensorLimitsManager();

  return (
    <div className="flex h-full flex-col overflow-hidden" style={{ minHeight: 0 }}>
      {loading && (
        <LoadingOverlay
          title="Loading sensor limits"
          subtitle="Fetching all floors..."
        />
      )}

      <div
        style={{ marginTop: 10, padding: "14px 24px 0", flexShrink: 0 }}
        className="bg-background"
      >
        <h1 className="text-2xl font-bold">Manage Sensor Limits</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {ALL_SENSORS.length} Sensors across {FLOORS.length} floors - Each sensor has
          its own threshold
        </p>

        {apiError && !saving && (
          <div
            style={{
              marginTop: 10,
              background: "#ffe8e8",
              border: "1.5px solid #dc3545",
              borderRadius: 8,
              padding: "8px 14px",
            }}
            className="text-sm text-destructive"
          >
            {apiError}
          </div>
        )}
      </div>

      <div style={{ flex: 1, display: "flex", overflow: "hidden", minHeight: 0 }}>
        <div
          style={{
            width: 340,
            flexShrink: 0,
            overflowY: "auto",
            background: "var(--background)",
            padding: "12px",
          }}
        >
          <div
            style={{
              border: "1px solid var(--border)",
              borderRadius: 10,
              overflow: "hidden",
              background: "var(--card)",
            }}
          >
            <Accordion
              type="single"
              value={openFloor}
              onValueChange={setOpenFloor}
              collapsible
              className="w-full"
            >
              {sensorsByFloor.map(({ floor, groups }) => (
                <LimitsFloorAccordionItem
                  key={floor.slug}
                  floor={floor}
                  groups={groups}
                  activeId={activeId}
                  saving={saving}
                  isChanged={isChanged}
                  hasRowError={hasRowError}
                  sensorStatuses={sensorStatuses}
                  onSelect={(id) => {
                    setActiveId(id);
                    const sensor = ALL_SENSORS.find((item) => item.id === id);
                    if (sensor && openFloor !== sensor.floorSlug) {
                      setOpenFloor(sensor.floorSlug);
                    }
                  }}
                />
              ))}
            </Accordion>
          </div>
        </div>

        <div
          style={{
            flex: 1,
            overflow: "hidden",
            background: "var(--background)",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <LimitsEditPanel
            activeSensor={activeSensor}
            draft={draft}
            errors={errors}
            saving={saving}
            onSetField={handleSetField}
            onApplyToGroup={handleApplyToGroup}
            hasChanges={hasChanges}
            changedCount={changedCount}
            errorCount={errorCount}
            onSave={handleSave}
            onDiscard={handleDiscard}
          />
        </div>
      </div>
    </div>
  );
}




