import { useEffect, useState } from "react";

import {
  BreachDot,
  StatusDot,
} from "@/features/temphumid/sensor-status/components/MonitoringStatusDots";
import {
  MonitoringAllClearState,
  MonitoringIssueState,
} from "@/components/custom/temphumid/components/MonitoringFloorStates";
import {
  buildMonitoringFloorSections,
  buildMonitoringNotifyStateMap,
} from "@/utils/monitoring";
import { STATUS_CONFIG, getFloorStatus, getFloorSummary } from "@/features/temphumid/sensor-status/utils/status";

// Copied from the current temp/humid monitoring route page as an additive scaffold.

export function MonitoringFloorModal({
  floor,
  onClose,
  forwardedAreaIds,
  onForwarded,
  currentUser,
}) {
  const floorStatus = getFloorStatus(floor);
  const summary = getFloorSummary(floor);
  const config = STATUS_CONFIG[floorStatus];
  const isBreach = floorStatus === "breach";
  const isAllGood = floorStatus === "active";

  const [notifyStates, setNotifyStates] = useState(() =>
    buildMonitoringNotifyStateMap(floor, forwardedAreaIds)
  );

  useEffect(() => {
    setNotifyStates(buildMonitoringNotifyStateMap(floor, forwardedAreaIds));
  }, [floor, forwardedAreaIds]);

  useEffect(() => {
    const handler = (event) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const handleNotifyStateChange = (areaId, state) => {
    setNotifyStates((previous) => ({ ...previous, [areaId]: state }));
  };

  const { activeSensors, counts, flaggedSensors, maintenanceSensors } =
    buildMonitoringFloorSections(floor);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 100,
        background: "rgba(0,0,0,.65)",
        display: "flex",
        flexDirection: "column",
        animation: "slideIn .18s ease",
      }}
    >
      <div
        style={{
          flex: 1,
          background: "var(--card)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            padding: "14px 24px",
            borderBottom: "1px solid var(--border)",
            background: "var(--card)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {isBreach && <BreachDot />}
            {!isBreach && !isAllGood && <StatusDot status={floorStatus} size={10} />}
            <span style={{ fontWeight: 700, fontSize: 18, color: "var(--foreground)" }}>
              {floor.label}
            </span>
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                padding: "3px 8px",
                borderRadius: 5,
                background: config.color,
                color: "#fff",
              }}
            >
              {summary}
            </span>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              fontSize: 24,
              cursor: "pointer",
              color: "var(--muted-foreground)",
              lineHeight: 1,
              padding: "0 4px",
            }}
          >
            {"\u00D7"}
          </button>
        </div>

        <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
          <div
            style={{
              flex: 1,
              overflow: "hidden",
              position: "relative",
              background: "var(--muted)",
            }}
          >
            <img
              src={floor.image}
              alt={floor.label}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "contain",
                display: "block",
                userSelect: "none",
              }}
            />
          </div>

          <div
            style={{
              width: 320,
              flexShrink: 0,
              borderLeft: "1px solid var(--border)",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
              background: "var(--card)",
            }}
          >
            <div style={{ flex: 1, overflowY: "auto", padding: "16px" }}>
              {isAllGood ? (
                <MonitoringAllClearState floorLabel={floor.label} />
              ) : (
                <MonitoringIssueState
                  activeSensors={activeSensors}
                  counts={counts}
                  currentUser={currentUser}
                  flaggedSensors={flaggedSensors}
                  maintenanceSensors={maintenanceSensors}
                  notifyStates={notifyStates}
                  onForwarded={onForwarded}
                  onNotifyStateChange={handleNotifyStateChange}
                />
              )}
            </div>

            <div
              style={{
                padding: "12px 16px",
                borderTop: "1px solid var(--border)",
                background: "var(--card)",
              }}
            >
              <a
                href={floor.href}
                style={{
                  display: "block",
                  textAlign: "center",
                  padding: "10px",
                  borderRadius: 5,
                  background: "#435ebe",
                  color: "#fff",
                  fontWeight: 700,
                  fontSize: 13,
                  textDecoration: "none",
                  cursor: "pointer",
                  transition: "background .15s",
                }}
                onMouseEnter={(event) => {
                  event.currentTarget.style.background = "#3347a8";
                }}
                onMouseLeave={(event) => {
                  event.currentTarget.style.background = "#435ebe";
                }}
              >
                Open Full Map
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}


