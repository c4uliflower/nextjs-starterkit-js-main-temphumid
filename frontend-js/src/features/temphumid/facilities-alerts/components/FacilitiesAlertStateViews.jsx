import { Button } from "@/components/ui/button";

import {
  getFacilitiesActionLabel,
  getFacilitiesVerifyState,
} from "@/features/temphumid/facilities-alerts/utils/facilities";

export function FacilitiesScheduledOpenActions({
  alert,
  acting,
  onOpenVerify,
  onUnschedule,
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {alert.verifyAttemptCount > 0 && (
        <p style={{ fontSize: 11, color: "#b45309", margin: 0 }}>
          Previous verification failed - sensor still breaching.
        </p>
      )}
      <p style={{ fontSize: 11, color: "var(--muted-foreground)", margin: 0 }}>
        Complete maintenance, then verify the sensor is back within limits.
      </p>
      <Button
        variant="default"
        size="sm"
        className="w-full cursor-pointer"
        style={{ fontSize: 11, height: 30 }}
        disabled={acting}
        onClick={onOpenVerify}
      >
        {alert.actionType === "repair" ? "Verify Post-Repair" : "Verify Post-Maintenance"}
      </Button>
      <Button
        variant="outline"
        size="sm"
        className="w-full cursor-pointer"
        style={{
          fontSize: 11,
          height: 30,
          color: "var(--foreground)",
          borderColor: "var(--border)",
        }}
        disabled={acting}
        onClick={onUnschedule}
      >
        Cancel
      </Button>
    </div>
  );
}

export function FacilitiesUnscheduledOpenActions({
  alert,
  acting,
  onOpenRepair,
  onOpenSchedule,
  onOpenVerify,
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {alert.actionType && (
        <>
          <span
            style={{
              fontSize: 10,
              fontWeight: 700,
              padding: "2px 8px",
              borderRadius: 20,
              background: "#eff6ff",
              color: "#1d4ed8",
              border: "1px solid #bfdbfe",
              alignSelf: "flex-start",
            }}
          >
            {getFacilitiesActionLabel(alert)}
          </span>
          <p style={{ fontSize: 11, color: "#b45309", margin: 0 }}>
            Previous verification failed - sensor still breaching. Try again or schedule for
            maintenance.
          </p>
        </>
      )}
      {!alert.actionType && (
        <p style={{ fontSize: 11, color: "var(--muted-foreground)", margin: 0 }}>
          No action taken yet. Verify the sensor or schedule for maintenance.
        </p>
      )}
      <Button
        variant="default"
        size="sm"
        className="w-full cursor-pointer"
        style={{ fontSize: 11, height: 30 }}
        disabled={acting}
        onClick={onOpenVerify}
      >
        Verify
      </Button>
      <Button
        variant="outline"
        size="sm"
        className="w-full cursor-pointer"
        style={{ fontSize: 11, height: 30 }}
        disabled={acting}
        onClick={onOpenSchedule}
      >
        Schedule for maintenance
      </Button>
      <Button
        variant="outline"
        size="sm"
        className="w-full cursor-pointer"
        style={{ fontSize: 11, height: 30 }}
        disabled={acting}
        onClick={onOpenRepair}
      >
        Queue for repair
      </Button>
    </div>
  );
}

export function FacilitiesVerifyingAlertState({ alert }) {
  const verifyState = getFacilitiesVerifyState(alert);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <Button
        variant="outline"
        size="sm"
        className="w-full cursor-pointer"
        style={{
          fontSize: 11,
          height: 30,
          borderColor: verifyState.isStale ? "#fca5a5" : "#bfdbfe",
          color: verifyState.isStale ? "#b91c1c" : "var(--foreground)",
          background: verifyState.isStale ? "#fef2f2" : "transparent",
        }}
        disabled
      >
        {verifyState.isStale
          ? `No reading received - ${verifyState.minsWaiting}m waiting`
          : "Waiting for the next reading..."}
      </Button>
      {verifyState.isStale && (
        <p
          style={{
            fontSize: 10,
            color: "#b91c1c",
            margin: 0,
            padding: "4px 8px",
            borderRadius: 4,
            background: "#fef2f2",
            border: "1px solid #fca5a544",
          }}
        >
          No post-verification reading in {verifyState.minsWaiting}m. Sensor may be offline or
          disconnected.
        </p>
      )}
    </div>
  );
}

