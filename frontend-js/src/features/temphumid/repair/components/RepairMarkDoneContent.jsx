"use client";

import { useState } from "react";

import { Combobox } from "@/components/custom/Combobox";
import { Button } from "@/components/ui/button";

import {
  REPAIR_REASON_OPTIONS,
  REPAIR_REASONS,
} from "@/features/temphumid/repair/utils/repair";
import { markRepairDone } from "@/features/temphumid/shared/utils/api";

export function MarkRepairDoneContent({ record, onDone, onClose }) {
  const [reason, setReason] = useState("");
  const [remarks, setRemarks] = useState("");
  const [saving, setSaving] = useState(false);
  const [apiError, setApiError] = useState(null);

  const reset = () => {
    setReason("");
    setRemarks("");
    setSaving(false);
    setApiError(null);
  };

  const handleConfirm = async () => {
    if (!reason || !remarks.trim()) return;

    setSaving(true);
    setApiError(null);

    try {
      const reasonLabel = REPAIR_REASONS.find((item) => item.id === reason)?.label ?? reason;
      const data = await markRepairDone(record.id, {
        repair_reason: reasonLabel,
        remarks: remarks.trim(),
      });

      onDone(record.id, reason, {
        markedDoneAt: data.marked_done_at,
        durationSeconds: data.duration_seconds,
        reasonLabel,
        remarks: data.remarks,
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
      <div>
        <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Reason for Repair <span style={{ color: "#dc3545" }}>*</span>
        </label>
        <Combobox
          options={REPAIR_REASON_OPTIONS}
          value={reason}
          onValueChange={setReason}
          placeholder="Select reason..."
          disabled={saving}
          className="mt-2 w-full"
        />
      </div>

      <div>
        <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Remarks <span style={{ color: "#dc3545" }}>*</span>
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
            event.target.style.borderColor = "#0f766e";
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
          disabled={!reason || !remarks.trim() || saving}
        >
          {saving ? "Saving..." : "Confirm & Mark Done"}
        </Button>
      </div>
    </div>
  );
}
