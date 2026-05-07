import { useElapsedTimer } from "@/hooks/use-elapsed-timer";
import { MonitoringExpandableStatusCard } from "@/features/temphumid/sensor-status/components/MonitoringStatusCard";
import { StatusDot } from "@/features/temphumid/sensor-status/components/MonitoringStatusDots";
import {
  MonitoringSensorBreachActions,
  MonitoringSensorNoDataState,
  MonitoringSensorReadings,
} from "@/features/temphumid/sensor-status/components/MonitoringSensorStatusParts";
import { createFacilitiesAlert } from "@/features/temphumid/shared/utils/api";
import { formatTimer, parseUTC } from "@/utils/time";
import { STATUS_CONFIG, getSensorStatus } from "@/features/temphumid/sensor-status/utils/status";

// Copied from the current temp/humid monitoring route page as an additive scaffold.

export function MonitoringSensorStatusRow({
  sensor,
  index,
  notifyState,
  onNotifyStateChange,
  onForwarded,
}) {
  const status = getSensorStatus(sensor);
  const config = STATUS_CONFIG[status];
  const isBreach = status === "breach";
  const btnState = notifyState ?? "idle";
  const isForwarded = btnState === "forwarded";
  const isSending = btnState === "sending";

  const handleNotify = async () => {
    if (btnState !== "idle") return;
    onNotifyStateChange(sensor.areaId, "sending");

    try {
      await createFacilitiesAlert({
        areaId: sensor.areaId,
        lineName: sensor.name,
        temperature: sensor.temp,
        humidity: sensor.humid,
        tempUL: sensor.tempUL,
        tempLL: sensor.tempLL,
        humidUL: sensor.humidUL,
        humidLL: sensor.humidLL,
      });

      onForwarded(sensor.areaId);
      onNotifyStateChange(sensor.areaId, "forwarded");

      try {
        localStorage.setItem("facilitiesAlertSent", String(Date.now()));
      } catch {}
    } catch (error) {
      console.error("Notify Facilities failed:", error);
      onNotifyStateChange(sensor.areaId, "idle");
    }
  };

  return (
    <MonitoringExpandableStatusCard
      index={index}
      sensorName={sensor.name}
      status={status}
      body={
        sensor.hasData ? (
          <>
            <MonitoringSensorReadings sensor={sensor} config={config} />

            {isBreach && (
              <MonitoringSensorBreachActions
                isForwarded={isForwarded}
                isSending={isSending}
                onNotify={handleNotify}
              />
            )}
          </>
        ) : (
          <MonitoringSensorNoDataState config={config} />
        )
      }
    />
  );
}

export function MonitoringMaintenanceStatusRow({ sensor, index }) {
  const elapsed = useElapsedTimer(sensor.maintenanceStartedAt);
  const config = STATUS_CONFIG.maintenance;

  return (
    <div
      style={{
        background: config.bg,
        border: `1px solid ${config.color}25`,
        borderRadius: 5,
        marginBottom: 8,
        overflow: "hidden",
        animation: "slideIn .2s ease both",
        animationDelay: `${index * 0.05}s`,
      }}
    >
      <div style={{ padding: "12px 16px" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 10,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              minWidth: 0,
              flex: 1,
            }}
          >
            <StatusDot status="maintenance" size={8} />
            <span
              style={{
                fontWeight: 600,
                fontSize: 14,
                color: config.color,
                lineHeight: 1.2,
                wordBreak: "break-word",
              }}
            >
              {sensor.name}
            </span>
          </div>

          <span
            style={{
              fontSize: 10,
              fontWeight: 700,
              padding: "2px 7px",
              borderRadius: 5,
              background: config.color,
              color: "#fff",
              letterSpacing: ".04em",
              textTransform: "uppercase",
              flexShrink: 0,
            }}
          >
            Maintenance
          </span>
        </div>

        <div
          style={{
            marginTop: 10,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 8,
          }}
        >
          <div style={{ fontSize: 11, color: config.color, fontWeight: 600 }}>
            Started: {parseUTC(sensor.maintenanceStartedAt)?.toLocaleString() ?? "unknown"}
          </div>

          <div
            style={{
              fontSize: 12,
              fontWeight: 700,
              color: config.color,
              fontFamily: "monospace",
              flexShrink: 0,
            }}
          >
            {formatTimer(elapsed)}
          </div>
        </div>
      </div>
    </div>
  );
}



