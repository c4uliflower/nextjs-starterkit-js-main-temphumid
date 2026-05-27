"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";

import { markDowntimeDone } from "@/features/temphumid/shared/utils/api";

export function MarkDoneContent({ record, onDone, onClose }) {
  const [remarks, setRemarks] = useState("");
  const [saving, setSaving] = useState(false);
  const [apiError, setApiError] = useState(null);

  const reset = () => {
    setRemarks("");
    setSaving(false);
    setApiError(null);
  };

  const handleConfirm = async () => {
    setSaving(true);
    setApiError(null);

    try {
      const data = await markDowntimeDone(record.id, {
        remarks: remarks.trim() || null,
      });

      onDone(record.id, null, {
        markedDoneAt: data.marked_done_at,
        durationSeconds: data.duration_seconds,
        remarks: data.remarks ?? "",
      });

      reset();
      onClose();
    } catch (error) {
      setApiError(error.response?.data?.message ?? "Something went wrong.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div
        style={{
          background: "var(--primary)",
          borderRadius: 5,
          color: "var(--primary-foreground)",
          padding: "10px 14px",
        }}
      >
        <div style={{ fontSize: 14, fontWeight: 700, lineHeight: 1.25 }}>
          {record.lineName}
        </div>
        <div style={{ fontSize: 12, fontWeight: 600, lineHeight: 1.35, opacity: 0.82 }}>
          {record.areaId}
        </div>
      </div>

      <div>
        <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Remarks
        </label>
        <textarea
          value={remarks}
          onChange={(event) => setRemarks(event.target.value)}
          placeholder="Additional details..."
          rows={3}
          disabled={saving}
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
            background: saving ? "var(--muted)" : "var(--background)",
            color: "var(--foreground)",
            transition: "border-color .15s",
          }}
          onFocus={(event) => {
            event.target.style.borderColor = "var(--primary)";
          }}
          onBlur={(event) => {
            event.target.style.borderColor = "var(--border)";
          }}
        />
      </div>

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
          onClick={handleConfirm}
          disabled={saving}
        >
          {saving ? "Saving..." : "Confirm & Mark Done"}
        </Button>
      </div>
    </div>
  );
}

