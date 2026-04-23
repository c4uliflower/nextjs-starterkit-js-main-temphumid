import { useState } from "react";

import { Button } from "@/components/ui/button";

import { FacilitiesAlertActions } from "@/features/temphumid/facilities-alerts/components/FacilitiesAlertActions";
import {
  FacilitiesAlertCardHeader,
  FacilitiesAlertDetails,
} from "@/features/temphumid/facilities-alerts/components/FacilitiesAlertCardParts";
import { useElapsedTimer } from "@/hooks/use-elapsed-timer";
import {
  getFacilitiesAlertState,
  getFacilitiesVerifyState,
} from "@/features/temphumid/facilities-alerts/utils/facilities";
import {
  acknowledgeFacilitiesAlert,
  unscheduleFacilitiesAlert,
} from "@/features/temphumid/shared/utils/api";

// Copied from the current temp/humid facilities route page as an additive scaffold.

export function FacilitiesAlertCard({
  alert,
  col,
  onAcknowledge,
  onResolve,
  onConflict,
}) {
  const [expanded, setExpanded] = useState(false);
  const [activeForm, setActiveForm] = useState(null);
  const [acting, setActing] = useState(false);
  const [actionError, setActionError] = useState("");

  const alertState = getFacilitiesAlertState(alert);
  const verifyState = getFacilitiesVerifyState(alert);
  const elapsed = useElapsedTimer(alert.maintenanceStartedAt);

  const closeForm = () => setActiveForm(null);

  const handleAcknowledge = async () => {
    setActing(true);
    setActionError("");
    try {
      const updated = await acknowledgeFacilitiesAlert(alert.id);
      onAcknowledge(updated);
    } catch (err) {
      if (err.response?.status === 409) {
        setActionError("Already actioned by someone else. Refreshing...");
        onConflict();
      } else {
        setActionError(err.response?.data?.message ?? "Failed to open. Please try again.");
        setActing(false);
      }
    }
  };

  const handleUnschedule = async () => {
    setActing(true);
    setActionError("");
    try {
      const updated = await unscheduleFacilitiesAlert(alert.id);
      onResolve(updated);
    } catch (err) {
      setActionError(err.response?.data?.message ?? "Failed to cancel maintenance.");
    } finally {
      setActing(false);
    }
  };

  return (
    <div
      style={{
        background: "var(--card)",
        border: "1px solid var(--border)",
        borderLeft: `3px solid ${alertState.isEscalated ? "#dc2626" : col.accent}`,
        borderRadius: 6,
        overflow: "hidden",
        opacity: acting ? 0.6 : 1,
        transition: "opacity .15s",
      }}
    >
      <FacilitiesAlertCardHeader
        alert={alert}
        alertState={alertState}
        col={col}
        elapsed={elapsed}
        onToggle={() => !acting && setExpanded((value) => !value)}
        verifyState={verifyState}
      />

      {expanded && (
        <div
          style={{
            borderTop: "1px solid var(--border)",
            padding: "10px 12px",
            background: "var(--card)",
          }}
        >
          <FacilitiesAlertDetails alert={alert} />

          {actionError && (
            <p
              style={{
                fontSize: 11,
                color: "#b45309",
                margin: "0 0 6px",
                background: "#fff7ed",
                border: "1px solid #f59e0b44",
                borderRadius: 4,
                padding: "4px 8px",
              }}
            >
              {actionError}
            </p>
          )}

          {alertState.isAcknowledged && (
            <Button
              variant="outline"
              size="sm"
              className="w-full cursor-pointer"
              style={{ fontSize: 11, height: 30 }}
              disabled={acting}
              onClick={handleAcknowledge}
            >
              {acting ? "Opening..." : "Open"}
            </Button>
          )}

          <FacilitiesAlertActions
            activeForm={activeForm}
            alert={alert}
            alertState={alertState}
            acting={acting}
            onCloseForm={closeForm}
            onConflict={onConflict}
            onOpenSchedule={() => setActiveForm("schedule")}
            onOpenVerify={() => setActiveForm("verify")}
            onResolve={onResolve}
            onUnschedule={handleUnschedule}
          />
        </div>
      )}
    </div>
  );
}

export function FacilitiesKanbanColumn({
  col,
  alerts,
  onAcknowledge,
  onResolve,
  onConflict,
}) {
  return (
    <div
      style={{
        flex: 1,
        minWidth: 0,
        display: "flex",
        flexDirection: "column",
        background: "var(--card)",
        border: "1px solid var(--border)",
        borderRadius: 8,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          padding: "12px 16px",
          borderBottom: "1px solid var(--border)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexShrink: 0,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: col.dot,
              display: "inline-block",
              flexShrink: 0,
            }}
          />
          <span style={{ fontSize: 13, fontWeight: 700, color: "var(--foreground)" }}>
            {col.label}
          </span>
        </div>
        <span
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: "var(--foreground)",
            background: "var(--muted)",
            borderRadius: 5,
            padding: "1px 8px",
          }}
        >
          {alerts.length}
        </span>
      </div>
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "10px",
          display: "flex",
          flexDirection: "column",
          gap: 8,
          minHeight: 200,
        }}
      >
        {alerts.length === 0 ? (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "40px 12px",
              flex: 1,
            }}
          >
            <p
              style={{
                fontSize: 12,
                color: "var(--muted-foreground)",
                textAlign: "center",
                margin: 0,
              }}
            >
              No {col.label.toLowerCase()} alerts
            </p>
          </div>
        ) : (
          alerts.map((alert) => (
            <FacilitiesAlertCard
              key={alert.id}
              alert={alert}
              col={col}
              onAcknowledge={onAcknowledge}
              onResolve={onResolve}
              onConflict={onConflict}
            />
          ))
        )}
      </div>
    </div>
  );
}



