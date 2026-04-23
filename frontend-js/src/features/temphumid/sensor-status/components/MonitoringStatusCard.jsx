"use client";

import { useState } from "react";

import { StatusDot } from "@/features/temphumid/sensor-status/components/MonitoringStatusDots";
import { STATUS_CONFIG } from "@/features/temphumid/sensor-status/utils/status";

export function MonitoringExpandableStatusCard({ index, sensorName, status, body }) {
  const config = STATUS_CONFIG[status];
  const [open, setOpen] = useState(false);

  return (
    <div
      style={{
        background: config.bg,
        border: `1px solid ${config.color}25`,
        borderRadius: 5,
        marginBottom: 8,
        overflow: "hidden",
        animation: "slideIn .2s ease both",
        animationDelay: `${index * 0.05}s`,
      }}
    >
      <div
        onClick={() => setOpen((value) => !value)}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "12px 16px",
          cursor: "pointer",
          userSelect: "none",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <StatusDot status={status} size={8} />
          <span style={{ fontWeight: 600, fontSize: 14, color: config.color }}>
            {sensorName}
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span
            style={{
              fontSize: 10,
              fontWeight: 700,
              padding: "2px 7px",
              borderRadius: 5,
              background: config.color,
              color: "#fff",
              letterSpacing: ".04em",
              textTransform: "uppercase",
            }}
          >
            {config.label}
          </span>
          <span
            style={{
              fontSize: 16,
              color: config.color,
              transition: "transform .2s",
              display: "inline-block",
              transform: open ? "rotate(180deg)" : "rotate(0deg)",
            }}
          >
            {"\u2039"}
          </span>
        </div>
      </div>

      {open && (
        <div style={{ padding: "0 16px 12px", borderTop: `1px solid ${config.color}15` }}>
          {body}
        </div>
      )}
    </div>
  );
}


