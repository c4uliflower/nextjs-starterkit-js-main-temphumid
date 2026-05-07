"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";

import {
  getDowntimeSymptomColor,
  getDowntimeSymptomLabel,
} from "@/features/temphumid/downtime/utils/downtime";
import { uploadDowntimeRecords } from "@/features/temphumid/shared/utils/api";

function PendingUploadRecord({ record }) {
  const label = getDowntimeSymptomLabel(record.symptom) || "Unknown";
  const color = getDowntimeSymptomColor(label);

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "10px 14px",
        border: "1px solid var(--border)",
        borderRadius: 5,
        background: "var(--card)",
      }}
    >
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
  );
}

export function UploadDowntimeContent({ pendingDone, onUpload, onClose }) {
  const [saving, setSaving] = useState(false);
  const [apiError, setApiError] = useState(null);

  const handleUpload = async () => {
    setSaving(true);
    setApiError(null);

    try {
      const ids = pendingDone.map((record) => Number(record.id));

      if (ids.length > 0) {
        await uploadDowntimeRecords(ids);
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
        pendingDone.map((record) => <PendingUploadRecord key={record.id} record={record} />)
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

