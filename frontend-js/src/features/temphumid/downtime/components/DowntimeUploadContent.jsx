"use client";

import { useEffect, useState } from "react";

import { Combobox } from "@/components/custom/Combobox";
import { Button } from "@/components/ui/button";

import {
  DOWNTIME_REASONS,
  getDowntimeSymptomColor,
  getDowntimeSymptomLabel,
  REASON_SELECT_OPTIONS,
} from "@/features/temphumid/downtime/utils/downtime";
import { uploadDowntimeRecords } from "@/features/temphumid/shared/utils/api";

function getDowntimeReasonId(value) {
  if (!value) return "";
  return DOWNTIME_REASONS.find((reason) => reason.id === value || reason.label === value)?.id ?? "";
}

function getDowntimeReasonLabel(value) {
  if (!value) return "";
  return DOWNTIME_REASONS.find((reason) => reason.id === value)?.label ?? value;
}

function buildDowntimeDrafts(records) {
  return records.reduce((drafts, record) => {
    drafts[record.id] = {
      reason: getDowntimeReasonId(record.reason),
      remarks: record.remarks ?? "",
    };
    return drafts;
  }, {});
}

function PendingUploadRecord({ disabled, draft, onDraftChange, record }) {
  const label = getDowntimeSymptomLabel(record.symptom) || "Unknown";
  const color = getDowntimeSymptomColor(label);

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
            color: "#fff",
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
          {record.symptom}
        </span>
      </div>

      <div className="mt-3 flex flex-col gap-3">
        <div>
          <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Reason
          </label>
          <Combobox
            options={REASON_SELECT_OPTIONS}
            value={draft.reason}
            onValueChange={(value) => onDraftChange(record.id, { reason: value })}
            placeholder="Optional"
            disabled={disabled}
            className="mt-2 w-full"
          />
        </div>
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
        ...(previous[id] ?? { reason: "", remarks: "" }),
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
        reason: getDowntimeReasonLabel(drafts[record.id]?.reason ?? ""),
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
            draft={drafts[record.id] ?? { reason: "", remarks: "" }}
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

