import {
  STATUS_CONFIG,
  STATUS_PRIORITY,
  getFloorStatus,
  getSensorStatus,
} from "@/features/temphumid/sensor-status/utils/status";

// Copied from the current temp/humid monitoring route page as an additive scaffold.

export const MONITORING_GLOBAL_STYLES = `
  @keyframes borderBlink {
    0%, 100% { box-shadow: 0 0 0 3px #dc3545, 0 4px 16px rgba(220,53,69,.35); }
    50% { box-shadow: 0 0 0 3px rgba(220,53,69,.15), 0 4px 16px rgba(220,53,69,.1); }
  }
  @keyframes dotPulse {
    0%, 100% { opacity: 1; transform: scale(1); }
    50% { opacity: .4; transform: scale(.75); }
  }
  @keyframes slideIn {
    from { opacity: 0; transform: translateY(12px); }
    to { opacity: 1; transform: translateY(0); }
  }
`;

export const INACTIVE_MONITORING_AREAS = new Set([]);
export const MONITORING_STATUS_CACHE_TTL_MS = 10 * 60 * 1000;

export function hasMonitoringLiveData(floors) {
  return floors.some((floor) => floor.sensors.some((sensor) => sensor.hasData));
}

export function formatNotifiedBy(user) {
  if (!user) return "unknown";
  const name = `${user.first_name ?? ""} ${user.last_name ?? ""}`.trim();
  return user.employee_no ? `${name} (${user.employee_no})` : name || "unknown";
}

export function buildMonitoringTableData(floors) {
  return floors.flatMap((floor) =>
    floor.sensors.map((sensor) => ({
      id: `${floor.id}__${sensor.id}`,
      floor: floor.label,
      name: sensor.name,
      temp: sensor.temp ?? null,
      humid: sensor.humid ?? null,
      hasData: sensor.hasData ?? false,
      breach: sensor.breach ?? false,
      lastSeen: sensor.lastSeen ?? null,
      tempUL: sensor.tempUL ?? null,
      tempLL: sensor.tempLL ?? null,
      humidUL: sensor.humidUL ?? null,
      humidLL: sensor.humidLL ?? null,
    }))
  );
}

export function buildMonitoringHeaderText(loading, breachFloorCount) {
  if (loading) return "Loading live data...";

  return `Live status across all floors - ${breachFloorCount} floor${
    breachFloorCount !== 1 ? "s" : ""
  } in breach`;
}

export function hasMonitoringBreaches(floors) {
  return floors.some((floor) => getFloorStatus(floor) === "breach");
}

export function buildMonitoringFloorSections(floor) {
  const activeSensors = floor.sensors.filter(
    (sensor) => getSensorStatus(sensor) === "active"
  );
  const flaggedSensors = floor.sensors
    .filter((sensor) => getSensorStatus(sensor) !== "active")
    .sort(
      (left, right) =>
        STATUS_PRIORITY[getSensorStatus(left)] - STATUS_PRIORITY[getSensorStatus(right)]
    );

  const counts = {};
  flaggedSensors.forEach((sensor) => {
    const status = getSensorStatus(sensor);
    counts[status] = (counts[status] || 0) + 1;
  });

  return {
    activeSensors,
    counts,
    flaggedSensors,
  };
}

export function buildMonitoringNotifyStateMap(floor, facilitiesAlertMap) {
  const states = {};
  floor.sensors.forEach((sensor) => {
    const activeAlert = facilitiesAlertMap.get(sensor.areaId);
    const canNotifyAgain = activeAlert?.canNotifyAgain === true;
    states[sensor.areaId] = activeAlert && !canNotifyAgain ? "forwarded" : "idle";
  });
  return states;
}

export const MONITORING_SENSOR_TABLE_COLUMNS = [
  { accessorKey: "floor", header: "Floor" },
  { accessorKey: "name", header: "Sensor" },
  {
    accessorKey: "temp",
    header: "Temp (\u00B0C)",
    cell: ({ row }) =>
      row.original.hasData && row.getValue("temp") !== null
        ? row.getValue("temp").toFixed(2)
        : "\u2014",
  },
  {
    accessorKey: "humid",
    header: "Humidity (%)",
    cell: ({ row }) =>
      row.original.hasData && row.getValue("humid") !== null
        ? row.getValue("humid").toFixed(2)
        : "\u2014",
  },
  {
    id: "tempLimits",
    header: "Temp Limits (\u00B0C)",
    cell: ({ row }) =>
      row.original.tempLL != null && row.original.tempUL != null
        ? `${row.original.tempLL} \u2013 ${row.original.tempUL}`
        : "\u2014",
  },
  {
    id: "humidLimits",
    header: "Humid Limits (%)",
    cell: ({ row }) =>
      row.original.humidLL != null && row.original.humidUL != null
        ? `${row.original.humidLL} \u2013 ${row.original.humidUL}`
        : "\u2014",
  },
  {
    id: "status",
    accessorFn: (row) => getSensorStatus(row),
    header: "Status",
    cell: ({ row }) => {
      const status = getSensorStatus(row.original);
      const config = STATUS_CONFIG[status];
      return (
        <span
          style={{
            fontSize: 10,
            fontWeight: 700,
            padding: "2px 8px",
            borderRadius: 5,
            background: config.color,
            color: "#fff",
            textTransform: "uppercase",
            letterSpacing: ".04em",
          }}
        >
          {config.label}
        </span>
      );
    },
  },
  {
    accessorKey: "lastSeen",
    header: "Last Seen",
    cell: ({ row }) => row.original.lastSeen ?? "\u2014",
  },
];

