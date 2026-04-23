import { formatAbsolute, formatTimer } from "@/utils/time";

function HistoryDetailField({ label, value }) {
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
      <HistoryDetailField label="Symptom" value={record.symptom} />
      <HistoryDetailField label="Reason" value={record.reason} />
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
