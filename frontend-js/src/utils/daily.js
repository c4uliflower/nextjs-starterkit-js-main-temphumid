export const DAILY_CHART_COLORS = [
  "#dc3545",
  "#fd7e14",
  "#ffc107",
  "#435ebe",
  "#198754",
  "#0dcaf0",
  "#6f42c1",
  "#20c997",
  "#e83e8c",
  "#17a2b8",
  "#ff6384",
  "#36a2eb",
  "#9966ff",
  "#ff9f40",
  "#d62728",
  "#2ca02c",
  "#c9cbcf",
  "#f77825",
];

export const DAILY_LIMIT_UL_COLOR = "#c0392b";
export const DAILY_LIMIT_LL_COLOR = "#2471a3";

export const DAILY_SENSOR_MAP = {
  "Cold Storage": [
    { id: "P1F1-10", name: "SMT - Cold Storage" },
    { id: "P2F1-16", name: "WH - Cold Storage" },
    { id: "P2F1-17", name: "WH - Cold Storage 2" },
  ],
  P1F1: [
    { id: "P1F1-04", name: "AOI" },
    { id: "P1F1-17", name: "Coating" },
    { id: "P1F1-01", name: "Dipping" },
    { id: "P1F1-06", name: "Dipping2" },
    { id: "P1F1-03", name: "Server Room" },
    { id: "P1F1-02", name: "SMT" },
    { id: "P1F1-05", name: "SMT MH" },
    { id: "P1F1-09", name: "SMT MH Dessicator 1" },
    { id: "P1F1-07", name: "SMT MH Dessicator 2" },
    { id: "P1F1-11", name: "SMT MH Dessicator 3" },
    { id: "P1F1-12", name: "SMT MH Dessicator 4" },
    { id: "P1F1-13", name: "SMT MH Dessicator 5" },
    { id: "P1F1-14", name: "SMT MH Receiving" },
    { id: "P1F1-15", name: "BGA Rework" },
  ],
  P1F2: [
    { id: "P1F2-03", name: "Brother Assy 1" },
    { id: "P1F2-02", name: "Brother Assy 2" },
    { id: "P1F2-01", name: "JCM PCBA" },
    { id: "P1F2-05", name: "MH Brother Packaging" },
  ],
  P2F1: [
    { id: "P2F1-03", name: "FG" },
    { id: "P2F1-01", name: "Warehouse Office" },
    { id: "P2F1-18", name: "WO-North" },
    { id: "P2F1-07", name: "WO-South - Holding Area" },
    { id: "P2F1-04", name: "WO-S-West-IQC" },
    { id: "P2F1-05", name: "WO-W South-QA" },
    { id: "P2F1-06", name: "Facilities" },
  ],
  P2F2: [
    { id: "P2F2-04", name: "Calibration Room" },
    { id: "P1F1-16", name: "CIS" },
    { id: "P2F2-01", name: "JCM Assy" },
    { id: "P2F2-02", name: "WH Brother Packaging" },
    { id: "P2F2-03", name: "WH-MH JCM Assy" },
  ],
  "P1&2F2": [{ id: "P1F2-06", name: "P1P2 Bridge" }],
  WH: [
    { id: "P2F1-08", name: "WH-A" },
    { id: "P2F1-09", name: "WH-B" },
    { id: "P2F1-10", name: "WH-C" },
    { id: "P2F1-11", name: "WH-D" },
    { id: "P2F1-12", name: "WH-E" },
    { id: "P2F1-13", name: "WH-F" },
    { id: "P2F1-14", name: "WH-G" },
    { id: "P2F1-15", name: "WH-H" },
  ],
};

export const DAILY_FLOOR_SLUGS = ["p1f1", "p1f2", "p2f1", "p2f2", "wh", "p12f2"];

export const DAILY_LOCATION_OPTIONS = Object.keys(DAILY_SENSOR_MAP);

export const dailyCache = {
  summary: null,
  statusesByAreaId: {},
};

export const DAILY_SENSOR_LOCATION_MAP = Object.fromEntries(
  Object.entries(DAILY_SENSOR_MAP).flatMap(([location, sensors]) =>
    sensors.map((sensor) => [sensor.id, location])
  )
);

export function getDefault24hRange() {
  const to = new Date();
  const from = new Date();
  from.setDate(to.getDate() - 1);
  return { from, to };
}

export function toISODate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function avg(values) {
  const valid = values.filter((value) => value != null);
  return valid.length ? valid.reduce((sum, value) => sum + value, 0) / valid.length : null;
}

export function formatDailyLabel(isoString, resolution) {
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return isoString;

  if (resolution === "daily") {
    return date.toLocaleString("en-PH", {
      month: "2-digit",
      day: "2-digit",
      year: "numeric",
    });
  }

  if (resolution === "monthly") {
    return date.toLocaleString("en-PH", {
      month: "short",
      year: "numeric",
    });
  }

  return date.toLocaleString("en-PH", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export function formatDailyExcelDatetime(value) {
  if (!value) return "";
  return value.replace("T", " ").replace(/\.\d+([+-]\d{2}:\d{2}|Z)?$/, "").trim();
}

export function filterSundays(times, includeSundays) {
  return includeSundays ? times : times.filter((time) => new Date(time).getDay() !== 0);
}

export function getCSSVar(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

export function toLocationOptions(locations) {
  return locations.map((location) => ({ value: location, label: location }));
}

export function toSensorOptions(sensors) {
  return sensors.map((sensor) => ({ value: sensor.id, label: sensor.name }));
}

export function buildDailyDatasets(rawData, resolution = "raw") {
  const { sortedTimes, perSensor } = rawData;
  const labels = sortedTimes.map((time) => formatDailyLabel(time, resolution));
  const base = ({ color, label }) => ({
    label,
    borderColor: color,
    backgroundColor: `${color}22`,
    borderWidth: 2,
    pointRadius: resolution === "raw" ? 0 : 2,
    tension: 0.3,
    fill: false,
    spanGaps: true,
  });

  return {
    labels,
    tempDS: perSensor.map((sensor) => ({
      ...base(sensor),
      data: sortedTimes.map((time) => sensor.readingMap[time]?.temperature ?? null),
    })),
    humidDS: perSensor.map((sensor) => ({
      ...base(sensor),
      data: sortedTimes.map((time) => sensor.readingMap[time]?.humidity ?? null),
    })),
  };
}

export function buildMonthlyDatasets(rawData) {
  const { sortedTimes, perSensor } = rawData;
  const months = [...new Set(sortedTimes.map((time) => time.slice(0, 7)))].sort();
  const labels = months.map((month) => {
    const [year, monthIndex] = month.split("-");
    return new Date(Number(year), Number(monthIndex) - 1, 1).toLocaleString("en-PH", {
      month: "short",
      year: "numeric",
    });
  });

  const base = ({ color, label }) => ({
    label,
    borderColor: color,
    backgroundColor: `${color}22`,
    borderWidth: 2,
    pointRadius: 4,
    tension: 0.3,
    fill: false,
    spanGaps: true,
  });

  const avgForMonth = (readingMap, month, field) =>
    avg(sortedTimes.filter((time) => time.startsWith(month)).map((time) => readingMap[time]?.[field] ?? null));

  return {
    labels,
    tempDS: perSensor.map((sensor) => ({
      ...base(sensor),
      data: months.map((month) => avgForMonth(sensor.readingMap, month, "temperature")),
    })),
    humidDS: perSensor.map((sensor) => ({
      ...base(sensor),
      data: months.map((month) => avgForMonth(sensor.readingMap, month, "humidity")),
    })),
  };
}

export function buildDailyHintText(selSensors, selLocations, sensorsToFetch) {
  if (selSensors.length > 0 && selLocations.length === 0) {
    return `${selSensors.length} sensor(s) selected - each will appear as one line.`;
  }

  if (selLocations.length > 0 && selSensors.length === 0) {
    return `${sensorsToFetch.length} sensor(s) across ${selLocations.join(", ")} - all will be graphed.`;
  }

  if (selLocations.length > 0 && selSensors.length > 0) {
    return `${selSensors.length} sensor(s) in ${selLocations.join(", ")} - graphing selected sensors only.`;
  }

  return "Location narrows sensor options · Sensor narrows location options";
}

export function buildDailyChartSubtitle(chartView, resolution, metric) {
  const resolutionLabel = chartView === "monthly" ? "monthly" : resolution;
  return `${metric} · ${resolutionLabel} · Scroll to zoom · Click & drag to pan`;
}

async function loadSheetJS() {
  if (window.XLSX) return window.XLSX;

  await new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js";
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });

  return window.XLSX;
}

export async function exportDailyReadingsToExcel({
  rawData,
  limitProfiles,
  rangeFrom,
  rangeTo,
}) {
  const XLSX = await loadSheetJS();
  const { sortedTimes, perSensor } = rawData;
  const firstProfile = limitProfiles[0] ?? {};

  const headers = [
    "Date & Time",
    ...perSensor.flatMap((sensor) => [
      `Temperature (${sensor.label})`,
      `Humidity (${sensor.label})`,
    ]),
    "Temp Upper Limit",
    "Temp Lower Limit",
    "Humid Upper Limit",
    "Humid Lower Limit",
  ];

  const rows = [headers];
  const chunkSize = 5000;

  for (let index = 0; index < sortedTimes.length; index += chunkSize) {
    const slice = sortedTimes.slice(index, index + chunkSize);
    slice.forEach((time) => {
      const row = [{ v: formatDailyExcelDatetime(time), t: "s" }];
      perSensor.forEach((sensor) => {
        row.push(sensor.readingMap[time]?.temperature ?? "");
        row.push(sensor.readingMap[time]?.humidity ?? "");
      });
      row.push(
        firstProfile.tempUL ?? "",
        firstProfile.tempLL ?? "",
        firstProfile.humidUL ?? "",
        firstProfile.humidLL ?? ""
      );
      rows.push(row);
    });
    await new Promise((resolve) => setTimeout(resolve, 0));
  }

  const worksheet = XLSX.utils.aoa_to_sheet(rows);
  worksheet["!cols"] = [
    { wch: 24 },
    ...perSensor.flatMap(() => [{ wch: 24 }, { wch: 20 }]),
    { wch: 18 },
    { wch: 18 },
    { wch: 20 },
    { wch: 20 },
  ];
  worksheet["!freeze"] = { xSplit: 0, ySplit: 1 };

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Data");
  XLSX.writeFile(
    workbook,
    `sensor_readings_${toISODate(rangeFrom)}_to_${toISODate(rangeTo)}.xlsx`
  );
}
