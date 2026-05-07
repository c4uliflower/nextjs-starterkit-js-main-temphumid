import { STATUS_CONFIG } from "@/features/temphumid/sensor-status/utils/status";

export function BreachDot() {
  return (
    <div
      style={{
        width: 10,
        height: 10,
        borderRadius: "50%",
        background: "#dc3545",
        flexShrink: 0,
        animation: "dotPulse 1s ease-in-out infinite",
      }}
    />
  );
}

export function StatusDot({ status, size = 8 }) {
  const config = STATUS_CONFIG[status];

  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: config.dot,
        flexShrink: 0,
        animation: status === "breach" ? "dotPulse 1.2s ease-in-out infinite" : "none",
      }}
    />
  );
}

