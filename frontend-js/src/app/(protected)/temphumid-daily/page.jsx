"use client";

// ─────────────────────────────────────────────────────────────────────────────
// IMPORTS
// ─────────────────────────────────────────────────────────────────────────────
import { useState, useRef, useEffect, useCallback, memo } from "react";
import { Droplets, Thermometer, TriangleAlert, Radio, FileText, Download } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DashboardCard } from "@/components/custom/DashboardCard";
import { DateRangePicker } from "@/components/ui/date-picker";
import { Button } from "@/components/ui/button";
import { Combobox } from "@/components/custom/Combobox";
import axios from "@/lib/axios";

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 1: DATA LAYER
// ─────────────────────────────────────────────────────────────────────────────

const API_BASE = '/api/temphumid';

let summaryCache = null;
let statusCache  = {}; // { [areaId]: 'Active' | 'Inactive' } — persists across navigations

const SENSOR_MAP = {
  "Cold Storage": [
    { id: "P1F1-10", name: "SMT - Cold Storage"       },
    { id: "P2F1-16", name: "WH - Cold Storage"        },
    { id: "P2F1-17", name: "WH - Cold Storage 2"      },
  ],
  "P1F1": [
    { id: "P1F1-04", name: "AOI"                      },
    { id: "P1F1-17", name: "Coating"                  },
    { id: "P1F1-01", name: "Dipping"                  },
    { id: "P1F1-06", name: "Dipping2"                 },
    { id: "P1F1-03", name: "Server Room"              },
    { id: "P1F1-02", name: "SMT"                      },
    { id: "P1F1-05", name: "SMT MH"                   },
    { id: "P1F1-09", name: "SMT MH Dessicator 1"      },
    { id: "P1F1-07", name: "SMT MH Dessicator 2"      },
    { id: "P1F1-11", name: "SMT MH Dessicator 3"      },
    { id: "P1F1-12", name: "SMT MH Dessicator 4"      },
    { id: "P1F1-13", name: "SMT MH Dessicator 5"      },
    { id: "P1F1-14", name: "SMT MH Receiving"         },
    { id: "P1F1-15", name: "BGA Rework"               },
  ],
  "P1F2": [
    { id: "P1F2-03", name: "Brother Assy 1"           },
    { id: "P1F2-02", name: "Brother Assy 2"           },
    { id: "P1F2-01", name: "JCM PCBA"                 },
    { id: "P1F2-05", name: "MH Brother Packaging"     },
  ],
  "P2F1": [
    { id: "P2F1-03", name: "FG"                       },
    { id: "P2F1-01", name: "Warehouse Office"         },
    { id: "P2F1-18", name: "WO-North"                 },
    { id: "P2F1-07", name: "WO-South - Holding Area"  },
    { id: "P2F1-04", name: "WO-S-West-IQC"            },
    { id: "P2F1-05", name: "WO-W South-QA"            },
    { id: "P2F1-06", name: "Facilities"               },
  ],
  "P2F2": [
    { id: "P2F2-04", name: "Calibration Room"         },
    { id: "P1F1-16", name: "CIS"                      },
    { id: "P2F2-01", name: "JCM Assy"                 },
    { id: "P2F2-02", name: "WH Brother Packaging"     },
    { id: "P2F2-03", name: "WH-MH JCM Assy"           },
  ],
  "P1&2F2": [
    { id: "P1F2-06", name: "P1P2 Bridge"              },
  ],
  "WH": [
    { id: "P2F1-08", name: "WH-A"                     },
    { id: "P2F1-09", name: "WH-B"                     },
    { id: "P2F1-10", name: "WH-C"                     },
    { id: "P2F1-11", name: "WH-D"                     },
    { id: "P2F1-12", name: "WH-E"                     },
    { id: "P2F1-13", name: "WH-F"                     },
    { id: "P2F1-14", name: "WH-G"                     },
    { id: "P2F1-15", name: "WH-H"                     },
  ],
};

// Floor slugs used to fetch statuses for all sensors
const FLOOR_SLUGS = ["p1f1", "p1f2", "p2f1", "p2f2", "wh", "p12f2"];

const SENSOR_LOCATION_MAP = {};
Object.entries(SENSOR_MAP).forEach(([loc, sensors]) => {
  sensors.forEach((s) => { SENSOR_LOCATION_MAP[s.id] = loc; });
});


// ─────────────────────────────────────────────────────────────────────────────
// SECTION 2: UTILITY
// ─────────────────────────────────────────────────────────────────────────────

const CHART_COLORS = [
  "#dc3545","#fd7e14","#ffc107","#435ebe","#198754","#0dcaf0",
  "#6f42c1","#20c997","#e83e8c","#17a2b8","#ff6384","#36a2eb",
  "#9966ff","#ff9f40","#d62728","#2ca02c","#c9cbcf","#f77825",
];

const LIMIT_UL_COLOR = "#c0392b";
const LIMIT_LL_COLOR = "#2471a3";

function getDefault24hRange() {
  const to   = new Date();
  const from = new Date();
  from.setDate(to.getDate() - 1);
  return { from, to };
}

const toISODate = (d) => {
  const y   = d.getFullYear();
  const m   = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

const avg = (arr) => {
  const valid = arr.filter(v => v != null);
  return valid.length ? valid.reduce((s, v) => s + v, 0) / valid.length : null;
};

/**
 * Format a dayTime string for chart X axis labels based on resolution.
 *
 * raw / thirty_min / hourly / six_hour → "MM/DD HH:mm"
 * daily                                → "MM/DD/YYYY"
 * monthly                              → "Mon YYYY"
 */
function formatLabel(isoString, resolution) {
  const d = new Date(isoString);
  if (isNaN(d)) return isoString;

  if (resolution === "daily") {
    return d.toLocaleString("en-PH", { month: "2-digit", day: "2-digit", year: "numeric" });
  }
  if (resolution === "monthly") {
    return d.toLocaleString("en-PH", { month: "short", year: "numeric" });
  }
  return d.toLocaleString("en-PH", {
    month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false,
  });
}

/**
 * Normalise a backend dayTime string → "YYYY-MM-DD HH:mm:ss".
 * Written as { t:"s" } in SheetJS so Excel never auto-converts it to a
 * serial date number and strips the time portion.
 */
const fmtDatetime = (t) => {
  if (!t) return "";
  return t.replace("T", " ").replace(/\.\d+([+-]\d{2}:\d{2}|Z)?$/, "").trim();
};

/**
 * Filter out Sundays (getDay() === 0) from a sorted times array.
 * When includeSundays is true, returns the array unchanged.
 */
const filterSundays = (times, includeSundays) =>
  includeSundays ? times : times.filter(t => new Date(t).getDay() !== 0);


// ─────────────────────────────────────────────────────────────────────────────
// SECTION 3: LOADING OVERLAY
// ─────────────────────────────────────────────────────────────────────────────

const SPINNER_STYLE = `@keyframes spinLoader { to { transform: rotate(360deg); } }`;

function LoadingOverlay() {
  return (
    <>
      <style>{SPINNER_STYLE}</style>
      <div style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(0,0,0,.55)", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ background: "#fff", borderRadius: 10, padding: "36px 48px", display: "flex", flexDirection: "column", alignItems: "center", gap: 20, boxShadow: "0 8px 40px rgba(0,0,0,.18)", minWidth: 260 }}>
          <div style={{ width: 44, height: 44, borderRadius: "50%", border: "4px solid #e9ecef", borderTop: "4px solid #435ebe", animation: "spinLoader 0.8s linear infinite" }} />
          <div style={{ textAlign: "center" }}>
            <p style={{ fontWeight: 700, fontSize: 15, color: "#212529", margin: 0 }}>Fetching sensor data</p>
            <p style={{ fontSize: 12, color: "#6c757d", marginTop: 6 }}>Please wait while live readings are loaded…</p>
          </div>
        </div>
      </div>
    </>
  );
}


// ─────────────────────────────────────────────────────────────────────────────
// SECTION 4: CHART.JS LOADER
// ─────────────────────────────────────────────────────────────────────────────

function useChartJS() {
  const [ready, setReady] = useState(typeof window !== "undefined" && !!window.Chart);
  useEffect(() => {
    if (window.Chart) { setReady(true); return; }
    const load = (src) => new Promise((res, rej) => {
      const s = document.createElement("script");
      s.src = src; s.onload = res; s.onerror = rej;
      document.head.appendChild(s);
    });
    (async () => {
      await load("https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js");
      await load("https://cdnjs.cloudflare.com/ajax/libs/hammer.js/2.0.8/hammer.min.js");
      await load("https://cdnjs.cloudflare.com/ajax/libs/chartjs-plugin-zoom/2.0.1/chartjs-plugin-zoom.min.js");
      setReady(true);
    })();
  }, []);
  return ready;
}


// ─────────────────────────────────────────────────────────────────────────────
// SECTION 5: STAT CARDS
// ─────────────────────────────────────────────────────────────────────────────

const StatCards = memo(function StatCards({ onFirstLoad }) {
  const [summary, setSummary] = useState(summaryCache ?? {
    avgTemperature: null, avgHumidity: null, activeSensorCount: null, breachCount: null,
  });

  useEffect(() => {
    let isFirst = !summaryCache;
    const fetchSummary = async () => {
      try {
        const res = await axios.get(`${API_BASE}/dashboard/summary`);
        summaryCache = res.data.data;
        setSummary(res.data.data);
      } catch (err) {
        console.error("Failed to fetch dashboard summary:", err);
      } finally {
        if (isFirst) { isFirst = false; onFirstLoad?.(); }
      }
    };
    if (summaryCache) onFirstLoad?.();
    fetchSummary();
    const interval = setInterval(fetchSummary, 30_000);
    return () => clearInterval(interval);
  }, []);

  const fmtTemp  = (v) => v != null ? `${v}°C` : "—";
  const fmtHumid = (v) => v != null ? `${v}%`  : "—";
  const fmtCount = (v) => v != null ? `${v}`    : "—";

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <DashboardCard value={fmtTemp(summary.avgTemperature)}     label="Avg. Temperature" icon={Thermometer}   variant="primary"     />
      <DashboardCard value={fmtHumid(summary.avgHumidity)}       label="Avg. Humidity"    icon={Droplets}      variant="success"     />
      <DashboardCard value={fmtCount(summary.activeSensorCount)} label="Active Sensors"   icon={Radio}         variant="warning"     />
      <DashboardCard value={fmtCount(summary.breachCount)}       label="Critical Alerts"  icon={TriangleAlert} variant="destructive" />
    </div>
  );
});


// ─────────────────────────────────────────────────────────────────────────────
// SECTION 6: CHART COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

const SensorLineChart = memo(function SensorLineChart({
  id, title, subtitle, datasets, labels, yLabel, limitProfiles, limitKeyUL, limitKeyLL,
}) {
  const cvs                     = useRef(null);
  const inst                    = useRef(null);
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    if (!window.Chart || !cvs.current) return;
    if (inst.current) inst.current.destroy();

    const limitDatasets = limitProfiles.flatMap((profile) => {
      const ulVal  = profile[limitKeyUL];
      const llVal  = profile[limitKeyLL];
      const suffix = limitProfiles.length > 1 ? ` (${profile.location})` : "";
      return [
        {
          label: `UL ${ulVal}${suffix}`, data: labels.map(() => ulVal),
          borderColor: LIMIT_UL_COLOR, borderDash: [8, 5], borderWidth: 1.5,
          pointRadius: 0, fill: false, order: 0,
        },
        {
          label: `LL ${llVal}${suffix}`, data: labels.map(() => llVal),
          borderColor: LIMIT_LL_COLOR, borderDash: [8, 5], borderWidth: 1.5,
          pointRadius: 0, fill: false, order: 0,
        },
      ];
    });

    inst.current = new window.Chart(cvs.current, {
      type: "line",
      data: { labels, datasets: [...datasets, ...limitDatasets] },
      options: {
        responsive: true, maintainAspectRatio: false,
        interaction: { mode: "index", intersect: false },
        plugins: {
          legend: {
            position: "top",
            labels: { boxWidth: 24, boxHeight: 4, font: { size: 11 }, padding: 14 },
          },
          zoom: {
            zoom: { wheel: { enabled: true, speed: 0.08 }, pinch: { enabled: true }, mode: "x" },
            pan:  {
              enabled: true, mode: "x",
              onPanStart:    () => setDragging(true),
              onPanComplete: () => setDragging(false),
            },
          },
          tooltip: {
            backgroundColor: "rgba(33,37,41,.93)",
            titleFont: { size: 12 }, bodyFont: { size: 11 },
            padding: 10, cornerRadius: 6,
          },
        },
        scales: {
          x: {
            ticks: { maxTicksLimit: 12, font: { size: 10 }, color: "#6c757d", maxRotation: 30 },
            grid:  { color: "rgba(0,0,0,.06)" },
          },
          y: {
            title: { display: true, text: yLabel, font: { size: 11 }, color: "#6c757d" },
            ticks: { font: { size: 10 }, color: "#6c757d" },
            grid:  { color: "rgba(0,0,0,.06)" },
          },
        },
      },
    });
    return () => { if (inst.current) inst.current.destroy(); };
  }, [datasets, labels, limitProfiles, limitKeyUL, limitKeyLL, yLabel]);

  const onMouseUp = useCallback(() => setDragging(false), []);
  useEffect(() => {
    window.addEventListener("mouseup", onMouseUp);
    return () => window.removeEventListener("mouseup", onMouseUp);
  }, [onMouseUp]);

  return (
    <div>
      <h6>{title}</h6>
      <p className="text-xs text-muted-foreground mt-1 ml-3">{subtitle}</p>
      <div
        onMouseDown={() => setDragging(true)} onMouseUp={onMouseUp}
        style={{ height: 320, cursor: dragging ? "grabbing" : "grab", userSelect: "none" }}
      >
        <canvas ref={cvs} id={id} style={{ display: "block", width: "100%", height: "100%" }} />
      </div>
    </div>
  );
});


// ─────────────────────────────────────────────────────────────────────────────
// SECTION 7: OPTION CONVERTERS
// ─────────────────────────────────────────────────────────────────────────────

const toLocationOptions = (locations) =>
  locations.map((loc) => ({ value: loc, label: loc }));

const toSensorOptions = (sensors) =>
  sensors.map((s) => ({ value: s.id, label: s.name }));


// ─────────────────────────────────────────────────────────────────────────────
// SECTION 8: VIEW BUILDERS
// ─────────────────────────────────────────────────────────────────────────────

function buildDailyDatasets(rawData, resolution = "raw") {
  const { sortedTimes, perSensor } = rawData;
  const labels = sortedTimes.map(t => formatLabel(t, resolution));
  const base = ({ color, label }) => ({
    label, borderColor: color, backgroundColor: color + "22",
    borderWidth: 2, pointRadius: resolution === "raw" ? 0 : 2,
    tension: 0.3, fill: false, spanGaps: true,
  });
  const tempDS  = perSensor.map(s => ({ ...base(s), data: sortedTimes.map(t => s.readingMap[t]?.temperature ?? null) }));
  const humidDS = perSensor.map(s => ({ ...base(s), data: sortedTimes.map(t => s.readingMap[t]?.humidity    ?? null) }));
  return { labels, tempDS, humidDS };
}

function buildMonthlyDatasets(rawData) {
  const { sortedTimes, perSensor } = rawData;
  const months = [...new Set(sortedTimes.map(t => t.slice(0, 7)))].sort();
  const labels = months.map(m => {
    const [y, mo] = m.split("-");
    return new Date(Number(y), Number(mo) - 1, 1).toLocaleString("en-PH", { month: "short", year: "numeric" });
  });
  const base = ({ color, label }) => ({
    label, borderColor: color, backgroundColor: color + "22",
    borderWidth: 2, pointRadius: 4, tension: 0.3, fill: false, spanGaps: true,
  });
  const avgForMonth = (readingMap, month, field) =>
    avg(sortedTimes.filter(t => t.startsWith(month)).map(t => readingMap[t]?.[field] ?? null));
  const tempDS  = perSensor.map(s => ({ ...base(s), data: months.map(m => avgForMonth(s.readingMap, m, "temperature")) }));
  const humidDS = perSensor.map(s => ({ ...base(s), data: months.map(m => avgForMonth(s.readingMap, m, "humidity"))    }));
  return { labels, tempDS, humidDS };
}


// ─────────────────────────────────────────────────────────────────────────────
// SECTION 8b: EXCEL EXPORT
//
// Exports whatever data the chart currently has loaded in rawDataRef.
// Uses SheetJS loaded lazily. Handles large datasets by chunking row
// writes to avoid blocking the UI.
// ─────────────────────────────────────────────────────────────────────────────

async function loadSheetJS() {
  if (window.XLSX) return window.XLSX;
  await new Promise((res, rej) => {
    const s = document.createElement("script");
    s.src = "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js";
    s.onload = res; s.onerror = rej;
    document.head.appendChild(s);
  });
  return window.XLSX;
}

async function exportReadingsToExcel({ rawData, limitProfiles, rangeFrom, rangeTo }) {
  const XLSX = await loadSheetJS();

  const { sortedTimes, perSensor } = rawData;
  const firstProfile = limitProfiles[0] ?? {};

  const headers = [
    "Date & Time",
    ...perSensor.flatMap(s => [
      `Temperature (${s.label})`,
      `Humidity (${s.label})`,
    ]),
    "Temp Upper Limit",
    "Temp Lower Limit",
    "Humid Upper Limit",
    "Humid Lower Limit",
  ];

  const CHUNK = 5000;
  const rows  = [headers];

  for (let i = 0; i < sortedTimes.length; i += CHUNK) {
    const slice = sortedTimes.slice(i, i + CHUNK);
    slice.forEach(t => {
      const row = [{ v: fmtDatetime(t), t: "s" }];
      perSensor.forEach(s => {
        row.push(s.readingMap[t]?.temperature ?? "");
        row.push(s.readingMap[t]?.humidity    ?? "");
      });
      row.push(
        firstProfile.tempUL  ?? "",
        firstProfile.tempLL  ?? "",
        firstProfile.humidUL ?? "",
        firstProfile.humidLL ?? "",
      );
      rows.push(row);
    });
    await new Promise(r => setTimeout(r, 0));
  }

  const ws = XLSX.utils.aoa_to_sheet(rows);

  ws["!cols"] = [
    { wch: 24 },
    ...perSensor.flatMap(() => [{ wch: 24 }, { wch: 20 }]),
    { wch: 18 }, { wch: 18 }, { wch: 20 }, { wch: 20 },
  ];
  ws["!freeze"] = { xSplit: 0, ySplit: 1 };

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Data");

  const fromStr = toISODate(rangeFrom);
  const toStr   = toISODate(rangeTo);
  XLSX.writeFile(wb, `sensor_readings_${fromStr}_to_${toStr}.xlsx`);
}


// ─────────────────────────────────────────────────────────────────────────────
// SECTION 9: MAIN PAGE
// ─────────────────────────────────────────────────────────────────────────────

export default function Dashboard() {
  const chartReady = useChartJS();

  const [summaryLoading, setSummaryLoading] = useState(!summaryCache);

  // Tracks whether statusCache has been fetched — triggers re-render to update dropdowns
  const [statusReady, setStatusReady] = useState(Object.keys(statusCache).length > 0);

  // ── Filter state ────────────────────────────────────────────────────────────
  const [selLocationValues, setSelLocationValues] = useState([]);
  const [selSensorValues,   setSelSensorValues]   = useState([]);
  const [range,             setRange]             = useState(getDefault24hRange());

  // ── Chart state ─────────────────────────────────────────────────────────────
  const [labels,        setLabels]        = useState([]);
  const [tempDS,        setTempDS]        = useState([]);
  const [humidDS,       setHumidDS]       = useState([]);
  const [limitProfiles, setLimitProfiles] = useState([]);
  const [chartKey,      setChartKey]      = useState(0);
  const [applied,       setApplied]       = useState(false);
  const [loading,       setLoading]       = useState(false);
  const [apiError,      setApiError]      = useState(null);
  const [noData,        setNoData]        = useState(false);
  const [resolution,    setResolution]    = useState("raw");

  // ── View toggle ─────────────────────────────────────────────────────────────
  const [chartView,      setChartView]      = useState("daily");
  const [includeSundays, setIncludeSundays] = useState(false);
  const rawDataRef                          = useRef(null); // filtered sortedTimes + perSensor
  const allTimesRef                         = useRef(null); // unfiltered sortedTimes — needed to restore Sundays

  // ── Export state ────────────────────────────────────────────────────────────
  const [exporting, setExporting] = useState(false);

  // Fetch sensor statuses once on mount — filters inactive sensors from dropdowns
  useEffect(() => {
    if (Object.keys(statusCache).length > 0) return; // already fetched
    Promise.all(
      FLOOR_SLUGS.map(slug =>
        axios.get(`${API_BASE}/sensors/status`, { params: { floor: slug } })
          .then(res => res.data.data)
          .catch(() => [])
      )
    ).then(results => {
      results.flat().forEach(d => { statusCache[d.areaId] = d.status; });
      setStatusReady(true); // triggers re-render so dropdowns update
    });
  }, []);

  // ── Derived selections — filtered by statusCache to hide inactive sensors ───
  const ALL_SENSORS   = Object.values(SENSOR_MAP).flat()
    .filter(s => statusCache[s.id] !== "Inactive");
  const ALL_LOCATIONS = Object.keys(SENSOR_MAP)
    .filter(loc => SENSOR_MAP[loc].some(s => statusCache[s.id] !== "Inactive"));

  const selSensors   = ALL_SENSORS.filter((s) => selSensorValues.includes(s.id));
  const selLocations = selLocationValues;

  const sensorOptionsList = selLocationValues.length > 0
    ? selLocationValues.flatMap((loc) => SENSOR_MAP[loc] ?? [])
        .filter(s => statusCache[s.id] !== "Inactive")
    : ALL_SENSORS;

  const locationOptionsList = selSensorValues.length > 0
    ? ALL_LOCATIONS.filter((loc) => selSensorValues.some((id) => SENSOR_LOCATION_MAP[id] === loc))
    : ALL_LOCATIONS;

  const sensorsToFetch = selSensors.length > 0
    ? selSensors
    : selLocations.flatMap((loc) => SENSOR_MAP[loc] ?? [])
        .filter(s => statusCache[s.id] !== "Inactive");

  const canApply = sensorsToFetch.length > 0 && range?.from && range?.to;

  // ── Filter handlers ─────────────────────────────────────────────────────────
  const handleLocationChange = (newLocValues) => {
    setSelLocationValues(newLocValues);
    if (newLocValues.length > 0) {
      const validIds = newLocValues.flatMap((loc) => SENSOR_MAP[loc] ?? []).map((s) => s.id);
      setSelSensorValues((prev) => prev.filter((id) => validIds.includes(id)));
    }
    setApplied(false); setApiError(null); setNoData(false);
  };

  const handleSensorChange = (newSensorIds) => {
    setSelSensorValues(newSensorIds);
    if (newSensorIds.length > 0) {
      const relevantLocs = [...new Set(newSensorIds.map((id) => SENSOR_LOCATION_MAP[id]))];
      setSelLocationValues((prev) => prev.length === 0 ? prev : prev.filter((loc) => relevantLocs.includes(loc)));
    }
    setApplied(false); setApiError(null); setNoData(false);
  };

  const handleRangeChange = (newRange) => {
    setRange(newRange ?? getDefault24hRange());
    setApplied(false); setApiError(null); setNoData(false);
  };

  // ── View toggle handler ─────────────────────────────────────────────────────
  const handleViewToggle = (view) => {
    if (view === chartView || !rawDataRef.current) return;
    const { labels: l, tempDS: t, humidDS: h } = view === "monthly"
      ? buildMonthlyDatasets(rawDataRef.current)
      : buildDailyDatasets(rawDataRef.current, resolution);
    setLabels(l); setTempDS(t); setHumidDS(h);
    setChartView(view);
    setChartKey(k => k + 1);
  };

  // ── Sunday toggle handler ───────────────────────────────────────────────────
  const handleSundayToggle = (e) => {
    const checked = e.target.checked;
    setIncludeSundays(checked);

    if (!allTimesRef.current || !rawDataRef.current) return;

    // Re-derive sortedTimes from the full unfiltered set stored in allTimesRef
    const filteredTimes = filterSundays(allTimesRef.current, checked);
    const updatedData   = { ...rawDataRef.current, sortedTimes: filteredTimes };
    rawDataRef.current  = updatedData;

    const { labels: l, tempDS: t, humidDS: h } = chartView === "monthly"
      ? buildMonthlyDatasets(updatedData)
      : buildDailyDatasets(updatedData, resolution);

    setLabels(l); setTempDS(t); setHumidDS(h);
    setChartKey(k => k + 1);
  };

  // ── Export handler — exports exactly what the chart has loaded ──────────────
  const handleExport = async () => {
    if (!rawDataRef.current || !applied) return;
    setExporting(true);
    try {
      await exportReadingsToExcel({
        rawData:      rawDataRef.current,
        limitProfiles,
        rangeFrom:    range.from,
        rangeTo:      range.to,
      });
    } catch (err) {
      console.error("Export failed:", err);
    } finally {
      setExporting(false);
    }
  };

  // ── Apply ───────────────────────────────────────────────────────────────────
  const handleApply = async () => {
    if (!canApply) return;
    setLoading(true); setApiError(null); setNoData(false);

    try {
      const areaIds = sensorsToFetch.map((s) => s.id);
      const from    = toISODate(range.from);
      const to      = toISODate(range.to);

      const res = await axios.get(`${API_BASE}/sensors/readings/history/batch`, {
        params: { areaIds, from, to },
        paramsSerializer: (params) => {
          const parts = [];
          (params.areaIds ?? []).forEach((id) => { parts.push(`areaIds[]=${encodeURIComponent(id)}`); });
          parts.push(`from=${params.from}`); parts.push(`to=${params.to}`);
          return parts.join("&");
        },
      });

      const batchData = res.data.data;
      const serverRes = res.data.meta?.resolution ?? "raw";

      const allTimes = new Set();
      Object.values(batchData).forEach(({ readings }) => {
        readings.forEach(r => allTimes.add(r.dayTime));
      });

      // Preserve the full unfiltered set so the Sunday toggle can restore them later
      const allSorted       = [...allTimes].sort();
      allTimesRef.current   = allSorted;

      // Apply Sunday filter based on current toggle state
      const sortedTimes = filterSundays(allSorted, includeSundays);

      if (sortedTimes.length === 0) {
        setNoData(true); setApplied(true); setLoading(false); return;
      }

      const perSensor = [];
      sensorsToFetch.forEach((sensor, i) => {
        const entry = batchData[sensor.id];
        if (!entry) return;
        const readingMap = {};
        entry.readings.forEach(r => { readingMap[r.dayTime] = r; });
        perSensor.push({
          readingMap,
          color: CHART_COLORS[i % CHART_COLORS.length],
          label: entry.lineName || sensor.name,
        });
      });

      const locationLimitMap = {};
      sensorsToFetch.forEach((sensor) => {
        const entry = batchData[sensor.id];
        if (!entry?.limits) return;
        const loc = SENSOR_LOCATION_MAP[sensor.id];
        if (!locationLimitMap[loc]) {
          locationLimitMap[loc] = { ...entry.limits, location: loc };
        } else {
          locationLimitMap[loc].tempUL  = Math.max(locationLimitMap[loc].tempUL,  entry.limits.tempUL);
          locationLimitMap[loc].tempLL  = Math.min(locationLimitMap[loc].tempLL,  entry.limits.tempLL);
          locationLimitMap[loc].humidUL = Math.max(locationLimitMap[loc].humidUL, entry.limits.humidUL);
          locationLimitMap[loc].humidLL = Math.min(locationLimitMap[loc].humidLL, entry.limits.humidLL);
        }
      });

      rawDataRef.current = { sortedTimes, perSensor };

      const { labels: l, tempDS: t, humidDS: h } = buildDailyDatasets(rawDataRef.current, serverRes);
      setResolution(serverRes);
      setLimitProfiles(Object.values(locationLimitMap));
      setLabels(l); setTempDS(t); setHumidDS(h);
      setChartView("daily");
      setChartKey(k => k + 1);
      setApplied(true);

    } catch (err) {
      console.error("Failed to fetch batch history:", err);
      setApiError(err.response?.data?.message ?? "Failed to fetch sensor data. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleClear = () => {
    setSelLocationValues([]); setSelSensorValues([]);
    setRange(getDefault24hRange());
    setTempDS([]); setHumidDS([]); setLabels([]); setLimitProfiles([]);
    setApplied(false); setApiError(null); setNoData(false);
    setChartView("daily"); setResolution("raw"); setIncludeSundays(false);
    rawDataRef.current  = null;
    allTimesRef.current = null;
  };

  const hintText = (() => {
    if (selSensors.length > 0 && selLocations.length === 0)
      return `${selSensors.length} sensor(s) selected — each will appear as one line.`;
    if (selLocations.length > 0 && selSensors.length === 0)
      return `${sensorsToFetch.length} sensor(s) across ${selLocations.join(", ")} — all will be graphed.`;
    if (selLocations.length > 0 && selSensors.length > 0)
      return `${selSensors.length} sensor(s) in ${selLocations.join(", ")} — graphing selected sensors only.`;
    return "Location narrows sensor options · Sensor narrows location options";
  })();

  const chartSubtitle = (metric) => {
    const resLabel = chartView === "monthly" ? "monthly" : resolution;
    return `${metric} · ${resLabel} · Scroll to zoom · Click & drag to pan`;
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6 p-6">

      {summaryLoading && <LoadingOverlay />}

      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="mt-1 text-muted-foreground">Temperature and Humidity Monitoring System</p>
      </div>

      <StatCards onFirstLoad={() => setSummaryLoading(false)} />

      <Card style={{ border: "1px solid #e9ecef" }}>
        <CardHeader className="flex flex-row items-start justify-between gap-4 pb-2">
          <div>
            <CardTitle className="text-base">Overview</CardTitle>
            <CardDescription>Select location, sensor and date range.</CardDescription>
          </div>
          <div className="flex gap-2 shrink-0">
            {applied && !noData && !apiError && (
              <Button
                variant="outline"
                size="default"
                onClick={handleExport}
                disabled={exporting}
                className="cursor-pointer gap-1.5"
              >
                <Download className="w-4 h-4" />
                {exporting ? "Exporting…" : "Export"}
              </Button>
            )}
            <Button variant="outline" size="default" onClick={handleClear} className="cursor-pointer">
              Clear
            </Button>
            <Button onClick={handleApply} disabled={!canApply || loading} className="cursor-pointer">
              {loading ? "Loading…" : "Apply"}
            </Button>
          </div>
        </CardHeader>
        <CardContent>

          {/* Filter row */}
          <div className="flex flex-wrap items-end gap-3 pb-4 border-b">
            <div className="flex flex-col gap-1 min-w-45 flex-1 [&_button]:cursor-pointer">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Location</label>
              <Combobox
                multiple
                options={toLocationOptions(locationOptionsList)}
                value={selLocationValues}
                onValueChange={handleLocationChange}
                placeholder="Select location…"
                searchPlaceholder="Search location…"
                emptyMessage="No locations found."
              />
            </div>
            <div className="flex flex-col gap-1 min-w-45 flex-1 [&_button]:cursor-pointer">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Sensor</label>
              <Combobox
                multiple
                options={toSensorOptions(sensorOptionsList)}
                value={selSensorValues}
                onValueChange={handleSensorChange}
                placeholder="Select sensor…"
                searchPlaceholder="Search sensor…"
                emptyMessage="No sensors found."
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Date Range</label>
              <DateRangePicker value={range} onChange={handleRangeChange} />
            </div>
          </div>

          {/* Legend row + Daily/Monthly toggle + Sunday checkbox */}
          <div className="flex items-center gap-4 pt-3 pb-1">
            <p className="text-xs text-muted-foreground flex-1">{hintText}</p>

            {applied && !noData && !apiError && (
              <>
                {/* Sunday toggle */}
                <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#6c757d", cursor: "pointer", userSelect: "none" }}>
                  <input
                    type="checkbox"
                    checked={includeSundays}
                    onChange={handleSundayToggle}
                    style={{ cursor: "pointer" }}
                  />
                  Include Sundays
                </label>

                {/* Daily / Monthly toggle */}
                <div style={{ display: "flex", alignItems: "center", gap: 2, border: "1px solid #e9ecef", background: "#f2f7ff", borderRadius: 8, padding: 3 }}>
                  {["daily", "monthly"].map((v) => (
                    <button
                      key={v}
                      onClick={() => handleViewToggle(v)}
                      style={{
                        padding: "4px 14px", borderRadius: 6, border: "none", cursor: "pointer",
                        fontSize: 12, fontWeight: chartView === v ? 600 : 400,
                        background: chartView === v ? "#fff" : "transparent",
                        boxShadow: chartView === v ? "0 1px 3px rgba(0,0,0,.10)" : "none",
                        transition: "all .15s",
                      }}
                    >
                      {v === "daily" ? "Daily" : "Monthly"}
                    </button>
                  ))}
                </div>
              </>
            )}

            <div className="flex items-center gap-3 shrink-0">
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <svg width="24" height="10"><line x1="0" y1="5" x2="24" y2="5" stroke="#c0392b" strokeWidth="1.5" strokeDasharray="6,4" /></svg>
                Upper limit
              </span>
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <svg width="24" height="10"><line x1="0" y1="5" x2="24" y2="5" stroke="#2471a3" strokeWidth="1.5" strokeDasharray="6,4" /></svg>
                Lower limit
              </span>
            </div>
          </div>

          {/* Chart area */}
          <div className="pt-4">
            {!chartReady || loading ? (
              <div className="flex items-center justify-center py-16 text-muted-foreground text-sm">
                {loading ? "Fetching sensor data…" : "Loading Chart.js…"}
              </div>
            ) : apiError ? (
              <div className="flex flex-col items-center justify-center py-16">
                <div style={{ background: "#ffe8e8", border: "1.5px solid #dc3545", borderRadius: 8, padding: "12px 20px" }} className="text-sm text-destructive text-center max-w-md">
                  {apiError}
                </div>
              </div>
            ) : applied && noData ? (
              <div className="flex flex-col items-center justify-center py-16 border-2 border-dashed rounded-lg text-center">
                <p className="font-semibold text-foreground mb-1">No readings found</p>
                <p className="text-sm text-muted-foreground">
                  No data exists for the selected sensor(s) in this date range.<br />
                  Try a different date range — data may only exist for older dates.
                </p>
              </div>
            ) : !applied ? (
              <div className="flex flex-col items-center justify-center py-16 border-2 border-dashed rounded-lg text-center">
                <span className="text-4xl mb-3"><FileText /></span>
                <p className="font-semibold text-foreground mb-1">No data to display</p>
                <p className="text-sm text-muted-foreground">
                  Select location or sensor then click <strong>Apply</strong>.
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-8">
                <SensorLineChart
                  key={`temp-${chartKey}`}
                  id="tempChart"
                  title="Temperature"
                  subtitle={chartSubtitle("Temperature (°C)")}
                  datasets={tempDS} labels={labels} yLabel="Temperature (°C)"
                  limitProfiles={limitProfiles} limitKeyUL="tempUL" limitKeyLL="tempLL"
                />
                <div className="border-t" />
                <SensorLineChart
                  key={`humid-${chartKey}`}
                  id="humidChart"
                  title="Humidity"
                  subtitle={chartSubtitle("Humidity (%)")}
                  datasets={humidDS} labels={labels} yLabel="Humidity (%)"
                  limitProfiles={limitProfiles} limitKeyUL="humidUL" limitKeyLL="humidLL"
                />
              </div>
            )}
          </div>

        </CardContent>
      </Card>
    </div>
  );
}