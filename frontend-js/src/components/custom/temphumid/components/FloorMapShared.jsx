import { InactiveAreaBadge } from "@/components/ui/inactiveareabadge";
import { getPaneDirection, getPaneStatus, STATUS_STYLES } from "@/features/temphumid/sensor-status/utils/status";

// Copied from the current temp/humid floor-map route pages as an additive scaffold.

export function SensorPane({ sensor }) {
  const status = getPaneStatus(sensor);
  const style = STATUS_STYLES[status];
  const lim = sensor.limits ?? { tempUL: "?", tempLL: "?", humidUL: "?", humidLL: "?" };
  const isInactiveBreach = status === "inactive-breach" || sensor.activeLocation === false;

  return (
    <div
      style={{
        background: style.bg,
        border: `2px solid ${style.border}`,
        borderRadius: 8,
        padding: "8px 12px",
        minWidth: 155,
        color: style.text,
        boxShadow: "0 4px 12px rgba(0,0,0,.18)",
        pointerEvents: "none",
        whiteSpace: "nowrap",
      }}
    >
      <div
        style={{
          fontWeight: 700,
          fontSize: 13,
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
            <span style={{ fontSize: 10, color: "#adb5bd", marginLeft: 4 }}>
              {lim.tempLL}-{lim.tempUL}°C
            </span>
          </div>
          <div style={{ fontSize: 12 }}>
            Humid: <strong>{sensor.humid?.toFixed(2)}%</strong>
            <span style={{ fontSize: 10, color: "#adb5bd", marginLeft: 4 }}>
              {lim.humidLL}-{lim.humidUL}%
            </span>
          </div>
        </>
      ) : (
        <div style={{ fontSize: 12, opacity: 0.75 }}>No data available</div>
      )}
    </div>
  );
}

export function SensorMarker({ sensor, selected, onToggle }) {
  const isWhite = sensor.color === "#ffffff";
  const dir = getPaneDirection(sensor);
  const status = getPaneStatus(sensor);
  const arrowBase = { position: "absolute", width: 0, height: 0, border: "7px solid transparent" };
  const arrowStyle = {
    top: {
      ...arrowBase,
      bottom: -13,
      left: "50%",
      transform: "translateX(-50%)",
      borderTopColor: STATUS_STYLES[status].border,
      borderBottom: "none",
    },
    bottom: {
      ...arrowBase,
      top: -13,
      left: "50%",
      transform: "translateX(-50%)",
      borderBottomColor: STATUS_STYLES[status].border,
      borderTop: "none",
    },
    left: {
      ...arrowBase,
      right: -13,
      top: "50%",
      transform: "translateY(-50%)",
      borderLeftColor: STATUS_STYLES[status].border,
      borderRight: "none",
    },
    right: {
      ...arrowBase,
      left: -13,
      top: "50%",
      transform: "translateY(-50%)",
      borderRightColor: STATUS_STYLES[status].border,
      borderLeft: "none",
    },
  };
  const panePos = {
    top: { bottom: "calc(100% + 10px)", left: "50%", transform: "translateX(-50%)" },
    bottom: { top: "calc(100% + 10px)", left: "50%", transform: "translateX(-50%)" },
    left: { right: "calc(100% + 10px)", top: "50%", transform: "translateY(-50%)" },
    right: { left: "calc(100% + 10px)", top: "50%", transform: "translateY(-50%)" },
  };

  return (
    <div
      onClick={() => onToggle(sensor.id)}
      style={{
        position: "absolute",
        left: `${sensor.x}%`,
        top: `${sensor.y}%`,
        transform: "translate(-50%, -50%)",
        zIndex: selected ? 20 : 10,
        cursor: "pointer",
      }}
    >
      <div
        style={{
          width: 16,
          height: 16,
          background: sensor.color,
          border: `2px solid ${isWhite ? "#adb5bd" : "rgba(0,0,0,.35)"}`,
          borderRadius: 3,
          boxShadow: selected ? "0 0 0 3px rgba(67,94,190,.5)" : "0 1px 4px rgba(0,0,0,.4)",
          transition: "box-shadow .15s",
        }}
      />
      {selected && (
        <div
          style={{
            position: "absolute",
            zIndex: 30,
            filter: "drop-shadow(0 4px 8px rgba(0,0,0,.18))",
            ...panePos[dir],
          }}
        >
          <div style={{ position: "relative" }}>
            <div style={arrowStyle[dir]} />
            <SensorPane sensor={sensor} />
          </div>
        </div>
      )}
    </div>
  );
}

export function SensorListItem({ sensor, selected, onToggle }) {
  const status = getPaneStatus(sensor);
  const statusDot = STATUS_STYLES[status].dot;

  return (
    <div
      onClick={() => onToggle(sensor.id)}
      className="flex items-center gap-2 px-3 py-2 rounded-md cursor-pointer"
      style={{ background: "transparent", userSelect: "none" }}
      onMouseEnter={(event) => {
        event.currentTarget.style.background = "var(--accent)";
      }}
      onMouseLeave={(event) => {
        event.currentTarget.style.background = "transparent";
      }}
    >
      <div
        style={{
          width: 16,
          height: 16,
          flexShrink: 0,
          border: `2px solid ${selected ? "#435ebe" : "#adb5bd"}`,
          borderRadius: 3,
          background: selected ? "#435ebe" : "transparent",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {selected && <span style={{ color: "#fff", fontSize: 9, lineHeight: 1 }}>✓</span>}
      </div>
      <div
        style={{
          width: 14,
          height: 14,
          flexShrink: 0,
          background: sensor.color,
          border: `1.5px solid ${sensor.color === "#ffffff" ? "#adb5bd" : "rgba(0,0,0,.2)"}`,
          borderRadius: 2,
        }}
      />
      <span style={{ fontSize: 13 }}>{sensor.name}</span>
      <div style={{ marginLeft: "auto", flexShrink: 0, display: "flex", alignItems: "center", gap: 4 }}>
        {sensor.activeLocation === false && (
          <span
            style={{ width: 8, height: 8, borderRadius: "50%", background: "#ffe082", display: "block" }}
            title="Inactive area - alarms suppressed"
          />
        )}
        <span style={{ width: 8, height: 8, borderRadius: "50%", background: statusDot, display: "block" }} />
      </div>
    </div>
  );
}

export const FLOOR_MAP_LEGEND = [
  { color: STATUS_STYLES.ok.dot, label: "Within limits" },
  { color: STATUS_STYLES.breach.dot, label: "Limit breached" },
  { color: STATUS_STYLES["no-data"].dot, label: "No data" },
];

export const hasLiveData = (sensors) => sensors?.some((sensor) => sensor.hasData) ?? false;

