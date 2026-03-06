"use client";

// ─────────────────────────────────────────────────────────────────────────────
// IMPORTS
// ─────────────────────────────────────────────────────────────────────────────
import { useState, useRef, useEffect, useCallback } from "react";
import { Users, DollarSign, ShoppingCart, TrendingUp, ChevronDown, Droplets, Thermometer, TriangleAlert, Radio, FileText, Eye, EyeOff } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { MessageBox } from "@/components/custom/MessageBox";
import { DashboardCard } from "@/components/custom/DashboardCard";
import { DatePicker, DateRangePicker, defaultDateRangePresets } from "@/components/ui/date-picker";
import { Button } from "@/components/ui/button";
import { Combobox } from "@/components/custom/Combobox";

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 1: DATA LAYER  ← replace contents here when connecting to backend
// ─────────────────────────────────────────────────────────────────────────────

/**
 * LOCATION → SENSORS MAP
 * Shape: { [locationName]: { id, name, floor }[] }
 *
 * TO REPLACE: const SENSOR_MAP = await fetch("/api/locations").then(r => r.json())
 */
const SENSOR_MAP = {
  "Cold Storage": [
    { id: "cs-s1",       name: "SMT - Cold Storage"      },
    { id: "cs-s2",       name: "WH - Cold Storage"       },
    { id: "cs-s3",       name: "WH - Cold Storage 2"     },
  ],
  "P1F1": [
    { id: "p1f1-s1",     name: "AOI"                     },
    { id: "p1f1-s2",     name: "Coating"                 },
    { id: "p1f1-s3",     name: "Dipping"                 },
    { id: "p1f1-s4",     name: "Dipping2"                },
    { id: "p1f1-s5",     name: "Server Room"             },
    { id: "p1f1-s6",     name: "SMT"                     },
    { id: "p1f1-s7",     name: "SMT MH"                  },
    { id: "p1f1-s8",     name: "SMT MH Dessicator 1"     },
    { id: "p1f1-s9",     name: "SMT MH Dessicator 2"     },
    { id: "p1f1-s10",    name: "SMT MH Dessicator 3"     },
    { id: "p1f1-s11",    name: "SMT MH Dessicator 4"     },
    { id: "p1f1-s12",    name: "SMT MH Dessicator 5"     },
    { id: "p1f1-s13",    name: "SMT MH Dessicator 6"     },
    { id: "p1f1-s14",    name: "SMT MH Receiving"        },
    { id: "p1f1-s15",    name: "BGA Rework"              },
    { id: "p1f1-s16",    name: "SMT - Cold Storage"      },
  ],
  "P1F2": [
    { id: "p1f2-s1",     name: "Brother Assy 1"          },
    { id: "p1f2-s2",     name: "Brother Assy 2"          },
    { id: "p1f2-s3",     name: "JCM PCBA"                },
    { id: "p1f2-s4",     name: "MH Brother Packaging"    },
  ],
  "P2F1": [
    { id: "p2f1-s1",     name: "FG"                      },
    { id: "p2f1-s2",     name: "Warehouse Office"        },
    { id: "p2f1-s3",     name: "WO-North"                },
    { id: "p2f1-s4",     name: "WO-South - Holding Area" },
    { id: "p2f1-s5",     name: "WO-S-West-IQC"           },
    { id: "p2f1-s6",     name: "WO-W South-QA"           },
    { id: "p2f1-s7",     name: "WH - Cold Storage"       },
    { id: "p2f1-s8",     name: "WH - Cold Storage 2"     },
  ],
  "P2F2": [
    { id: "p2f2-s1",     name: "Calibration Room"        },
    { id: "p2f2-s2",     name: "CIS"                     },
    { id: "p2f2-s3",     name: "JCM Assy"                },
    { id: "p2f2-s4",     name: "WH Brother Packaging"    },
    { id: "p2f2-s5",     name: "WH-MH JCM Assy"          },
  ],
  "P1&2F2": [
    { id: "bridge-s1",   name: "P1P2_Bridge"             },
  ],
  "WH": [
    { id: "wh-s1",       name: "WH-A"                    },
    { id: "wh-s2",       name: "WH-B"                    },
    { id: "wh-s3",       name: "WH-C"                    },
    { id: "wh-s4",       name: "WH-D"                    },
    { id: "wh-s5",       name: "WH-E"                    },
    { id: "wh-s6",       name: "WH-F"                    },
    { id: "wh-s7",       name: "WH-G"                    },
    { id: "wh-s8",       name: "WH-H"                    },
  ],
  // Unassigned — no location designation provided; kept separate until confirmed
  "Unassigned": [
    { id: "unassigned-s1", name: "Facilities"            },
  ],
};


// Flat list of all locations
const ALL_LOCATIONS = Object.keys(SENSOR_MAP);

// Flat list of all sensors across all locations
const ALL_SENSORS = Object.values(SENSOR_MAP).flat();

// Lookup: sensorId → location name  (used for reverse-filtering)
const SENSOR_LOCATION_MAP = {};
Object.entries(SENSOR_MAP).forEach(([loc, sensors]) => {
  sensors.forEach((s) => { SENSOR_LOCATION_MAP[s.id] = loc; });
});

/**
 * UL / LL per location
 * TO REPLACE: fetch(`/api/limits/${locationId}`)
 */
const LOCATION_LIMITS = {
  "Cold Storage": { tempUL: 18, tempLL: -2,  humidUL: 70, humidLL: 30 },
  "P1F1":         { tempUL: 28, tempLL: 13,  humidUL: 80, humidLL: 40 },
  "P1F2":         { tempUL: 28, tempLL: 13,  humidUL: 80, humidLL: 40 },
  "P2F1":         { tempUL: 30, tempLL: 15,  humidUL: 85, humidLL: 35 },
  "P2F2":         { tempUL: 30, tempLL: 15,  humidUL: 85, humidLL: 35 },
  "P1&2F2":       { tempUL: 28, tempLL: 13,  humidUL: 80, humidLL: 40 },
  "WH":           { tempUL: 30, tempLL: 15,  humidUL: 85, humidLL: 35 },
  "Unassigned":   { tempUL: 30, tempLL: 13,  humidUL: 85, humidLL: 35 },
};

/**
 * Summary stats for the 4 top cards.
 * TO REPLACE: fetch("/api/summary")
 */
const SUMMARY_STATS = {
  avgTemp:        "24.3°C",
  avgHumid:       "62.1%",
  activeSensors:  "21",
  criticalAlerts: "2",
};

/**
 * Fetch sensor readings. Swap the body for a real API call.
 */
async function fetchSensorData(sensorIds, dateFrom, dateTo) {
  const labels = buildTimeLabels(dateFrom, dateTo);
  const seriesMap = {};
  sensorIds.forEach((id) => {
    const isCS    = id.startsWith("cs-");
    seriesMap[id] = {
      temp:  randomSeries(labels.length, isCS ? 3  : 24, isCS ? 2 : 2),
      humid: randomSeries(labels.length, isCS ? 55 : 62, isCS ? 8 : 6),
    };
  });
  return { labels, seriesMap };
}


// ─────────────────────────────────────────────────────────────────────────────
// SECTION 2: PURE UTILITY FUNCTIONS
// ─────────────────────────────────────────────────────────────────────────────

function buildTimeLabels(dateFrom, dateTo) {
  const labels = [];
  const cur    = new Date(dateFrom + "T00:00:00");
  const end    = new Date(dateTo   + "T23:59:59");
  while (cur <= end) {
    labels.push(
      new Date(cur).toLocaleString("en-PH", {
        month: "short", day: "numeric",
        hour: "2-digit", minute: "2-digit", hour12: false,
      })
    );
    cur.setHours(cur.getHours() + 1);
  }
  return labels;
}

function randomSeries(length, base, spread) {
  return Array.from({ length }, () =>
    +(base + (Math.random() - 0.5) * spread * 2).toFixed(1)
  );
}

const CHART_COLORS = [
  "#dc3545","#fd7e14","#ffc107","#435ebe","#198754","#0dcaf0",
  "#6f42c1","#20c997","#e83e8c","#17a2b8","#ff6384","#36a2eb",
  "#9966ff","#ff9f40","#d62728","#2ca02c","#c9cbcf","#f77825",
];

// ── Limit line colors — chosen to stand apart from all sensor colors ──────────
// UL → warm crimson-red    LL → steel blue
const LIMIT_UL_COLOR = "#c0392b";  // deep red,  distinct from sensor #dc3545 orange-red
const LIMIT_LL_COLOR = "#2471a3";  // steel blue, distinct from sensor #435ebe button-blue

function buildChartDatasets(sensors, seriesMap, key) {
  return sensors.map((sensor, i) => ({
    label:           sensor.name,
    data:            seriesMap[sensor.id]?.[key] ?? [],
    borderColor:     CHART_COLORS[i % CHART_COLORS.length],
    backgroundColor: CHART_COLORS[i % CHART_COLORS.length] + "22",
    borderWidth: 2, pointRadius: 2, tension: 0.3, fill: false,
  }));
}


// ─────────────────────────────────────────────────────────────────────────────
// SECTION 3: CHART.JS LOADER
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
// SECTION 4: OPTION CONVERTERS
// ─────────────────────────────────────────────────────────────────────────────

const toLocationOptions = (locations) =>
  locations.map((loc) => ({ value: loc, label: loc }));

const toSensorOptions = (sensors) =>
  sensors.map((s) => ({ value: s.id, label: s.name }));


// ─────────────────────────────────────────────────────────────────────────────
// SECTION 5: REUSABLE UI COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────

function SensorLineChart({ id, title, subtitle, datasets, labels, yLabel, limitProfiles, limitKeyUL, limitKeyLL }) {
  const cvs                     = useRef(null);
  const inst                    = useRef(null);
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    if (!window.Chart || !cvs.current) return;
    if (inst.current) inst.current.destroy();

    // Build limit datasets — one UL line + one LL line per active location profile.
    // UL = dashed red, LL = dashed blue. Both are purely dashed, no fill.
    const limitDatasets = limitProfiles.flatMap((profile) => {
      const ulVal = profile[limitKeyUL];
      const llVal = profile[limitKeyLL];
      const suffix = limitProfiles.length > 1 ? ` (${profile.location})` : "";
      return [
        {
          label:       `UL ${ulVal}${suffix}`,
          data:        labels.map(() => ulVal),
          borderColor: LIMIT_UL_COLOR,
          borderDash:  [8, 5],
          borderWidth: 1.5,
          pointRadius: 0,
          fill:        false,
          order:       0,
        },
        {
          label:       `LL ${llVal}${suffix}`,
          data:        labels.map(() => llVal),
          borderColor: LIMIT_LL_COLOR,
          borderDash:  [8, 5],
          borderWidth: 1.5,
          pointRadius: 0,
          fill:        false,
          order:       0,
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

  const onMouseDown = useCallback(() => setDragging(true),  []);
  const onMouseUp   = useCallback(() => setDragging(false), []);
  useEffect(() => {
    window.addEventListener("mouseup", onMouseUp);
    return () => window.removeEventListener("mouseup", onMouseUp);
  }, [onMouseUp]);

  return (
    <div>
      <h6>{title}</h6>
      <p className="text-xs text-muted-foreground mt-1 ml-3">{subtitle}</p>
      <div
        onMouseDown={onMouseDown} onMouseUp={onMouseUp}
        style={{ height: 320, cursor: dragging ? "grabbing" : "grab", userSelect: "none" }}
      >
        <canvas ref={cvs} id={id} style={{ display: "block", width: "100%", height: "100%" }} />
      </div>
    </div>
  );
}


// ─────────────────────────────────────────────────────────────────────────────
// SECTION 6: MAIN PAGE
// ─────────────────────────────────────────────────────────────────────────────

export default function Dashboard() {
  const chartReady = useChartJS();

  // ── Filter state ────────────────────────────────────────────────────────────
  const [selLocationValues, setSelLocationValues] = useState([]);
  const [selSensorValues,   setSelSensorValues]   = useState([]);

  const today = new Date();
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(today.getDate() - 6);
  const [range, setRange] = useState({ from: sevenDaysAgo, to: today });

  // ── Chart data state ────────────────────────────────────────────────────────
  const [labels,   setLabels]   = useState([]);
  const [tempDS,   setTempDS]   = useState([]);
  const [humidDS,  setHumidDS]  = useState([]);
  const [chartKey, setChartKey] = useState(0);
  const [applied,  setApplied]  = useState(false);
  const [loading,  setLoading]  = useState(false);

  // ── Derive full objects from selected string values ─────────────────────────
  const selSensors   = ALL_SENSORS.filter((s) => selSensorValues.includes(s.id));
  const selLocations = selLocationValues;

  // ── CROSS-FILTER LOGIC ──────────────────────────────────────────────────────
  const sensorOptionsList = selLocationValues.length > 0
    ? selLocationValues.flatMap((loc) => SENSOR_MAP[loc] ?? [])
    : ALL_SENSORS;

  const locationOptionsList = selSensorValues.length > 0
    ? ALL_LOCATIONS.filter((loc) =>
        selSensorValues.some((id) => SENSOR_LOCATION_MAP[id] === loc)
      )
    : ALL_LOCATIONS;

  const handleLocationChange = (newLocValues) => {
    setSelLocationValues(newLocValues);
    if (newLocValues.length > 0) {
      const validIds = newLocValues.flatMap((loc) => SENSOR_MAP[loc] ?? []).map((s) => s.id);
      setSelSensorValues((prev) => prev.filter((id) => validIds.includes(id)));
    }
    setApplied(false);
  };

  const handleSensorChange = (newSensorIds) => {
    setSelSensorValues(newSensorIds);
    if (newSensorIds.length > 0) {
      const relevantLocs = [...new Set(newSensorIds.map((id) => SENSOR_LOCATION_MAP[id]))];
      setSelLocationValues((prev) => {
        if (prev.length === 0) return prev;
        return prev.filter((loc) => relevantLocs.includes(loc));
      });
    }
    setApplied(false);
  };

  const sensorsToFetch = selSensors.length > 0
    ? selSensors
    : selLocations.flatMap((loc) => SENSOR_MAP[loc] ?? []);

  const canApply = sensorsToFetch.length > 0 && range?.from && range?.to;

  const graphedLocations = [...new Set(sensorsToFetch.map(s => SENSOR_LOCATION_MAP[s.id]))];

  const activeLimitProfiles = graphedLocations
    .map(loc => ({ location: loc, ...LOCATION_LIMITS[loc] }))
    .filter(Boolean);

  const handleApply = async () => {
    if (!range?.from || !range?.to) return;
    setLoading(true);
    const fromStr = range.from.toISOString().split("T")[0];
    const toStr   = range.to.toISOString().split("T")[0];
    const ids = sensorsToFetch.map((s) => s.id);
    const { labels: lbl, seriesMap } = await fetchSensorData(ids, fromStr, toStr);
    setLabels(lbl);
    setTempDS(buildChartDatasets(sensorsToFetch, seriesMap, "temp"));
    setHumidDS(buildChartDatasets(sensorsToFetch, seriesMap, "humid"));
    setChartKey((k) => k + 1);
    setApplied(true);
    setLoading(false);
  };

  const handleClear = () => {
    setSelLocationValues([]); setSelSensorValues([]);
    setRange(undefined);
    setTempDS([]); setHumidDS([]); setApplied(false);
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

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6 p-6">

      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="mt-1 text-muted-foreground">Temperature and Humidity Monitoring System</p>
      </div>

      {/* Stat cards */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <DashboardCard value={SUMMARY_STATS.avgTemp}        label="Avg. Temperature" icon={Thermometer}   variant="primary"     />
        <DashboardCard value={SUMMARY_STATS.avgHumid}       label="Avg. Humidity"    icon={Droplets}      variant="success"     />
        <DashboardCard value={SUMMARY_STATS.activeSensors}  label="Active Sensors"   icon={Radio}         variant="warning"     />
        <DashboardCard value={SUMMARY_STATS.criticalAlerts} label="Critical Alerts"  icon={TriangleAlert} variant="destructive" />
      </div>

      {/* Filter + Charts card */}
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4 pb-2">
          <div>
            <CardTitle className="text-base">Overview</CardTitle>
            <CardDescription>Select location, sensor and date range.</CardDescription>
          </div>
          <div className="flex gap-2 shrink-0">
            <Button variant="outline" size="default" onClick={handleClear} className="cursor-pointer">
              Clear
            </Button>
            <Button onClick={handleApply} disabled={!canApply || loading} className="cursor-pointer">
              {loading ? "Loading…" : "Apply"}
            </Button>
          </div>
        </CardHeader>
        <CardContent>

          {/* Filter row — Limits toggle removed */}
          <div className="flex flex-wrap items-end gap-3 pb-4 border-b">

            {/* Location */}
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

            {/* Sensor */}
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

            {/* Date Picker */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Date Range</label>
              <DateRangePicker value={range} onChange={setRange} />
            </div>

          </div>

          {/* Limit line legend hint */}
          <div className="flex items-center gap-4 pt-3 pb-1">
            <p className="text-xs text-muted-foreground flex-1">{hintText}</p>
            <div className="flex items-center gap-3 shrink-0">
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <svg width="24" height="10"><line x1="0" y1="5" x2="24" y2="5" stroke={`#c0392b`} strokeWidth="1.5" strokeDasharray="6,4" /></svg>
                Upper limit
              </span>
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <svg width="24" height="10"><line x1="0" y1="5" x2="24" y2="5" stroke={`#2471a3`} strokeWidth="1.5" strokeDasharray="6,4" /></svg>
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
            ) : !applied ? (
              <div className="flex flex-col items-center justify-center py-16 border-2 border-dashed rounded-lg text-center">
                <span className="text-4xl mb-3"><FileText /></span>
                <p className="font-semibold text-foreground mb-1">No data to display</p>
                <p className="text-sm text-muted-foreground">
                  Select location, sensor and date range then click <strong>Apply</strong>.
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-8">
                <SensorLineChart
                  key={`temp-${chartKey}`}
                  id="tempChart" title="Temperature"
                  subtitle="Temperature (°C) · Scroll to zoom · Click & drag to pan"
                  datasets={tempDS} labels={labels} yLabel="Temperature (°C)"
                  limitProfiles={activeLimitProfiles} limitKeyUL="tempUL" limitKeyLL="tempLL"
                />
                <div className="border-t" />
                <SensorLineChart
                  key={`humid-${chartKey}`}
                  id="humidChart" title="Humidity"
                  subtitle="Humidity (%) · Scroll to zoom · Click & drag to pan"
                  datasets={humidDS} labels={labels} yLabel="Humidity (%)"
                  limitProfiles={activeLimitProfiles} limitKeyUL="humidUL" limitKeyLL="humidLL"
                />
              </div>
            )}
          </div>

        </CardContent>
      </Card>
    </div>
  );
}