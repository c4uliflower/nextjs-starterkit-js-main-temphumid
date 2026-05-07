"use client";

import { useDowntimeElapsed } from "@/features/temphumid/downtime/hooks/use-downtime-elapsed";
import { getDowntimeSymptomColor } from "@/features/temphumid/downtime/utils/downtime";
import { formatAbsolute, formatTimer } from "@/utils/time";

export function DowntimeStopLineCard({ record, onClick }) {
  const elapsed = useDowntimeElapsed(record.processedAt, record.markedDoneAt);
  const symptomDot = getDowntimeSymptomColor(record.symptom);
  const isDisabled = !!record.markedDoneAt;

  return (
    <div
      onClick={() => {
        if (!isDisabled) onClick(record);
      }}
      style={{
        background: "var(--card)",
        border: "1.5px solid #dc3545",
        borderLeft: "4px solid #dc3545",
        borderRadius: 6,
        overflow: "hidden",
        cursor: isDisabled ? "default" : "pointer",
        transition: "box-shadow .15s",
        boxShadow: "0 1px 4px rgba(0,0,0,.06)",
        opacity: 1,
      }}
      onMouseEnter={(event) => {
        if (!isDisabled) {
          event.currentTarget.style.boxShadow = "0 3px 10px rgba(220,53,69,.2)";
        }
      }}
      onMouseLeave={(event) => {
        event.currentTarget.style.boxShadow = "0 1px 4px rgba(0,0,0,.06)";
      }}
    >
      <div
        style={{
          padding: "9px 14px",
          background: "#dc3545",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 7, minWidth: 0 }}>
          <span
            style={{
              width: 7,
              height: 7,
              borderRadius: "50%",
              flexShrink: 0,
              background: "rgba(255,255,255,0.7)",
              animation: "dotPulse 1.4s ease-in-out infinite",
            }}
          />
          <span
            style={{
              fontWeight: 700,
              fontSize: 13,
              color: "#fff",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {record.lineName}
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
          <span style={{ fontFamily: "monospace", fontSize: 13, fontWeight: 700, color: "#fff" }}>
            {formatTimer(elapsed)}
          </span>
        </div>
      </div>

      <div style={{ padding: "10px 14px", display: "flex", flexDirection: "column", gap: 5 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontSize: 11, color: "var(--muted-foreground)" }}>{record.areaId}</span>
          <span style={{ fontSize: 11, color: "var(--muted-foreground)" }}>
            Operator: <strong style={{ color: "var(--foreground)" }}>{record.technicianId}</strong>
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: "50%",
              background: symptomDot,
              flexShrink: 0,
            }}
          />
          <span style={{ fontSize: 12, color: "var(--foreground)", fontWeight: 500 }}>
            {record.symptom}
          </span>
        </div>
        <div style={{ fontSize: 10, color: "var(--muted-foreground)", marginTop: 1 }}>
          Started: {formatAbsolute(record.processedAt)}
          {" \u00B7 "}
          <span style={{ color: "#dc3545", fontWeight: 600 }}>Tap to Mark Done</span>
        </div>
      </div>
    </div>
  );
}



