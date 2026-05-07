import {
  FacilitiesBreachReadingsPanel,
} from "@/features/temphumid/facilities-alerts/components/FacilitiesBreachReadings";
import {
  formatFacilitiesReadingSummary,
  getFacilitiesActionLabel,
} from "@/features/temphumid/facilities-alerts/utils/facilities";
import {
  formatAbsolute,
  formatRelative,
} from "@/utils/time";

export function FacilitiesAlertCardHeader({
  alert,
  alertState,
  col,
  onToggle,
  verifyState,
}) {
  return (
    <div
      onClick={onToggle}
      style={{ padding: "10px 12px", cursor: "pointer", userSelect: "none" }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 6,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
          <span
            style={{
              width: 7,
              height: 7,
              borderRadius: "50%",
              flexShrink: 0,
              background: alertState.isEscalated ? "#dc2626" : col.dot,
              display: "inline-block",
              animation:
                alertState.isEscalated && alertState.isAcknowledged
                  ? "dotPulse 1.4s ease-in-out infinite"
                  : "none",
            }}
          />
          <span
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: "var(--foreground)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {alert.lineName}
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
          {(alertState.isOpen || alertState.isVerifying) && (
            <>
              {alert.actionType && (
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 800,
                    padding: "0px 5px",
                    borderRadius: 5,
                    flexShrink: 0,
                    background: "#fef3c7",
                    color: "#92400e",
                    border: "1px solid #fcd34d",
                    letterSpacing: ".04em",
                  }}
                >
                  {getFacilitiesActionLabel(alert)}
                </span>
              )}
            </>
          )}
          {alertState.isVerifying && (
            <span
              style={{
                fontSize: 11,
                fontWeight: 800,
                padding: "0px 5px",
                borderRadius: 5,
                flexShrink: 0,
                background: verifyState.isStale ? "#fef2f2" : "#eff6ff",
                color: verifyState.isStale ? "#b91c1c" : "#1d4ed8",
                border: verifyState.isStale ? "1px solid #fca5a5" : "1px solid #bfdbfe",
                letterSpacing: ".04em",
              }}
            >
              {verifyState.isStale ? "Verifying - No reading" : "Verifying..."}
            </span>
          )}
          {alertState.isEscalated && (
            <span
              style={{
                fontSize: 11,
                fontWeight: 800,
                padding: "0px 5px",
                borderRadius: 5,
                flexShrink: 0,
                background: "#fee2e2",
                color: "#dc2626",
                border: "1px solid #fca5a5",
                letterSpacing: ".04em",
              }}
            >
              {alertState.delayedLabel}
            </span>
          )}
        </div>
      </div>
      <div
        style={{
          paddingLeft: 13,
          marginTop: 3,
          display: "flex",
          flexDirection: "column",
          gap: 1,
        }}
      >
        <span style={{ fontSize: 11, color: "var(--muted-foreground)" }}>{alert.areaId}</span>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span
            style={{
              fontSize: 11,
              color: "var(--muted-foreground)",
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {formatFacilitiesReadingSummary(alert)}
          </span>
          <span style={{ fontSize: 11, color: "var(--muted-foreground)" }}>
            {formatRelative(alert.acknowledgedAt)}
          </span>
        </div>
      </div>
    </div>
  );
}

export function FacilitiesAlertDetails({ alert }) {
  return (
    <div
      style={{
        fontSize: 11,
        color: "var(--muted-foreground)",
        display: "flex",
        flexDirection: "column",
        gap: 3,
        marginBottom: 10,
      }}
    >
      <div>
        <span style={{ fontWeight: 600, color: "var(--foreground)" }}>Temp</span>{" "}
        {alert.temperature?.toFixed(2)}
        {"\u00B0C"}
        <span style={{ opacity: 0.65, marginLeft: 3 }}>
          ({alert.tempLL}
          {"\u2013"}
          {alert.tempUL}
          {"\u00B0C"})
        </span>
      </div>
      <div>
        <span style={{ fontWeight: 600, color: "var(--foreground)" }}>Humid</span>{" "}
        {alert.humidity?.toFixed(2)}%
        <span style={{ opacity: 0.65, marginLeft: 3 }}>
          ({alert.humidLL}
          {"\u2013"}
          {alert.humidUL}%)
        </span>
      </div>
      <div style={{ marginTop: 3 }}>
        Acknowledged by <strong style={{ color: "var(--foreground)" }}>{alert.acknowledgedBy}</strong>
        <br />
        <span>{formatAbsolute(alert.acknowledgedAt)}</span>
      </div>
      {alert.openedBy && (
        <div>
          Opened by <strong style={{ color: "var(--foreground)" }}>{alert.openedBy}</strong>
          <br />
          <span>{formatAbsolute(alert.openedAt)}</span>
        </div>
      )}
      {alert.verifiedBy && (
        <div>
          Verified by <strong style={{ color: "var(--foreground)" }}>{alert.verifiedBy}</strong>
          <br />
          <span>{formatAbsolute(alert.verifiedAt)}</span>
        </div>
      )}

      <div style={{ marginTop: 5, marginBottom: 5, borderTop: "1px solid var(--border)" }}>
        <FacilitiesBreachReadingsPanel alertId={alert.id} compact />
      </div>

      <div style={{ borderTop: "1px solid var(--border)" }} />
    </div>
  );
}


