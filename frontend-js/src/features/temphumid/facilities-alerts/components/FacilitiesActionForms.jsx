import { useState } from "react";

import { Button } from "@/components/ui/button";

import { ACTION_OPTIONS } from "@/features/temphumid/facilities-alerts/utils/facilities";
import {
  scheduleFacilitiesAlert,
  verifyFacilitiesAlert,
} from "@/features/temphumid/shared/utils/api";

// Copied from the current temp/humid facilities route page as an additive scaffold.

export function FacilitiesScheduleForm({ alertId, onSubmit, onCancel }) {
  const [remarks, setRemarks] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleConfirm = async () => {
    setSubmitting(true);
    setError("");
    try {
      const updated = await scheduleFacilitiesAlert(alertId, {
        actionRemarks: remarks.trim() || null,
      });
      onSubmit(updated);
    } catch (err) {
      setError(err.response?.data?.message ?? "Failed to schedule. Please try again.");
      setSubmitting(false);
    }
  };

  return (
    <div
      style={{
        marginTop: 10,
        padding: "10px",
        background: "var(--background)",
        border: "1px solid var(--border)",
        borderRadius: 6,
        animation: "slideDown .15s ease",
      }}
    >
      <p
        style={{
          fontSize: 10,
          fontWeight: 700,
          color: "var(--muted-foreground)",
          margin: "0 0 7px",
          textTransform: "uppercase",
          letterSpacing: ".06em",
        }}
      >
        Schedule for maintenance
      </p>
      <textarea
        placeholder="Insert maintenance details or remarks"
        value={remarks}
        onChange={(event) => setRemarks(event.target.value)}
        rows={2}
        style={{
          width: "100%",
          padding: "5px 8px",
          borderRadius: 4,
          fontSize: 11,
          resize: "vertical",
          boxSizing: "border-box",
          fontFamily: "inherit",
          outline: "none",
          border: `1px solid ${error ? "#dc3545" : "var(--border)"}`,
          background: "var(--card)",
          color: "var(--foreground)",
          marginBottom: error ? 4 : 7,
          transition: "border-color .15s",
        }}
        onFocus={(event) => {
          if (!error) event.target.style.borderColor = "#435ebe";
        }}
        onBlur={(event) => {
          if (!error) event.target.style.borderColor = "var(--border)";
        }}
      />
      {error && <p style={{ fontSize: 10, color: "#dc3545", margin: "0 0 5px" }}>{error}</p>}
      <div style={{ display: "flex", gap: 5 }}>
        <Button
          variant="default"
          size="sm"
          className="flex-1 cursor-pointer"
          style={{ fontSize: 11, height: 28 }}
          disabled={submitting}
          onClick={handleConfirm}
        >
          {submitting ? "Scheduling..." : "Confirm"}
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="cursor-pointer"
          style={{ fontSize: 11, height: 28 }}
          disabled={submitting}
          onClick={onCancel}
        >
          Cancel
        </Button>
      </div>
    </div>
  );
}

export function FacilitiesVerifyForm({
  alertId,
  initialActionType,
  initialActionRemarks,
  lockedActionType,
  onSubmit,
  onCancel,
  onConflict,
}) {
  const [actionType, setActionType] = useState(
    lockedActionType ?? initialActionType ?? ""
  );
  const [actionRemarks, setActionRemarks] = useState(initialActionRemarks ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async () => {
    if (!actionType) {
      setError("Please select an action type.");
      return;
    }
    if (actionType === "others" && !actionRemarks.trim()) {
      setError("Please describe the action taken.");
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      const updated = await verifyFacilitiesAlert(alertId, {
        actionType,
        actionRemarks: actionRemarks.trim() || null,
      });
      onSubmit(updated);
    } catch (err) {
      if (err.response?.status === 409) {
        setError("Already actioned by someone else. Refreshing...");
        setTimeout(() => onConflict?.(), 800);
      } else {
        setError(err.response?.data?.message ?? "Failed to submit. Please try again.");
        setSubmitting(false);
      }
    }
  };

  return (
    <div
      style={{
        marginTop: 10,
        padding: "10px",
        background: "var(--background)",
        border: "1px solid var(--border)",
        borderRadius: 6,
        animation: "slideDown .15s ease",
      }}
    >
      <p
        style={{
          fontSize: 10,
          fontWeight: 700,
          color: "var(--muted-foreground)",
          margin: "0 0 7px",
          textTransform: "uppercase",
          letterSpacing: ".06em",
        }}
      >
        {lockedActionType ? "Confirm maintenance verification" : "Action taken"}
      </p>

      {!lockedActionType && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 7 }}>
          {ACTION_OPTIONS.map((option) => {
            const active = actionType === option.value;
            return (
              <button
                key={option.value}
                onClick={() => {
                  setActionType(option.value);
                  setError("");
                }}
                style={{
                  padding: "3px 9px",
                  borderRadius: 4,
                  fontSize: 11,
                  cursor: "pointer",
                  border: `1.5px solid ${active ? "#435ebe" : "var(--border)"}`,
                  background: active ? "#435ebe" : "transparent",
                  color: active ? "#fff" : "var(--foreground)",
                  transition: "all .1s",
                }}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      )}

      <textarea
        placeholder={
          actionType === "others"
            ? "Required: describe the action..."
            : "Insert details or remarks"
        }
        value={actionRemarks}
        onChange={(event) => setActionRemarks(event.target.value)}
        rows={2}
        style={{
          width: "100%",
          padding: "5px 8px",
          borderRadius: 4,
          fontSize: 11,
          resize: "vertical",
          boxSizing: "border-box",
          fontFamily: "inherit",
          outline: "none",
          border: `1px solid ${error ? "#dc3545" : "var(--border)"}`,
          background: "var(--card)",
          color: "var(--foreground)",
          marginBottom: error ? 4 : 7,
          transition: "border-color .15s",
        }}
        onFocus={(event) => {
          if (!error) event.target.style.borderColor = "#435ebe";
        }}
        onBlur={(event) => {
          if (!error) event.target.style.borderColor = "var(--border)";
        }}
      />
      {error && <p style={{ fontSize: 10, color: "#dc3545", margin: "0 0 5px" }}>{error}</p>}
      <div style={{ display: "flex", gap: 5 }}>
        <Button
          variant="default"
          size="sm"
          className="flex-1 cursor-pointer"
          style={{ fontSize: 11, height: 28 }}
          disabled={submitting}
          onClick={handleSubmit}
        >
          {submitting ? "Submitting..." : "Verify"}
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="cursor-pointer"
          style={{ fontSize: 11, height: 28 }}
          disabled={submitting}
          onClick={onCancel}
        >
          Cancel
        </Button>
      </div>
    </div>
  );
}

