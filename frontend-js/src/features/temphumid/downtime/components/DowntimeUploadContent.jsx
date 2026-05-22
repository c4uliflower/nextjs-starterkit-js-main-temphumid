"use client";

import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";

import {
  getSensorLifecycleStatusColor,
  getSensorLifecycleStatusForeground,
  normalizeSensorLifecycleStatus,
} from "@/features/temphumid/downtime/utils/downtime";
import { uploadDowntimeRecords } from "@/features/temphumid/shared/utils/api";

function buildDowntimeDrafts(records) {
  return records.reduce((drafts, record) => {
    drafts[record.id] = {
      remarks: record.remarks ?? "",
    };
    return drafts;
  }, {});
}

function PendingUploadRecord({ disabled, draft, onDraftChange, record }) {
  const label = normalizeSensorLifecycleStatus(record.sensorStatus);
  const color = getSensorLifecycleStatusColor(label);
  const foreground = getSensorLifecycleStatusForeground(label);

  return (
    <div
      style={{
        padding: "10px 14px",
        border: "1px solid var(--border)",
        borderRadius: 5,
        background: "var(--card)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span
          style={{
            fontSize: 10,
            fontWeight: 700,
            padding: "2px 8px",
            borderRadius: 5,
            background: color,
            color: foreground,
            textTransform: "uppercase",
            letterSpacing: ".04em",
            flexShrink: 0,
          }}
        >
          {label}
        </span>
        <div style={{ flex: 1, overflow: "hidden" }}>
          <div
            className="text-sm font-semibold"
            style={{
              color: "var(--foreground)",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {record.lineName}
          </div>
          <div style={{ fontSize: 11, color: "var(--muted-foreground)" }}>{record.areaId}</div>
        </div>
        <span className="text-muted-foreground" style={{ fontSize: 11, flexShrink: 0 }}>
          {record.chipId || "-"}
        </span>
      </div>

      <div className="mt-3 flex flex-col gap-3">
        <div>
          <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Remarks
          </label>
          <textarea
            value={draft.remarks}
            onChange={(event) => onDraftChange(record.id, { remarks: event.target.value })}
            placeholder="Optional"
            rows={2}
            disabled={disabled}
            style={{
              width: "100%",
              marginTop: 8,
              padding: "8px 10px",
              borderRadius: 5,
              fontSize: 13,
              resize: "vertical",
              boxSizing: "border-box",
              fontFamily: "inherit",
              outline: "none",
              border: "1.5px solid var(--border)",
              background: disabled ? "var(--muted)" : "var(--background)",
              color: "var(--foreground)",
            }}
          />
        </div>
      </div>
    </div>
  );
}

export function UploadDowntimeContent({ pendingDone, onUpload, onClose }) {
  const [drafts, setDrafts] = useState(() => buildDowntimeDrafts(pendingDone));
  const [saving, setSaving] = useState(false);
  const [apiError, setApiError] = useState(null);

  useEffect(() => {
    setDrafts(buildDowntimeDrafts(pendingDone));
  }, [pendingDone]);

  const updateDraft = (id, patch) => {
    setDrafts((previous) => ({
      ...previous,
      [id]: {
        ...(previous[id] ?? { remarks: "" }),
        ...patch,
      },
    }));
  };

  const handleUpload = async () => {
    setSaving(true);
    setApiError(null);

    try {
      const records = pendingDone.map((record) => ({
        ...record,
        remarks: drafts[record.id]?.remarks?.trim() ?? "",
      }));

      if (records.length > 0) {
        await uploadDowntimeRecords(records);
      }

      await onUpload();
      onClose();
    } catch (error) {
      setApiError(error.response?.data?.message ?? "Something went wrong.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <p className="text-sm text-muted-foreground">
        {pendingDone.length} record{pendingDone.length !== 1 ? "s" : ""} will be finalized and
        submitted.
      </p>
      {pendingDone.length === 0 ? (
        <p className="text-center text-sm text-muted-foreground" style={{ padding: "16px 0" }}>
          No records pending upload. Mark records as done first.
        </p>
      ) : (
        pendingDone.map((record) => (
          <PendingUploadRecord
            key={record.id}
            disabled={saving}
            draft={drafts[record.id] ?? { remarks: "" }}
            onDraftChange={updateDraft}
            record={record}
          />
        ))
      )}
      {apiError && <p className="text-sm text-destructive">{apiError}</p>}
      <div style={{ display: "flex", gap: 8 }}>
        <Button
          type="button"
          size="default"
          variant="outline"
          className="flex-1"
          style={{ cursor: "pointer" }}
          onClick={onClose}
          disabled={saving}
        >
          Cancel
        </Button>
        <Button
          type="button"
          size="default"
          variant="default"
          className="flex-1"
          style={{ cursor: "pointer" }}
          onClick={handleUpload}
          disabled={pendingDone.length === 0 || saving}
        >
          {saving ? "Uploading..." : "Upload"}
        </Button>
      </div>
    </div>
  );
}

