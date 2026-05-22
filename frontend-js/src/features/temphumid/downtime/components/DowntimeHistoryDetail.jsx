import { formatAbsolute, formatTimer } from "@/utils/time";
import { getSensorLifecycleStatusColor } from "@/features/temphumid/downtime/utils/downtime";

function HistoryDetailField({ label, value, valueStyle }) {
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

export function DowntimeHistoryDetail({ record }) {
  if (!record) return null;

  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      <HistoryDetailField label="Line Name" value={record.lineName} />
      <HistoryDetailField label="Area ID" value={record.areaId} />
      <HistoryDetailField label="Operator" value={record.technicianId} />
      <HistoryDetailField
        label="Status"
        value={record.sensorStatus}
        valueStyle={
          record.sensorStatus
            ? { color: getSensorLifecycleStatusColor(record.sensorStatus), fontWeight: 700 }
            : {}
        }
      />
      <HistoryDetailField label="Chip ID" value={record.chipId} />
      <HistoryDetailField label="Remarks" value={record.remarks} />
      <HistoryDetailField
        label="Duration"
        value={record.durationSeconds != null ? formatTimer(record.durationSeconds) : null}
      />
      <HistoryDetailField label="Marked Done By" value={record.markedDoneBy} />
      <HistoryDetailField
        label="Marked Done At"
        value={record.markedDoneAt ? formatAbsolute(record.markedDoneAt) : null}
      />
      <HistoryDetailField label="Uploaded By" value={record.uploadedBy} />
      <HistoryDetailField
        label="Uploaded At"
        value={record.uploadedAt ? formatAbsolute(record.uploadedAt) : null}
      />
    </div>
  );
}
