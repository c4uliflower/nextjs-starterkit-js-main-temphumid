import { Button } from "@/components/ui/button";

export function MonitoringSensorReadings({ sensor, config }) {
  return (
    <div style={{ fontSize: 13, color: config.color, marginTop: 8 }}>
      <div>
        Temp: <strong>{sensor.temp?.toFixed(2)}{"\u00B0C"}</strong>
        {sensor.tempLL != null && sensor.tempUL != null && (
          <span style={{ fontSize: 11, color: "#6c757d", marginLeft: 6 }}>
            {sensor.tempLL}
            {"\u2013"}
            {sensor.tempUL}
            {"\u00B0C"}
          </span>
        )}
      </div>
      <div style={{ marginTop: 3 }}>
        Humidity: <strong>{sensor.humid?.toFixed(2)}%</strong>
        {sensor.humidLL != null && sensor.humidUL != null && (
          <span style={{ fontSize: 11, color: "#6c757d", marginLeft: 6 }}>
            {sensor.humidLL}
            {"\u2013"}
            {sensor.humidUL}%
          </span>
        )}
      </div>
    </div>
  );
}

export function MonitoringSensorBreachActions({
  isForwarded,
  isSending,
  onNotify,
}) {
  return (
    <div style={{ marginTop: 8 }}>
      <div
        style={{
          fontSize: 11,
          color: "#dc3545",
          fontWeight: 600,
          marginBottom: 6,
        }}
      >
        Exceeds limit
      </div>

      {isForwarded ? (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            padding: "6px 10px",
            borderRadius: 6,
            background: "var(--muted)",
            border: "1px solid var(--border)",
          }}
        >
          <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
            <circle cx="8" cy="8" r="7" stroke="#6c757d" strokeWidth="1.5" />
            <path
              d="M5 8l2 2 4-4"
              stroke="#6c757d"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <span
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: "var(--muted-foreground)",
            }}
          >
            Forwarded to Facilities
          </span>
        </div>
      ) : (
        <Button
          variant="destructive"
          size="sm"
          className="w-full cursor-pointer"
          disabled={isSending}
          onClick={onNotify}
        >
          {isSending ? "Notifying..." : "Notify Facilities"}
        </Button>
      )}
    </div>
  );
}

export function MonitoringSensorNoDataState({ config }) {
  return (
    <div style={{ fontSize: 12, color: config.color, marginTop: 8, opacity: 0.8 }}>
      No readings available - sensor may be offline.
    </div>
  );
}
