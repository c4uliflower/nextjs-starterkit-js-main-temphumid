// Copied from the current temp/humid route pages as an additive scaffold.

export const STATUS_STYLES = {
  ok: { bg: "#e8fff8", text: "#212529", border: "#00c9a7", dot: "#00c9a7" },
  breach: { bg: "#ffe8e8", text: "#212529", border: "#dc3545", dot: "#dc3545" },
  "inactive-breach": { bg: "#e8fff8", text: "#212529", border: "#00c9a7", dot: "#00c9a7" },
  "no-data": { bg: "#f0f0f0", text: "#495057", border: "#adb5bd", dot: "#adb5bd" },
};

export const STATUS_PRIORITY = {
  breach: 0,
  no_data: 1,
  active: 2,
};

export const STATUS_CONFIG = {
  breach: { color: "#dc3545", bg: "#ffe8e8", label: "Breach", dot: "#dc3545" },
  no_data: { color: "#6c757d", bg: "#f1f3f5", label: "No Data", dot: "#adb5bd" },
  active: { color: "#198754", bg: "#e8fff8", label: "Active", dot: "#00c9a7" },
};

export function getPaneStatus(sensor) {
  return sensor.status ?? "no-data";
}

export function getSensorStatus(sensor) {
  if (!sensor.hasData) return "no_data";
  if (sensor.breach) return "breach";
  return "active";
}

export function getFloorStatus(floor) {
  let top = "active";

  for (const sensor of floor.sensors) {
    const status = getSensorStatus(sensor);
    if (STATUS_PRIORITY[status] < STATUS_PRIORITY[top]) top = status;
  }

  return top;
}

export function getFloorSummary(floor) {
  const breached = floor.sensors.filter((sensor) => getSensorStatus(sensor) === "breach").length;
  const noData = floor.sensors.filter((sensor) => getSensorStatus(sensor) === "no_data").length;
  const parts = [];

  if (breached > 0) parts.push(`${breached} in breach`);
  if (noData > 0) parts.push(`${noData} no data`);

  return parts.length ? parts.join(" · ") : "All stable";
}

export function getPaneDirection(sensor) {
  if (sensor.direction) return sensor.direction;
  if (sensor.y < 20) return "bottom";
  if (sensor.y > 78) return "top";
  if (sensor.x > 80) return "left";
  if (sensor.x < 20) return "right";
  return "top";
}
