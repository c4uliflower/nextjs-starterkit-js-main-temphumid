import {
  MonitoringSensorStatusRow,
} from "@/features/temphumid/sensor-status/components/MonitoringStatusBits";
import { StatusDot } from "@/features/temphumid/sensor-status/components/MonitoringStatusDots";
import { STATUS_CONFIG } from "@/features/temphumid/sensor-status/utils/status";

export function MonitoringAllClearState({ floorLabel }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        height: "100%",
        padding: 24,
        textAlign: "center",
        gap: 12,
      }}
    >
      <div style={{ fontWeight: 700, fontSize: 16, color: "#0a6644" }}>All Clear</div>
      <div style={{ fontSize: 13, color: "#198754", lineHeight: 1.6 }}>
        All temperature and humidity levels at {floorLabel} are within acceptable limits.
      </div>
    </div>
  );
}

function MonitoringStatusCounts({ counts }) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
      {Object.entries(counts).map(([status, count]) => (
        <span
          key={status}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 5,
            fontSize: 11,
            fontWeight: 700,
            padding: "3px 9px",
            borderRadius: 5,
            background: STATUS_CONFIG[status].bg,
            color: STATUS_CONFIG[status].color,
            border: `1px solid ${STATUS_CONFIG[status].color}40`,
          }}
        >
          <StatusDot status={status} size={6} />
          {count} {STATUS_CONFIG[status].label}
        </span>
      ))}
    </div>
  );
}

function MonitoringActiveSensorChips({ sensors }) {
  if (sensors.length === 0) return null;

  return (
    <>
      <div
        style={{
          fontSize: 11,
          fontWeight: 700,
          color: "var(--muted-foreground)",
          textTransform: "uppercase",
          letterSpacing: ".08em",
          marginTop: 12,
          marginBottom: 8,
        }}
      >
        Active ({sensors.length})
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {sensors.map((sensor) => (
          <span
            key={sensor.id}
            style={{
              fontSize: 11,
              padding: "3px 8px",
              borderRadius: 5,
              background: "#e8fff8",
              color: "#198754",
              border: "1px solid #00c9a720",
              fontWeight: 500,
            }}
          >
            {sensor.name}
          </span>
        ))}
      </div>
    </>
  );
}

export function MonitoringIssueState({
  activeSensors,
  counts,
  currentUser,
  flaggedSensors,
  notifyStates,
  onForwarded,
  onNotifyStateChange,
}) {
  return (
    <>
      <MonitoringStatusCounts counts={counts} />

      <div
        style={{
          fontSize: 11,
          fontWeight: 700,
          color: "var(--muted-foreground)",
          textTransform: "uppercase",
          letterSpacing: ".08em",
          marginBottom: 12,
        }}
      >
        Sensor Flags
      </div>

      {flaggedSensors.map((sensor, index) => (
        <MonitoringSensorStatusRow
          key={sensor.id}
          sensor={sensor}
          index={index}
          currentUser={currentUser}
          notifyState={notifyStates[sensor.areaId]}
          onNotifyStateChange={onNotifyStateChange}
          onForwarded={onForwarded}
        />
      ))}

      <MonitoringActiveSensorChips sensors={activeSensors} />
    </>
  );
}


