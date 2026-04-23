"use client";

import { Button } from "@/components/ui/button";

import { DowntimeStopLineCard } from "@/features/temphumid/downtime/components/DowntimeStopLineCard";

export function StopLineListPanel({ records, onRowClick, onStartDowntime }) {
  return (
    <div
      style={{
        width: 340,
        flexShrink: 0,
        background: "var(--card)",
        border: "1px solid var(--border)",
        borderRadius: 8,
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div style={{ padding: "14px 20px" }}>
        <p
          style={{
            fontSize: 10,
            fontWeight: 700,
            color: "var(--muted-foreground)",
            letterSpacing: ".06em",
            textTransform: "uppercase",
            margin: 0,
          }}
        >
          Active Maintenance
        </p>
        <p style={{ fontSize: 16, fontWeight: 700, color: "var(--foreground)", margin: "2px 0 0" }}>
          Stop Line List
        </p>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr auto",
          padding: "6px 14px",
          fontSize: 10,
          fontWeight: 700,
          color: "var(--muted-foreground)",
          textTransform: "uppercase",
          letterSpacing: ".06em",
          borderBottom: "1px solid var(--border)",
          background: "var(--muted)",
        }}
      >
        <span>Sensor / Area</span>
        <span>Elapsed</span>
      </div>

      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: 12,
          display: "flex",
          flexDirection: "column",
          gap: 10,
          minHeight: 80,
        }}
      >
        {records.length === 0 ? (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flex: 1,
              padding: "28px 0",
            }}
          >
            <p className="text-center text-sm text-muted-foreground">No active records</p>
          </div>
        ) : (
          records.map((record) => (
            <DowntimeStopLineCard key={record.id} record={record} onClick={onRowClick} />
          ))
        )}
      </div>

      <div style={{ padding: 12, borderTop: "1px solid var(--border)" }}>
        <Button
          type="button"
          size="default"
          variant="default"
          className="w-full"
          style={{ cursor: "pointer" }}
          onClick={onStartDowntime}
        >
          Start Maintenance
        </Button>
      </div>
    </div>
  );
}

