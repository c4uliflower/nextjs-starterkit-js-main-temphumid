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
          background: "var(--primary)",
          borderBottom: "1px solid #3550a8",
        }}
      >
        <p style={{ fontSize: 16, fontWeight: 700, color: "#fff", margin: "2px 0 0" }}>
          {hasData ? formData.lineName : "Maintenance Form"}
        </p>
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
              padding: "28px 0",
              color: "var(--muted-foreground)",
            }}
          >
            <p style={{ fontSize: 13, margin: 0, textAlign: "center" }}>
              Start a maintenance or mark a record as done to see details here
            </p>
          </div>
        ) : (
          <>
            <PaneField
              label="Symptom"
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
          </>
        )}
      </div>
    </div>
  );
}

