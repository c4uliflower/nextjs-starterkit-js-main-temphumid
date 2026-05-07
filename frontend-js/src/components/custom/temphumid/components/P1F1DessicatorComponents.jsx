import { InactiveAreaBadge } from "@/components/ui/inactiveareabadge";
import {
  STATUS_STYLES,
  getPaneStatus,
} from "@/features/temphumid/sensor-status/utils/status";

// Copied from the current temp/humid p1f1 route page as an additive scaffold.

export function getDessicatorZoneStatus(sensors) {
  if (!sensors || !Array.isArray(sensors) || sensors.length === 0) {
    return "no-data";
  }
  if (sensors.every((sensor) => !sensor.hasData)) return "no-data";
  if (sensors.some((sensor) => getPaneStatus(sensor) === "breach")) {
    return "breach";
  }
  return "ok";
}

export function DessicatorZoneMarker({ zone, open, onToggle, sensors }) {
  const zoneStatus = getDessicatorZoneStatus(sensors);
  const breachCount = sensors.filter(
    (sensor) => getPaneStatus(sensor) === "breach"
  ).length;
  const dotColor = STATUS_STYLES[zoneStatus].border;

  return (
    <div
      onClick={onToggle}
      style={{
        position: "absolute",
        left: `${zone.x}%`,
        top: `${zone.y}%`,
        transform: "translate(-50%, -50%)",
        zIndex: open ? 25 : 15,
        cursor: "pointer",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 4,
          background: open ? "#435ebe" : "var(--card)",
          border: `2px solid ${open ? "#435ebe" : "var(--border)"}`,
          borderRadius: 6,
          padding: "3px 7px",
          boxShadow: "0 2px 8px rgba(0,0,0,.2)",
          whiteSpace: "nowrap",
          transition: "all .15s",
        }}
      >
        <div
          style={{
            width: 7,
            height: 7,
            borderRadius: "50%",
            background: dotColor,
            flexShrink: 0,
          }}
        />
        <span
          style={{
            fontSize: 10,
            fontWeight: 700,
            color: open ? "#fff" : "var(--foreground)",
            letterSpacing: ".04em",
          }}
        >
          DESSICATORS
        </span>
        {breachCount > 0 && (
          <span
            style={{
              fontSize: 9,
              fontWeight: 700,
              background: "#dc3545",
              color: "#fff",
              borderRadius: 8,
              padding: "1px 4px",
              marginLeft: 2,
            }}
          >
            {breachCount}
          </span>
        )}
      </div>
      {open && (
        <div
          style={{
            position: "absolute",
            bottom: "calc(100% + -150px)",
            left: "-32%",
            transform: "translateY(-50%)",
            zIndex: 35,
            background: "var(--card)",
            border: "1.5px solid var(--border)",
            borderRadius: 10,
            padding: "10px 12px",
            boxShadow: "0 6px 20px rgba(0,0,0,.18)",
            minWidth: 220,
            pointerEvents: "none",
          }}
        >
          <div
            style={{
              position: "absolute",
              bottom: -8,
              left: "50%",
              transform: "translateX(-50%)",
              width: 0,
              height: 0,
              borderLeft: "7px solid transparent",
              borderRight: "7px solid transparent",
              borderTop: "8px solid #dee2e6",
            }}
          />
          <div
            style={{
              position: "absolute",
              bottom: -6,
              left: "50%",
              transform: "translateX(-50%)",
              width: 0,
              height: 0,
              borderLeft: "6px solid transparent",
              borderRight: "6px solid transparent",
              borderTop: "7px solid #fff",
            }}
          />
          <div
            style={{
              fontSize: 10,
              fontWeight: 700,
              color: "var(--muted-foreground)",
              textTransform: "uppercase",
              letterSpacing: ".08em",
              marginBottom: 8,
            }}
          >
            Dessicators
          </div>
          {sensors.map((sensor) => {
            const status = getPaneStatus(sensor);
            const style = STATUS_STYLES[status];
            const limits = sensor.limits ?? { humidUL: "?" };
            const isInactiveBreach =
              status === "inactive-breach" || sensor.activeLocation === false;

            return (
              <div
                key={sensor.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 10,
                  padding: "5px 8px",
                  borderRadius: 6,
                  marginBottom: 4,
                  background: style.bg,
                  border: `1px solid ${style.border}`,
                }}
              >
                <div>
                  <div
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      color: style.text,
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                      flexWrap: "wrap",
                    }}
                  >
                    {sensor.name}
                    {isInactiveBreach && <InactiveAreaBadge />}
                  </div>
                  {sensor.hasData ? (
                    <div style={{ fontSize: 10, color: "#6c757d" }}>
                      {sensor.temp?.toFixed(1)}°C · {sensor.humid?.toFixed(1)}%{" "}
                      <span style={{ opacity: 0.6 }}>
                        (H{"<="}
                        {limits.humidUL}%)
                      </span>
                    </div>
                  ) : (
                    <div style={{ fontSize: 10, color: "#adb5bd" }}>No data</div>
                  )}
                </div>
                <div
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    background: style.dot,
                    flexShrink: 0,
                  }}
                />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function DessicatorCard({ sensor }) {
  const status = getPaneStatus(sensor);
  const style = STATUS_STYLES[status];
  const isInactiveBreach =
    status === "inactive-breach" || sensor.activeLocation === false;

  return (
    <div
      style={{
        background: style.bg,
        border: `2px solid ${style.border}`,
        borderRadius: 8,
        padding: "8px 12px",
        color: style.text,
        flex: 1,
        minWidth: 0,
        boxShadow: "0 4px 12px rgba(0,0,0,.1)",
      }}
    >
      <div
        style={{
          fontWeight: 700,
          fontSize: 12,
          marginBottom: 4,
          display: "flex",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 4,
        }}
      >
        {sensor.name}
        {isInactiveBreach && <InactiveAreaBadge />}
      </div>
      {sensor.hasData ? (
        <>
          <div style={{ fontSize: 12 }}>
            Temp: <strong>{sensor.temp?.toFixed(2)}°C</strong>
          </div>
          <div style={{ fontSize: 12 }}>
            Humidity: <strong>{sensor.humid?.toFixed(2)}%</strong>
          </div>
        </>
      ) : (
        <div style={{ fontSize: 12, opacity: 0.75 }}>No data available</div>
      )}
    </div>
  );
}

