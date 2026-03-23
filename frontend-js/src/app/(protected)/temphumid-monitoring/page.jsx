"use client";

import { useState, useEffect, useRef } from "react";
import { DataTable } from "@/components/custom/DataTable";
import axios from "@/lib/axios";

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 1: CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

const API_BASE = '/api/temphumid';

// Consolidated inactive areas across ALL map pages.
// Breaches from these areaIds are suppressed (shown as active/green).
const INACTIVE_AREAS = new Set([

]);

// Module-level cache — persists across page navigations (component unmount/remount).
// Populated after first successful fetch so switching pages shows last known data instantly.
let floorsCache = null;
let statusCache  = {}; // { [areaId]: 'Active' | 'Inactive' } — persists across navigations

// Static floor metadata — only ids, labels, images, hrefs, and areaId mappings.
// Live data (temp, humid, hasData, breach, limits, lastSeen) comes from the API.
const ALL_FLOORS = [
  {
    id:    "p1f1",
    label: "P1F1",
    image: "/logo/assets/P1F1-6.png",
    href:  "/temphumid-p1f1",
    sensors: [
      { id: "aoi",         areaId: "P1F1-04", name: "AOI"                  },
      { id: "dipping2",    areaId: "P1F1-06", name: "Dipping 2"            },
      { id: "dipping",     areaId: "P1F1-01", name: "Dipping"              },
      { id: "server-room", areaId: "P1F1-03", name: "Server Room"          },
      { id: "smt",         areaId: "P1F1-02", name: "SMT"                  },
      { id: "smt-cs",      areaId: "P1F1-10", name: "SMT - Cold Storage"   },
      { id: "smt-mh",      areaId: "P1F1-05", name: "SMT MH"               },
      { id: "smt-mh-rcv",  areaId: "P1F1-14", name: "SMT MH Receiving"     },
      { id: "bga-r",       areaId: "P1F1-15", name: "BGA Rework"           },
      { id: "coating",     areaId: "P1F1-17", name: "Coating Area"         },
      { id: "dess-1",      areaId: "P1F1-09", name: "SMT MH Dessicator 1"  },
      { id: "dess-2",      areaId: "P1F1-07", name: "SMT MH Dessicator 2"  },
      { id: "dess-3",      areaId: "P1F1-11", name: "SMT MH Dessicator 3"  },
      { id: "dess-4",      areaId: "P1F1-12", name: "SMT MH Dessicator 4"  },
      { id: "dess-5",      areaId: "P1F1-13", name: "SMT MH Dessicator 5"  },
      //{ id: "dess-6",      areaId: "P1F1-16", name: "SMT MH Dessicator 6"  },
    ],
  },
  {
    id:    "p1f2",
    label: "P1F2",
    image: "/logo/assets/P1F2.png",
    href:  "/temphumid-p1f2",
    sensors: [
      { id: "brother-assy-1", areaId: "P1F2-03", name: "Brother Assy 1"       },
      { id: "brother-assy-2", areaId: "P1F2-02", name: "Brother Assy 2"       },
      { id: "jcm-pcba",       areaId: "P1F2-01", name: "JCM PCBA"             },
      { id: "mh-brother-pkg", areaId: "P1F2-05", name: "MH Brother Packaging" },
    ],
  },
  {
    id:    "p2f1",
    label: "P2F1",
    image: "/logo/assets/P2F1.png",
    href:  "/temphumid-p2f1",
    sensors: [
      { id: "fg",               areaId: "P2F1-03", name: "FG"                      },
      { id: "warehouse-office", areaId: "P2F1-01", name: "Warehouse Office"        },
      { id: "wh-cs",            areaId: "P2F1-16", name: "WH - Cold Storage"       },
      { id: "wh-cs2",           areaId: "P2F1-17", name: "WH - Cold Storage 2"     },
      { id: "wo-north",         areaId: "P2F1-18", name: "WO-North"               },
      { id: "wo-south-ha",      areaId: "P2F1-07", name: "WO-South Holding Area"  },
      { id: "wo-sw-iqc",        areaId: "P2F1-04", name: "WO-S-West-IQC"          },
      { id: "wo-w-south-qa",    areaId: "P2F1-05", name: "WO-W South-QA"          },
    ],
  },
  {
    id:    "p2f2",
    label: "P2F2",
    image: "/logo/assets/P2F2.png",
    href:  "/temphumid-p2f2",
    sensors: [
      { id: "calibration-room", areaId: "P2F2-04", name: "Calibration Room"     },
      { id: "jcm-assy",         areaId: "P2F2-01", name: "JCM Assy"             }, 
      { id: "wh-brother-pkg",   areaId: "P2F2-02", name: "WH Brother Packaging" },
      { id: "wh-mh-jcm-assy",   areaId: "P2F2-03", name: "WH-MH JCM Assy"       },
      { id: "cis",              areaId: "P1F1-16", name: "CIS"                  }, // temp areaId
    ],
  },
  {
    id:    "wh",
    label: "WH",
    image: "/logo/assets/WH.png",
    href:  "/temphumid-wh",
    sensors: [
      { id: "wh-a", areaId: "P2F1-08", name: "WH-A" },
      { id: "wh-b", areaId: "P2F1-09", name: "WH-B" },
      { id: "wh-c", areaId: "P2F1-10", name: "WH-C" },
      { id: "wh-d", areaId: "P2F1-11", name: "WH-D" },
      { id: "wh-e", areaId: "P2F1-12", name: "WH-E" },
      { id: "wh-f", areaId: "P2F1-13", name: "WH-F" },
      { id: "wh-g", areaId: "P2F1-14", name: "WH-G" },
      { id: "wh-h", areaId: "P2F1-15", name: "WH-H" },
    ],
  },
  {
    id:    "p1and2f2",
    label: "P1&2F2",
    image: "/logo/assets/P1-P2F2-1.png",
    href:  "/temphumid-p12f2",
    sensors: [
      { id: "p1p2-bridge", areaId: "P1F2-06", name: "P1P2 Bridge" },
    ],
  },
];

// Floor slug map — used for the API ?floor= param
const FLOOR_SLUG = {
  p1f1:     "p1f1",
  p1f2:     "p1f2",
  p2f1:     "p2f1",
  p2f2:     "p2f2",
  wh:       "wh",
  p1and2f2: "p12f2",
};


// ─────────────────────────────────────────────────────────────────────────────
// SECTION 2: BLINK ANIMATION
// ─────────────────────────────────────────────────────────────────────────────

const GLOBAL_STYLES = `
  @keyframes borderBlink {
    0%, 100% { box-shadow: 0 0 0 3px #dc3545, 0 4px 16px rgba(220,53,69,.35); }
    50%       { box-shadow: 0 0 0 3px rgba(220,53,69,.15), 0 4px 16px rgba(220,53,69,.1); }
  }
  @keyframes dotPulse {
    0%, 100% { opacity: 1; transform: scale(1); }
    50%       { opacity: .4; transform: scale(.75); }
  }
  @keyframes slideIn {
    from { opacity: 0; transform: translateY(12px); }
    to   { opacity: 1; transform: translateY(0);    }
  }
  @keyframes spinLoader {
    to { transform: rotate(360deg); }
  }
`;


// ─────────────────────────────────────────────────────────────────────────────
// SECTION 3: HELPERS & STATUS CONFIG
// ─────────────────────────────────────────────────────────────────────────────

function getSensorStatus(sensor) {
  if (!sensor.hasData) return "no_data";
  if (sensor.breach)   return "breach";
  return "active";
}

const STATUS_PRIORITY = { breach: 0, no_data: 1, active: 2 };

function getFloorStatus(floor) {
  let top = "active";
  for (const s of floor.sensors) {
    const st = getSensorStatus(s);
    if (STATUS_PRIORITY[st] < STATUS_PRIORITY[top]) top = st;
  }
  return top;
}

function getFloorSummary(floor) {
  const breached = floor.sensors.filter(s => getSensorStatus(s) === "breach").length;
  const noData   = floor.sensors.filter(s => getSensorStatus(s) === "no_data").length;
  const parts = [];
  if (breached > 0) parts.push(`${breached} in breach`);
  if (noData   > 0) parts.push(`${noData} no data`);
  return parts.length ? parts.join(" · ") : "All stable";
}

const STATUS_CONFIG = {
  breach:  { color: "#dc3545", bg: "#ffe8e8", label: "Breach",  dot: "#dc3545" },
  no_data: { color: "#6c757d", bg: "#f1f3f5", label: "No Data", dot: "#adb5bd" },
  active:  { color: "#198754", bg: "#e8fff8", label: "Active",  dot: "#00c9a7" },
};

function BreachDot() {
  return (
    <div style={{
      width: 10, height: 10, borderRadius: "50%",
      background: "#dc3545", flexShrink: 0,
      animation: "dotPulse 1s ease-in-out infinite",
    }} />
  );
}

function StatusDot({ status, size = 8 }) {
  const cfg = STATUS_CONFIG[status];
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%",
      background: cfg.dot, flexShrink: 0,
      animation: status === "breach" ? "dotPulse 1.2s ease-in-out infinite" : "none",
    }} />
  );
}


// ─────────────────────────────────────────────────────────────────────────────
// SECTION 4: LOADING OVERLAY
// Blocks the entire page on first fetch — disappears once data arrives.
// Subsequent polls run silently in the background without showing this.
// ─────────────────────────────────────────────────────────────────────────────

function LoadingOverlay() {
  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 200,
      background: "rgba(0,0,0,.55)",
      display: "flex", alignItems: "center", justifyContent: "center",
    }}>
      <div style={{
        background: "#fff", borderRadius: 10, padding: "36px 48px",
        display: "flex", flexDirection: "column", alignItems: "center", gap: 20,
        boxShadow: "0 8px 40px rgba(0,0,0,.18)", minWidth: 260,
      }}>
        {/* Spinner */}
        <div style={{
          width: 44, height: 44, borderRadius: "50%",
          border: "4px solid #e9ecef",
          borderTop: "4px solid #435ebe",
          animation: "spinLoader 0.8s linear infinite",
        }} />
        <div style={{ textAlign: "center" }}>
          <p style={{ fontWeight: 700, fontSize: 15, color: "#212529", margin: 0 }}>Fetching sensor data</p>
          <p style={{ fontSize: 12, color: "#6c757d", marginTop: 6 }}>Please wait while live readings are loaded…</p>
        </div>
      </div>
    </div>
  );
}


// ─────────────────────────────────────────────────────────────────────────────
// SECTION 5: FLOOR CARD & MODAL COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────

function FloorCard({ floor, onClick }) {
  const floorStatus = getFloorStatus(floor);
  const summary     = getFloorSummary(floor);
  const cfg         = STATUS_CONFIG[floorStatus];
  const isBreach    = floorStatus === "breach";

  return (
    <div
      onClick={() => onClick(floor)}
      style={{
        borderRadius: 5, overflow: "hidden", cursor: "pointer",
        border: `2px solid ${cfg.color}`,
        animation: isBreach ? "borderBlink 1.2s ease-in-out infinite" : "none",
        background: "#fff", transition: "transform .15s",
        display: "flex", flexDirection: "column",
      }}
      onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-3px)"; }}
      onMouseLeave={e => { e.currentTarget.style.transform = "translateY(0)"; }}
    >
      <div style={{ flex: 1, overflow: "hidden", background: "#f8f9fa", minHeight: 180, maxHeight: 240 }}>
        <img src={floor.image} alt={floor.label}
          style={{ width: "100%", height: "100%", objectFit: "contain", display: "block", pointerEvents: "none", userSelect: "none" }} />
      </div>
      <div style={{ padding: "10px 14px", background: cfg.bg, display: "flex", alignItems: "center", gap: 8 }}>
        {isBreach && <BreachDot />}
        {!isBreach && floorStatus !== "active" && <StatusDot status={floorStatus} size={10} />}
        <span style={{ fontWeight: 700, fontSize: 15, color: cfg.color, flex: 1 }}>{floor.label}</span>
        <span style={{ fontSize: 11, color: cfg.color, fontWeight: 600 }}>{summary}</span>
      </div>
    </div>
  );
}

function SensorStatusRow({ sensor, index }) {
  const [open, setOpen] = useState(false);
  const status = getSensorStatus(sensor);
  const cfg    = STATUS_CONFIG[status];

  return (
    <div style={{
      background: cfg.bg, border: `1px solid ${cfg.color}25`,
      borderRadius: 5, marginBottom: 8, overflow: "hidden",
      animation: "slideIn .2s ease both", animationDelay: `${index * 0.05}s`,
    }}>
      <div
        onClick={() => setOpen(v => !v)}
        style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", cursor: "pointer", userSelect: "none" }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <StatusDot status={status} size={8} />
          <span style={{ fontWeight: 600, fontSize: 14, color: cfg.color }}>{sensor.name}</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 5, background: cfg.color, color: "#fff", letterSpacing: ".04em", textTransform: "uppercase" }}>
            {cfg.label}
          </span>
          <span style={{ fontSize: 16, color: cfg.color, transition: "transform .2s", display: "inline-block", transform: open ? "rotate(180deg)" : "rotate(0deg)" }}>‹</span>
        </div>
      </div>
      {open && (
        <div style={{ padding: "0 16px 12px", borderTop: `1px solid ${cfg.color}15` }}>
        {sensor.hasData ? (
          <>
            <div style={{ fontSize: 13, color: cfg.color, marginTop: 8 }}>
              <div>
                Temp: <strong>{sensor.temp?.toFixed(2)}°C</strong>
                {sensor.tempLL != null && sensor.tempUL != null && (
                  <span style={{ fontSize: 11, color: "#6c757d", marginLeft: 6 }}>
                    {sensor.tempLL}–{sensor.tempUL}°C
                  </span>
                )}
              </div>
              <div style={{ marginTop: 3 }}>
                Humidity: <strong>{sensor.humid?.toFixed(2)}%</strong>
                {sensor.humidLL != null && sensor.humidUL != null && (
                  <span style={{ fontSize: 11, color: "#6c757d", marginLeft: 6 }}>
                    {sensor.humidLL}–{sensor.humidUL}%
                  </span>
                )}
              </div>
            </div>
            {sensor.breach && (
              <div style={{ fontSize: 11, color: "#dc3545", marginTop: 4, fontWeight: 600 }}>⚠ Exceeds limit</div>
            )}
          </>
          ) : (
            <div style={{ fontSize: 12, color: cfg.color, marginTop: 8, opacity: .8 }}>
              No readings available — sensor may be offline.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function FloorModal({ floor, onClose }) {
  const floorStatus = getFloorStatus(floor);
  const summary     = getFloorSummary(floor);
  const cfg         = STATUS_CONFIG[floorStatus];
  const isBreach    = floorStatus === "breach";
  const isAllGood   = floorStatus === "active";

  // Cache filtered lists to avoid double filtering
  const activeSensors = floor.sensors.filter(s => getSensorStatus(s) === "active");
  const flaggedSensors = floor.sensors
    .filter(s => getSensorStatus(s) !== "active")
    .sort((a, b) => STATUS_PRIORITY[getSensorStatus(a)] - STATUS_PRIORITY[getSensorStatus(b)]);

  const counts = {};
  for (const s of flaggedSensors) {
    const st = getSensorStatus(s);
    counts[st] = (counts[st] || 0) + 1;
  }

  useEffect(() => {
    const handler = e => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 100, background: "rgba(0,0,0,.45)", display: "flex", flexDirection: "column", animation: "slideIn .18s ease" }}>
      <div style={{ flex: 1, background: "#fff", display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <div style={{ padding: "14px 24px", borderBottom: "1px solid #e9ecef", display: "flex", alignItems: "center", justifyContent: "space-between", background: "#fff" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {isBreach && <BreachDot />}
            {!isBreach && !isAllGood && <StatusDot status={floorStatus} size={10} />}
            <span style={{ fontWeight: 700, fontSize: 18, color: "#212529" }}>{floor.label}</span>
            <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 8px", borderRadius: 5, background: cfg.color, color: "#fff" }}>{summary}</span>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 24, cursor: "pointer", color: "#6c757d", lineHeight: 1, padding: "0 4px" }}>×</button>
        </div>

        <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
          <div style={{ flex: 1, overflow: "hidden", position: "relative", background: "#f8f9fa" }}>
            <img src={floor.image} alt={floor.label}
              style={{ width: "100%", height: "100%", objectFit: "contain", display: "block", userSelect: "none" }} />
          </div>

          <div style={{ width: 320, flexShrink: 0, borderLeft: "1px solid #e9ecef", display: "flex", flexDirection: "column", overflow: "hidden", background: isAllGood ? "#f0fff8" : "#fafafa" }}>
            <div style={{ flex: 1, overflowY: "auto", padding: "16px" }}>
              {isAllGood ? (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", padding: 24, textAlign: "center", gap: 12 }}>
                  <div style={{ fontWeight: 700, fontSize: 16, color: "#0a6644" }}>All Clear</div>
                  <div style={{ fontSize: 13, color: "#198754", lineHeight: 1.6 }}>
                    All temperature and humidity levels at {floor.label} are within acceptable limits.
                  </div>
                </div>
              ) : (
                <>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
                    {Object.entries(counts).map(([st, count]) => (
                      <span key={st} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, fontWeight: 700, padding: "3px 9px", borderRadius: 5, background: STATUS_CONFIG[st].bg, color: STATUS_CONFIG[st].color, border: `1px solid ${STATUS_CONFIG[st].color}40` }}>
                        <StatusDot status={st} size={6} />
                        {count} {STATUS_CONFIG[st].label}
                      </span>
                    ))}
                  </div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#6c757d", textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 12 }}>Sensor Flags</div>
                  {flaggedSensors.map((s, i) => <SensorStatusRow key={s.id} sensor={s} index={i} />)}
                  {activeSensors.length > 0 && (
                    <>
                      <div style={{ fontSize: 11, fontWeight: 700, color: "#6c757d", textTransform: "uppercase", letterSpacing: ".08em", marginTop: 12, marginBottom: 8 }}>
                        Active ({activeSensors.length})
                      </div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                        {activeSensors.map(s => (
                          <span key={s.id} style={{ fontSize: 11, padding: "3px 8px", borderRadius: 5, background: "#e8fff8", color: "#198754", border: "1px solid #00c9a720", fontWeight: 500 }}>
                            {s.name}
                          </span>
                        ))}
                      </div>
                    </>
                  )}
                </>
              )}
            </div>
            <div style={{ padding: "12px 16px", borderTop: "1px solid #e9ecef", background: "#fff" }}>
              <a href={floor.href}
                style={{ display: "block", textAlign: "center", padding: "10px", borderRadius: 5, background: "#435ebe", color: "#fff", fontWeight: 700, fontSize: 13, textDecoration: "none", cursor: "pointer", transition: "background .15s" }}
                onMouseEnter={e => { e.currentTarget.style.background = "#3347a8"; }}
                onMouseLeave={e => { e.currentTarget.style.background = "#435ebe"; }}>
                Open Full Map →
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}


// ─────────────────────────────────────────────────────────────────────────────
// SECTION 6: SENSOR TABLE COLUMNS
// ─────────────────────────────────────────────────────────────────────────────

const SENSOR_TABLE_COLUMNS = [
  { accessorKey: "floor",  header: "Floor"  },
  { accessorKey: "name",   header: "Sensor" },
  {
    accessorKey: "temp",
    header: "Temp (°C)",
    cell: ({ row }) =>
      row.original.hasData && row.getValue("temp") !== null
        ? row.getValue("temp").toFixed(2)
        : "—",
  },
  {
    accessorKey: "humid",
    header: "Humidity (%)",
    cell: ({ row }) =>
      row.original.hasData && row.getValue("humid") !== null
        ? row.getValue("humid").toFixed(2)
        : "—",
  },
  {
    id: "tempLimits",
    header: "Temp Limits (°C)",
    cell: ({ row }) =>
      row.original.tempLL != null && row.original.tempUL != null
        ? `${row.original.tempLL} – ${row.original.tempUL}`
        : "—",
  },
  {
    id: "humidLimits",
    header: "Humid Limits (%)",
    cell: ({ row }) =>
      row.original.humidLL != null && row.original.humidUL != null
        ? `${row.original.humidLL} – ${row.original.humidUL}`
        : "—",
  },
  {
    id: "status",
    accessorFn: row => getSensorStatus(row),
    header: "Status",
    cell: ({ row }) => {
      const status = getSensorStatus(row.original);
      const cfg    = STATUS_CONFIG[status];
      return (
        <span style={{
          fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 5,
          background: cfg.color, color: "#fff",
          textTransform: "uppercase", letterSpacing: ".04em",
        }}>
          {cfg.label}
        </span>
      );
    },
  },
  {
    accessorKey: "lastSeen",
    header: "Last Seen",
    cell: ({ row }) => row.original.lastSeen ?? "—",
  },
];


// ─────────────────────────────────────────────────────────────────────────────
// SECTION 7: MAIN PAGE
// ─────────────────────────────────────────────────────────────────────────────

export default function MonitoringPage() {
  // If cache exists, start with it so switching back shows data instantly.
  // loading is based on whether any sensor actually has real data yet —
  // not on timing or cache presence. Modal disappears the moment first readings arrive.
  const hasLiveData = (floorList) => floorList.some(f => f.sensors.some(s => s.hasData));
  const [floors,      setFloors]      = useState(floorsCache ?? ALL_FLOORS);
  const [activeFloor, setActiveFloor] = useState(null);
  const [loading,     setLoading]     = useState(!hasLiveData(floorsCache ?? ALL_FLOORS));
  const abortRef                      = useRef(null);

  useEffect(() => {
    const fetchAllFloors = async () => {
      // Cancel any in-flight requests from a previous cycle or navigation
      if (abortRef.current) abortRef.current.abort();
      abortRef.current = new AbortController();
      const signal = abortRef.current.signal;

      try {
        // Fetch sensor statuses first — must complete before building newFloors
        // so the inactive sensor filter has data on the very first load.
        // Resets floorsCache too so both stay in sync.
        if (Object.keys(statusCache).length === 0) {
          const statusResults = await Promise.all(
            ALL_FLOORS.map(floor =>
              axios.get(`${API_BASE}/sensors/status`, {
                params: { floor: FLOOR_SLUG[floor.id] },
                signal,
              }).then(res => res.data.data)
                .catch(() => [])
            )
          );
          statusResults.flat().forEach(d => { statusCache[d.areaId] = d.status; });
          floorsCache = null; // reset so newFloors rebuilds with fresh status filter
        }

        // Fetch all floors in parallel — one request per floor slug
        const results = await Promise.all(
          ALL_FLOORS.map(floor =>
            axios.get(`${API_BASE}/sensors/readings/current`, {
              params: { floor: FLOOR_SLUG[floor.id] },
              signal,
            }).then(res => ({ floorId: floor.id, data: res.data.data }))
              .catch(err => {
                // Ignore abort errors — page was navigated away
                if (axios.isCancel?.(err) || err?.name === "CanceledError") return null;
                return { floorId: floor.id, data: [] };
              })
          )
        );

        // If any request was aborted, bail out — don't update state
        if (results.some(r => r === null)) return;

        // Build a map: floorId → { [areaId]: liveReading }
        const liveByFloor = {};
        results.forEach(({ floorId, data }) => {
          liveByFloor[floorId] = {};
          data.forEach(d => { liveByFloor[floorId][d.areaId] = d; });
        });

        // Merge live data into floor/sensor structure.
        // Inactive sensors (per statusCache) are filtered out entirely.
        const newFloors = ALL_FLOORS.map(floor => ({
          ...floor,
          sensors: floor.sensors
            .filter(sensor => statusCache[sensor.areaId] !== "Inactive") // hide inactive sensors
            .map(sensor => {
              const live = liveByFloor[floor.id]?.[sensor.areaId];
              if (!live) return { ...sensor, hasData: false, breach: false, temp: null, humid: null, lastSeen: null, limits: null };

              // Respect INACTIVE_AREAS — suppress breach for inactive sensors
              const isInactive = INACTIVE_AREAS.has(sensor.areaId);
              const breach = live.status === "breach" && !isInactive;

              return {
                ...sensor,
                temp:     live.temperature,
                humid:    live.humidity,
                hasData:  live.hasData,
                lastSeen: live.lastSeen,
                breach,
                limits:   live.limits,
                tempUL:   live.limits?.tempUL  ?? null,
                tempLL:   live.limits?.tempLL  ?? null,
                humidUL:  live.limits?.humidUL ?? null,
                humidLL:  live.limits?.humidLL ?? null,
              };
            }),
        }));

        // Update cache so next navigation shows this data instantly
        floorsCache = newFloors;
        setFloors(newFloors);

        // Hide loading modal once any sensor has real data
        if (hasLiveData(newFloors)) setLoading(false);

        // If modal is open, keep it in sync with fresh data
        setActiveFloor(prev => {
          if (!prev) return null;
          return newFloors.find(f => f.id === prev.id) ?? prev;
        });

      } catch (err) {
        console.error("Failed to fetch monitoring data:", err);
      }
      // No finally needed — loading state is managed by hasLiveData check
    };

    fetchAllFloors();
    const interval = setInterval(() => fetchAllFloors(), 30_000);

    return () => {
      clearInterval(interval);
      // Cancel any in-flight requests when navigating away
      if (abortRef.current) abortRef.current.abort();
    };
  }, []);

  // Build flat table data from live floors state
  const tableData = floors.flatMap(floor =>
    floor.sensors.map(sensor => ({
      id:       `${floor.id}__${sensor.id}`,
      floor:    floor.label,
      name:     sensor.name,
      temp:     sensor.temp   ?? null,
      humid:    sensor.humid  ?? null,
      hasData:  sensor.hasData ?? false,
      breach:   sensor.breach  ?? false,
      lastSeen: sensor.lastSeen ?? null,
      tempUL:   sensor.tempUL  ?? null,
      tempLL:   sensor.tempLL  ?? null,
      humidUL:  sensor.humidUL ?? null,
      humidLL:  sensor.humidLL ?? null,
    }))
  );

  const breachFloorCount = floors.filter(f => getFloorStatus(f) === "breach").length;

  const handleCardClick = (floor) => {
    // Pass the live floor object (not stale ALL_FLOORS entry)
    const live = floors.find(f => f.id === floor.id) ?? floor;
    setActiveFloor(live);
  };

  return (
    <>
      <style>{GLOBAL_STYLES}</style>

      {/* ── Loading overlay — blocks page on first fetch only ── */}
      {loading && <LoadingOverlay />}

      <div style={{ minHeight: "100vh", overflowX: "hidden" }}>

        {/* ── Page title ── */}
        <div style={{ padding: "14px 24px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div className="bg-background mt-2.5">
            <h1 className="text-2xl font-bold">Monitoring</h1>
            <p className="text-muted-foreground mt-1">
              {loading
                ? "Loading live data…"
                : `Live status across all floors · ${breachFloorCount} floor${breachFloorCount !== 1 ? "s" : ""} in breach`
              }
            </p>
          </div>

          {!loading && floors.some(f => getFloorStatus(f) === "breach") && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, background: "#ffe8e8", border: "1.5px solid #dc3545", borderRadius: 5, padding: "14px 24px", animation: "borderBlink 1.4s ease-in-out infinite" }}>
              <BreachDot />
              <span style={{ fontSize: 13, fontWeight: 700, color: "#dc3545" }}>ALARM ACTIVE</span>
            </div>
          )}
        </div>

        <div style={{ padding: "14px 24px", display: "flex", flexDirection: "column", gap: 28 }}>

          {/* ── Floor grid ── */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 20 }}>
            {floors.map(floor => (
              <FloorCard key={floor.id} floor={floor} onClick={handleCardClick} />
            ))}
          </div>

          {/* ── Activity Log ── */}
          <div style={{ background: "#fff", border: "1px solid #e9ecef", borderRadius: 5, padding: "20px 24px" }}>
            <p className="font-bold mb-4">Activity Log</p>
            {tableData.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center" style={{ padding: "24px 0" }}>No sensor data available.</p>
            ) : (
              <DataTable columns={SENSOR_TABLE_COLUMNS} data={tableData} />
            )}
          </div>

        </div>
      </div>

      {/* ── Floor modal overlay ── */}
      {activeFloor && (
        <FloorModal floor={activeFloor} onClose={() => setActiveFloor(null)} />
      )}
    </>
  );
}