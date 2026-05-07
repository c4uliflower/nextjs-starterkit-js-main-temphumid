import { Button } from "@/components/ui/button";

import { formatAbsolute, formatTimer } from "@/utils/time";

export function buildRepairHistoryColumns(setSelectedHistory) {
  return [
    {
      header: "Machine",
      cell: ({ row }) => (
        <div>
          <div style={{ fontWeight: 600, fontSize: 13 }}>{row.original.machineId}</div>
          <div style={{ fontSize: 11, color: "var(--muted-foreground)" }}>
            {row.original.location || "-"}
          </div>
        </div>
      ),
    },
    { accessorKey: "technicianId", header: "Operator" },
    { accessorKey: "acuStatus", header: "Status" },
    { accessorKey: "reason", header: "Reason" },
    {
      id: "remarks",
      header: "Remarks",
      cell: ({ row }) => (
        <span
          style={{
            fontSize: 13,
            color: row.original.remarks ? "var(--foreground)" : "var(--muted-foreground)",
            maxWidth: 200,
            display: "inline-block",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {row.original.remarks || "-"}
        </span>
      ),
    },
    {
      header: "Duration",
      cell: ({ row }) => formatTimer(row.original.durationSeconds ?? 0),
    },
    {
      header: "Uploaded",
      cell: ({ row }) => (row.original.uploadedAt ? formatAbsolute(row.original.uploadedAt) : "-"),
    },
    {
      id: "viewDetails",
      header: "",
      cell: ({ row }) => (
        <Button
          variant="outline"
          size="sm"
          style={{ fontSize: 11, height: 26, cursor: "pointer", whiteSpace: "nowrap" }}
          onClick={() => setSelectedHistory(row.original)}
        >
          View Details
        </Button>
      ),
    },
  ];
}
