"use client";

import { PaneField } from "@/features/temphumid/downtime/components/DowntimeAtoms";

export function DowntimeFormPanel({ formData, symptom }) {
  const hasData = !!(formData.lineName || symptom);

  return (
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
          borderBottom: "1px solid var(--border)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        <div>
          <p
            style={{
              fontSize: 10,
              fontWeight: 700,
              color: "var(--muted-foreground)",
              letterSpacing: ".06em",
              margin: 0,
              textTransform: "uppercase",
            }}
          >
            Maintenance Details
          </p>
          <p style={{ fontSize: 16, fontWeight: 700, color: "var(--foreground)", margin: "2px 0 0" }}>
            {hasData ? formData.lineName : "No record selected"}
          </p>
        </div>
        <span
          style={{
            border: "1px solid var(--border)",
            borderRadius: 999,
            color: hasData ? "#435ebe" : "var(--muted-foreground)",
            fontSize: 12,
            fontWeight: 700,
            padding: "3px 9px",
            whiteSpace: "nowrap",
          }}
        >
          {hasData ? "In review" : "Idle"}
        </span>
      </div>

      <div style={{ padding: "14px 20px" }}>
        {!hasData ? (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              padding: "18px 0",
              color: "var(--muted-foreground)",
            }}
          >
            <p style={{ fontSize: 13, margin: 0, textAlign: "center" }}>No maintenance details yet.</p>
          </div>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
              columnGap: 20,
            }}
          >
            <PaneField
              label="Status"
              value={symptom}
              valueStyle={symptom && symptom !== "-" ? { color: "#dc3545", fontWeight: 700 } : {}}
            />
            <PaneField label="Line Name" value={formData.lineName} />
            <PaneField label="Area ID" value={formData.areaId} />
            <PaneField label="Operator" value={formData.technicianId} />
            <PaneField label="Reason" value={formData.reason} />
            <PaneField label="Remarks" value={formData.remarks} />
            <PaneField label="Duration" value={formData.duration} />
            <PaneField label="Marked Done" value={formData.markedDone} />
          </div>
        )}
      </div>
    </div>
  );
}

