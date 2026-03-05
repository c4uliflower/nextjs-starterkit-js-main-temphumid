"use client";

import { useState, useEffect } from "react";
import { DataTable } from "@/components/custom/DataTable";

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 1: DATA LAYER  ← replace with real API calls
// ─────────────────────────────────────────────────────────────────────────────

const ALL_FLOORS = [
  {
    id: "p1f1",
    label: "P1F1",
    image: "/logo/assets/P1F1-4.jpg",
    href: "/temphumid-p1f1",
    sensors: [
      { id: "aoi",         name: "AOI",                   temp: 24.50, humid: 62.10, hasData: true,  breach: false },
      { id: "dipping2",    name: "Dipping 2",             temp: 22.40, humid: 60.80, hasData: true,  breach: false },
      { id: "dipping",     name: "Dipping",               temp: null,  humid: null,  hasData: false, breach: false },
      { id: "server-room", name: "Server Room",           temp: 17.70, humid: 54.60, hasData: true,  breach: true  },
      { id: "smt",         name: "SMT",                   temp: 25.10, humid: 49.90, hasData: true,  breach: false },
      { id: "smt-cs",      name: "SMT - Cold Storage",    temp: 2.25,  humid: 0.00,  hasData: true,  breach: false },
      { id: "smt-mh",      name: "SMT MH",                temp: null,  humid: null,  hasData: false, breach: false },
      { id: "smt-mh-rcv",  name: "SMT MH Receiving",      temp: 23.20, humid: 72.20, hasData: true,  breach: true  },
      { id: "bga-r",       name: "BGA Rework",            temp: 21.40, humid: 71.30, hasData: true,  breach: true  },
      { id: "coating",     name: "Coating Area",          temp: 21.40, humid: 71.30, hasData: true,  breach: true  },
      { id: "dess-1", name: "SMT MH Dessicator 1", temp: 21.90, humid: 44.40, hasData: true,  breach: false },
      { id: "dess-2", name: "SMT MH Dessicator 2", temp: 22.20, humid: 52.30, hasData: true,  breach: true  },
      { id: "dess-3", name: "SMT MH Dessicator 3", temp: 22.20, humid: 55.70, hasData: true,  breach: true  },
      { id: "dess-4", name: "SMT MH Dessicator 4", temp: 21.30, humid: 47.80, hasData: true,  breach: false },
      { id: "dess-5", name: "SMT MH Dessicator 5", temp: 21.30, humid: 37.50, hasData: true,  breach: false },
      { id: "dess-6", name: "SMT MH Dessicator 6", temp: null,  humid: null,  hasData: false, breach: false },
    ],
  },
  {
    id: "p1f2",
    label: "P1F2",
    image: "/logo/assets/P1F2.png",
    href: "/temphumid-p1f2",
    sensors: [
      { id: "brother-assy-1", name: "Brother Assy 1",       temp: 23.50, humid: 51.30, hasData: true, breach: false },
      { id: "brother-assy-2", name: "Brother Assy 2",       temp: 23.40, humid: 55.70, hasData: true, breach: false },
      { id: "jcm-pcba",       name: "JCM PCBA",             temp: 25.30, humid: 56.50, hasData: true, breach: false },
      { id: "mh-brother-pkg", name: "MH Brother Packaging", temp: 24.20, humid: 48.70, hasData: true, breach: false },
    ],
  },
  {
    id: "p2f1",
    label: "P2F1",
    image: "/logo/assets/P2F1.png",
    href: "/temphumid-p2f1",
    sensors: [
      { id: "fg",               name: "FG",                       temp: 23.10, humid: 58.80, hasData: true, breach: false },
      { id: "warehouse-office", name: "Warehouse Office",         temp: 23.80, humid: 60.90, hasData: true, breach: false },
      { id: "wh-cs",            name: "WH - Cold Storage",        temp: 4.00,  humid: 0.00,  hasData: true, breach: true  },
      { id: "wh-cs2",           name: "WH - Cold Storage 2",      temp: 2.75,  humid: 0.00,  hasData: true, breach: true  },
      { id: "wo-north",         name: "WO-North",                 temp: 24.70, humid: 57.80, hasData: true, breach: false },
      { id: "wo-south-ha",      name: "WO-South Holding Area",    temp: 25.00, humid: 67.90, hasData: true, breach: false },
      { id: "wo-sw-iqc",        name: "WO-S-West-IQC",            temp: 24.00, humid: 63.30, hasData: true, breach: false },
      { id: "wo-w-south-qa",    name: "WO-W South-QA",            temp: 24.30, humid: 60.90, hasData: true, breach: false },
    ],
  },
  {
    id: "p2f2",
    label: "P2F2",
    image: "/logo/assets/P2F2.png",
    href: "/temphumid-p2f2",
    sensors: [
      { id: "calibration-room", name: "Calibration Room",     temp: 22.30, humid: 53.70, hasData: true,  breach: false },
      { id: "jcm-assy",         name: "JCM Assy",             temp: 26.50, humid: 50.40, hasData: true,  breach: false },
      { id: "wh-brother-pkg",   name: "WH Brother Packaging", temp: 21.70, humid: 57.20, hasData: true,  breach: false },
      { id: "wh-mh-jcm-assy",   name: "WH-MH JCM Assy",      temp: null,  humid: null,  hasData: false, breach: false },
      { id: "cis",              name: "CIS",                  temp: 26.00, humid: 54.60, hasData: true,  breach: false },
    ],
  },
  {
    id: "p1and2f2",
    label: "P1&2F2",
    image: "/logo/assets/P1 & P2F2-1.png",
    href: "/temphumid-p1and2f2",
    sensors: [
      { id: "p1p2-bridge", name: "P1P2 Bridge", temp: 25.40, humid: 65.10, hasData: true, breach: false },
    ],
  },
  {
    id: "wh",
    label: "WH",
    image: "/logo/assets/WH.png",
    href: "/temphumid-wh",
    sensors: [
      { id: "wh-a", name: "WH - A", temp: 27.60, humid: 74.60, hasData: true, breach: true  },
      { id: "wh-b", name: "WH - B", temp: 28.60, humid: 62.10, hasData: true, breach: false },
      { id: "wh-c", name: "WH - C", temp: 26.80, humid: 66.70, hasData: true, breach: false },
      { id: "wh-d", name: "WH - D", temp: 28.70, humid: 65.90, hasData: true, breach: false },
      { id: "wh-e", name: "WH - E", temp: 29.80, humid: 61.20, hasData: true, breach: false },
      { id: "wh-f", name: "WH - F", temp: 26.90, humid: 67.10, hasData: true, breach: false },
      { id: "wh-g", name: "WH - G", temp: 28.50, humid: 57.40, hasData: true, breach: false },
      { id: "wh-h", name: "WH - H", temp: 30.00, humid: 59.70, hasData: true, breach: false },
    ],
  },
];

const SENSOR_TABLE_DATA = ALL_FLOORS.flatMap((floor) =>
  floor.sensors.map((sensor) => ({
    id:        `${floor.id}__${sensor.id}`,
    floor:     floor.label,
    floorHref: floor.href,
    name:      sensor.name,
    temp:      sensor.temp,
    humid:     sensor.humid,
    hasData:   sensor.hasData,
    breach:    sensor.breach,
    lastSeen:  sensor.hasData ? "2026-03-05 08:00:00" : "N/A",
    tempLL:    sensor.id.includes("cs") ? -5  : 18,
    tempUL:    sensor.id.includes("cs") ? 10  : 28,
    humidLL:   sensor.id.includes("dess") ? 10 : 40,
    humidUL:   sensor.id.includes("dess") ? 50 : 70,
  }))
);


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
  @keyframes markerPulse {
    0%   { transform: translate(-50%,-50%) scale(1);   opacity: .9; }
    70%  { transform: translate(-50%,-50%) scale(2.8); opacity: 0;  }
    100% { transform: translate(-50%,-50%) scale(1);   opacity: 0;  }
  }
  @keyframes slideIn {
    from { opacity: 0; transform: translateY(12px); }
    to   { opacity: 1; transform: translateY(0);    }
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

const STATUS_PRIORITY = {
  breach:  0,
  no_data: 1,
  active:  2,
};

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
      animation: (status === "breach") ? "dotPulse 1.2s ease-in-out infinite" : "none",
    }} />
  );
}


// ─────────────────────────────────────────────────────────────────────────────
// SECTION 4: FLOOR CARD & MODAL COMPONENTS
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
      onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-3px)"; }}
      onMouseLeave={(e) => { e.currentTarget.style.transform = "translateY(0)"; }}
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
      animation: `slideIn .2s ease both`, animationDelay: `${index * 0.05}s`,
    }}>
      <div onClick={() => setOpen((v) => !v)}
        style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", cursor: "pointer", userSelect: "none" }}>
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
                Temp: <strong>{sensor.temp?.toFixed(2)}°C</strong>
                &nbsp;·&nbsp;
                Humidity: <strong>{sensor.humid?.toFixed(2)}%</strong>
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

  const flaggedSensors = floor.sensors
    .filter(s => getSensorStatus(s) !== "active")
    .sort((a, b) => STATUS_PRIORITY[getSensorStatus(a)] - STATUS_PRIORITY[getSensorStatus(b)]);

  const counts = {};
  for (const s of flaggedSensors) {
    const st = getSensorStatus(s);
    counts[st] = (counts[st] || 0) + 1;
  }

  useEffect(() => {
    const handler = (e) => { if (e.key === "Escape") onClose(); };
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
                  {floor.sensors.filter(s => getSensorStatus(s) === "active").length > 0 && (
                    <>
                      <div style={{ fontSize: 11, fontWeight: 700, color: "#6c757d", textTransform: "uppercase", letterSpacing: ".08em", marginTop: 12, marginBottom: 8 }}>
                        Active ({floor.sensors.filter(s => getSensorStatus(s) === "active").length})
                      </div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                        {floor.sensors.filter(s => getSensorStatus(s) === "active").map(s => (
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
                onMouseEnter={(e) => { e.currentTarget.style.background = "#3347a8"; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "#435ebe"; }}>
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
// SECTION 5: SENSOR TABLE
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
    cell: ({ row }) => `${row.original.tempLL} – ${row.original.tempUL}`,
  },
  {
    id: "humidLimits",
    header: "Humid Limits (%)",
    cell: ({ row }) => `${row.original.humidLL} – ${row.original.humidUL}`,
  },
  {
    id: "status",
    accessorFn: (row) => getSensorStatus(row),
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
  { accessorKey: "lastSeen", header: "Last Seen" },
];


// ─────────────────────────────────────────────────────────────────────────────
// SECTION 6: MAIN PAGE
// ─────────────────────────────────────────────────────────────────────────────

export default function MonitoringPage() {
  const [activeFloor, setActiveFloor] = useState(null);

  return (
    <>
      <style>{GLOBAL_STYLES}</style>

      <div style={{ minHeight: "100vh", overflowX: "hidden" }}>

        {/* ── Page title ── */}
        <div style={{ padding: "25px 30px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div className="bg-background">
            <h1 className="text-2xl font-bold">Monitoring</h1>
            <p className="text-muted-foreground mt-1">
              Live status across all floors · {ALL_FLOORS.filter((f) => getFloorStatus(f) === "breach").length} floor{ALL_FLOORS.filter((f) => getFloorStatus(f) === "breach").length !== 1 ? "s" : ""} in breach
            </p>
          </div>

          {ALL_FLOORS.some((f) => getFloorStatus(f) === "breach") && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, background: "#ffe8e8", border: "1.5px solid #dc3545", borderRadius: 5, padding: "6px 14px", animation: "borderBlink 1.4s ease-in-out infinite" }}>
              <BreachDot />
              <span style={{ fontSize: 13, fontWeight: 700, color: "#dc3545" }}>ALARM ACTIVE</span>
            </div>
          )}
        </div>

        <div style={{ padding: "24px 32px", display: "flex", flexDirection: "column", gap: 28 }}>

          {/* ── Floor grid ── */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 20 }}>
            {ALL_FLOORS.map((floor) => (
              <FloorCard key={floor.id} floor={floor} onClick={setActiveFloor} />
            ))}
          </div>

          {/* ── Activity Log ── */}
          <div style={{ background: "#fff", border: "1px solid #e9ecef", borderRadius: 5, padding: "20px 24px" }}>
            <p className="font-bold mb-4">Activity Log</p>
            {SENSOR_TABLE_DATA.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center" style={{ padding: "24px 0" }}>No sensor data available.</p>
            ) : (
              <DataTable columns={SENSOR_TABLE_COLUMNS} data={SENSOR_TABLE_DATA} />
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