"use client";

import { useMemo } from "react";

import { DataTable } from "@/components/custom/DataTable";

import { buildDowntimeHistoryColumns } from "@/features/temphumid/downtime/components/DowntimeHistoryColumns";

export function MaintenanceHistoryPanel({ history, loading, onViewDetails }) {
  const sortedHistory = useMemo(() => [...history].reverse(), [history]);
  const historyColumns = useMemo(
    () => buildDowntimeHistoryColumns(onViewDetails),
    [onViewDetails]
  );

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
          Maintenance History
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

