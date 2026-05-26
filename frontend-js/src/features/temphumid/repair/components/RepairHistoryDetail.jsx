import { formatAbsolute, formatDateOnly, formatTimer } from "@/utils/time";
import { getRepairStatusColor } from "@/features/temphumid/repair/utils/repair";

function RepairHistoryDetailField({ label, value, valueStyle }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 10,
        padding: "8px 0",
        borderBottom: "1px solid var(--border)",
      }}
    >
      <span
        style={{
          fontSize: 12,
          color: "var(--muted-foreground)",
          width: 120,
          flexShrink: 0,
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontSize: 13,
          color: "var(--foreground)",
          fontWeight: 500,
          wordBreak: "break-word",
          ...valueStyle,
        }}
      >
        {value || <span style={{ color: "var(--muted-foreground)", fontWeight: 400 }}>-</span>}
      </span>
    </div>
  );
}

export function RepairHistoryDetail({ record }) {
  if (!record) return null;

  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      <RepairHistoryDetailField label="Machine ID" value={record.machineId} />
      <RepairHistoryDetailField label="Machine QR" value={record.machineQr} />
      <RepairHistoryDetailField label="Location" value={record.location} />
      <RepairHistoryDetailField label="Description" value={record.description} />
      <RepairHistoryDetailField
        label="Status"
        value={record.acuStatus}
        valueStyle={
          record.acuStatus
            ? { color: getRepairStatusColor(record.acuStatus), fontWeight: 700 }
            : {}
        }
      />
      <RepairHistoryDetailField label="Operator" value={record.technicianId} />
      <RepairHistoryDetailField
        label="Installed Date"
        value={record.installedDate ? formatDateOnly(record.installedDate) : null}
      />
      <RepairHistoryDetailField label="Remarks" value={record.remarks} />
      <RepairHistoryDetailField
        label="Duration"
        value={record.durationSeconds != null ? formatTimer(record.durationSeconds) : null}
      />
      <RepairHistoryDetailField label="Marked Done By" value={record.markedDoneBy} />
      <RepairHistoryDetailField
        label="Marked Done At"
        value={record.markedDoneAt ? formatAbsolute(record.markedDoneAt) : null}
      />
      <RepairHistoryDetailField label="Uploaded By" value={record.uploadedBy} />
      <RepairHistoryDetailField
        label="Uploaded At"
        value={record.uploadedAt ? formatAbsolute(record.uploadedAt) : null}
      />
    </div>
  );
}
