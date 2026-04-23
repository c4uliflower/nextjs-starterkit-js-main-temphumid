import {
  BreachDot,
  StatusDot,
} from "@/features/temphumid/sensor-status/components/MonitoringStatusDots";
import {
  STATUS_CONFIG,
  getFloorStatus,
  getFloorSummary,
} from "@/features/temphumid/sensor-status/utils/status";

// Copied from the current temp/humid monitoring route page as an additive scaffold.

export function MonitoringFloorCard({ floor, onClick }) {
  const floorStatus = getFloorStatus(floor);
  const summary = getFloorSummary(floor);
  const config = STATUS_CONFIG[floorStatus];
  const isBreach = floorStatus === "breach";

  return (
    <div
      onClick={() => onClick(floor)}
      style={{
        borderRadius: 5,
        overflow: "hidden",
        cursor: "pointer",
        border: `2px solid ${config.color}`,
        animation: isBreach ? "borderBlink 1.2s ease-in-out infinite" : "none",
        background: "var(--card)",
        transition: "transform .15s",
        display: "flex",
        flexDirection: "column",
      }}
      onMouseEnter={(event) => {
        event.currentTarget.style.transform = "translateY(-3px)";
      }}
      onMouseLeave={(event) => {
        event.currentTarget.style.transform = "translateY(0)";
      }}
    >
      <div
        style={{
          flex: 1,
          overflow: "hidden",
          background: "var(--muted)",
          minHeight: 180,
          maxHeight: 240,
        }}
      >
        <img
          src={floor.image}
          alt={floor.label}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "contain",
            display: "block",
            pointerEvents: "none",
            userSelect: "none",
          }}
        />
      </div>
      <div
        style={{
          padding: "10px 14px",
          background: config.bg,
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}
      >
        {isBreach && <BreachDot />}
        {!isBreach && floorStatus !== "active" && (
          <StatusDot status={floorStatus} size={10} />
        )}
        <span style={{ fontWeight: 700, fontSize: 15, color: config.color, flex: 1 }}>
          {floor.label}
        </span>
        <span style={{ fontSize: 11, color: config.color, fontWeight: 600 }}>
          {summary}
        </span>
      </div>
    </div>
  );
}


