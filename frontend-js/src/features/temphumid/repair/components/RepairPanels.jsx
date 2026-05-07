"use client";

import { useMemo } from "react";

import { DataTable } from "@/components/custom/DataTable";
import { Button } from "@/components/ui/button";

import { RepairPaneField } from "@/features/temphumid/repair/components/RepairAtoms";
import { buildRepairHistoryColumns } from "@/features/temphumid/repair/components/RepairHistoryColumns";
import { RepairHistoryDetail } from "@/features/temphumid/repair/components/RepairHistoryDetail";
import { RepairStopLineCard } from "@/features/temphumid/repair/components/RepairStopLineCard";

export function RepairListPanel({ records, onRowClick, onStartRepair }) {
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
          Active Repair
        </p>
        <p style={{ fontSize: 16, fontWeight: 700, color: "var(--foreground)", margin: "2px 0 0" }}>
          ACU Repair List
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
        <span>ACU / Location</span>
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
            <p className="text-center text-sm text-muted-foreground">No active repair</p>
          </div>
        ) : (
          records.map((record) => (
            <RepairStopLineCard key={record.id} record={record} onClick={onRowClick} />
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
          onClick={onStartRepair}
        >
          Start Repair
        </Button>
      </div>
    </div>
  );
}

export function RepairFormPanel({ formData, acuStatus }) {
  const hasData = !!(formData.machineId || acuStatus);

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
          borderBottom: "1px solid #0d625c",
        }}
      >
        <p style={{ fontSize: 16, fontWeight: 700, color: "#fff", margin: "2px 0 0" }}>
          {hasData ? formData.machineId : "Repair Form"}
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
              Start a repair or mark a record as done to see details here
            </p>
          </div>
        ) : (
          <>
            <RepairPaneField
              label="Status"
              value={acuStatus}
              valueStyle={acuStatus === "Active" ? { color: "#16a34a", fontWeight: 700 } : {}}
            />
            <RepairPaneField label="Machine ID" value={formData.machineId} />
            <RepairPaneField label="Machine QR" value={formData.machineQr} />
            <RepairPaneField label="Location" value={formData.location} />
            <RepairPaneField label="Description" value={formData.description} />
            <RepairPaneField label="Operator" value={formData.technicianId} />
            <RepairPaneField label="Reason" value={formData.reason} />
            <RepairPaneField label="Remarks" value={formData.remarks} />
            <RepairPaneField label="Duration" value={formData.duration} />
            <RepairPaneField label="Marked Done" value={formData.markedDone} />
          </>
        )}
      </div>
    </div>
  );
}

export function RepairHistoryPanel({ history, loading, onViewDetails }) {
  const sortedHistory = useMemo(() => [...history].reverse(), [history]);
  const historyColumns = useMemo(() => buildRepairHistoryColumns(onViewDetails), [onViewDetails]);

  return (
    <div
      style={{
        background: "var(--card)",
        border: "1px solid var(--border)",
        borderRadius: 8,
        overflow: "hidden",
      }}
    >
      <div style={{ padding: "14px 20px" }}>
        <p
          style={{
            fontSize: 16,
            fontWeight: 700,
            color: "var(--foreground)",
            margin: "12px 0 0",
          }}
        >
          Repair History
        </p>
      </div>
      <div style={{ padding: "16px 20px" }}>
        {loading ? (
          <p className="text-center text-sm text-muted-foreground" style={{ padding: "24px 0" }}>
            Loading history...
          </p>
        ) : history.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground" style={{ padding: "24px 0" }}>
            No uploaded records yet.
          </p>
        ) : (
          <DataTable columns={historyColumns} data={sortedHistory} />
        )}
      </div>
    </div>
  );
}

export { RepairHistoryDetail as RepairHistoryDetailContent };
