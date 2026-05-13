import { BreachDot } from "@/features/temphumid/sensor-status/components/MonitoringStatusDots";

function MonitoringAlertChip({ children }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        background: "#ffe8e8",
        border: "1.5px solid #dc3545",
        borderRadius: 5,
        padding: "14px 24px",
        animation: "borderBlink 1.4s ease-in-out infinite",
      }}
    >
      <BreachDot />
      <span style={{ fontSize: 13, fontWeight: 700, color: "#dc3545" }}>{children}</span>
    </div>
  );
}

export function MonitoringAlertBanner({ delayedCount }) {
  if (delayedCount <= 0) return null;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <MonitoringAlertChip>{delayedCount} DELAYED</MonitoringAlertChip>
    </div>
  );
}

