import { Button } from "@/components/ui/button";

import { ALL_SENSORS } from "@/features/temphumid/sensor-limits/utils/sensors";
import { FLOORS } from "@/utils/floors";
import { NumField } from "@/components/ui/numfield";

// Copied from the current temp/humid limits route page as an additive scaffold.

export function LimitsEditPanel({
  activeSensor,
  draft,
  errors,
  saving,
  onSetField,
  onApplyToGroup,
  hasChanges,
  changedCount,
  errorCount,
  onSave,
  onDiscard,
}) {
  if (!activeSensor) {
    return (
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          color: "var(--muted-foreground)",
          padding: 32,
        }}
      >
        <div style={{ fontSize: 36 }}>{"\u2699"}</div>
        <p style={{ fontSize: 13, margin: 0, textAlign: "center" }}>
          Select a sensor from the left to edit its limits
        </p>
      </div>
    );
  }

  const floor = FLOORS.find((item) => item.slug === activeSensor.floorSlug);
  const groupSensors = ALL_SENSORS.filter(
    (sensor) =>
      sensor.floorSlug === activeSensor.floorSlug && sensor.group === activeSensor.group
  );

  return (
    <div style={{ flex: 1, overflowY: "auto", padding: "16px" }}>
      <div
        style={{
          background: "var(--card)",
          border: "1px solid var(--border)",
          borderRadius: 8,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            padding: "14px 20px",
            background: "#435ebe",
            borderBottom: "1px solid #3550a8",
          }}
        >
          <p
            style={{
              fontSize: 10,
              fontWeight: 700,
              color: "rgba(255,255,255,.6)",
              letterSpacing: ".06em",
              textTransform: "uppercase",
              margin: 0,
            }}
          >
            {floor?.label} - {activeSensor.group}
          </p>
          <p style={{ fontSize: 18, fontWeight: 700, color: "#fff", margin: "2px 0 0" }}>
            {activeSensor.lineName}
          </p>
        </div>

        <div
          style={{
            padding: "24px 20px",
            display: "flex",
            flexDirection: "column",
            gap: 24,
          }}
        >
          <div>
            <p
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: "var(--foreground)",
                marginBottom: 12,
              }}
            >
              Temperature
            </p>
            <div style={{ display: "flex", gap: 16 }}>
              <NumField
                sensorId={activeSensor.id}
                fieldKey="tempLL"
                label="Lower Limit"
                unit={"\u00B0C"}
                draft={draft}
                errors={errors}
                onSetField={onSetField}
                saving={saving}
              />
              <NumField
                sensorId={activeSensor.id}
                fieldKey="tempUL"
                label="Upper Limit"
                unit={"\u00B0C"}
                draft={draft}
                errors={errors}
                onSetField={onSetField}
                saving={saving}
              />
            </div>
          </div>

          <div>
            <p
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: "var(--foreground)",
                marginBottom: 12,
              }}
            >
              Humidity
            </p>
            <div style={{ display: "flex", gap: 16 }}>
              <NumField
                sensorId={activeSensor.id}
                fieldKey="humidLL"
                label="Lower Limit"
                unit="%"
                draft={draft}
                errors={errors}
                onSetField={onSetField}
                saving={saving}
              />
              <NumField
                sensorId={activeSensor.id}
                fieldKey="humidUL"
                label="Upper Limit"
                unit="%"
                draft={draft}
                errors={errors}
                onSetField={onSetField}
                saving={saving}
              />
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            {groupSensors.length > 1 && (
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Button
                  type="button"
                  size="default"
                  variant="default"
                  className="cursor-pointer"
                  disabled={saving}
                  onClick={() => onApplyToGroup(activeSensor, groupSensors)}
                >
                  Apply to all {activeSensor.group.toLowerCase()} in {floor?.subLabel}
                </Button>
                <span style={{ fontSize: 11, color: "var(--muted-foreground)" }}>
                  Copies current values to all {groupSensors.length} sensors in this group
                </span>
              </div>
            )}

            <div style={{ flex: 1 }} />

            {errorCount > 0 && (
              <span style={{ fontSize: 12, color: "#dc3545", fontWeight: 600 }}>
                {errorCount} validation error{errorCount !== 1 ? "s" : ""}
              </span>
            )}
            {hasChanges && !saving && (
              <span style={{ fontSize: 12, fontWeight: 700, color: "#435ebe" }}>
                {changedCount} unsaved change{changedCount !== 1 ? "s" : ""}
              </span>
            )}
            {saving && <span className="text-sm text-muted-foreground">Saving...</span>}

            <Button
              type="button"
              variant="outline"
              size="default"
              className="cursor-pointer"
              disabled={saving || !hasChanges}
              onClick={onDiscard}
            >
              Discard
            </Button>
            <Button
              type="button"
              variant="default"
              size="default"
              className="cursor-pointer"
              disabled={saving || !hasChanges}
              onClick={onSave}
            >
              {saving ? "Saving..." : `Save${hasChanges ? ` (${changedCount})` : ""}`}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

