"use client";

// ─────────────────────────────────────────────────────────────────────────────
// IMPORTS
// ─────────────────────────────────────────────────────────────────────────────

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { SensorLimitsModal } from "@/components/custom/CustomModal";


// ─────────────────────────────────────────────────────────────────────────────
// BACKEND TRANSFER REFERENCE
// ─────────────────────────────────────────────────────────────────────────────
//
// Rule of thumb is correct:
//   STAYS IN FRONTEND  → UI state, selection, filtering, sorting, display
//                        derivations, client-side validation (instant feedback)
//   MOVES TO BACKEND   → anything that reads from or writes to the database
//
// ┌─ TRANSFER TO BACKEND ──────────────────────────────────────────────────────
// │
// │  #1  DEFAULT_SENSOR_LIMITS  (hardcoded below)
// │      → GET /api/limits/p1f1/per-sensor
// │      → Returns: { [sensorId]: { tempUL, tempLL, humidUL, humidLL } }
// │      → Called once on page load; seeds the allLimits state
// │
// │  #2  MAP_SENSORS  — only temp / humid / hasData fields
// │      → GET /api/sensor-readings/p1f1/current
// │      → Returns: { id, temp, humid, hasData }[]
// │      → id, name, color, x, y, direction stay hardcoded in the frontend
// │        (they are layout/display config, not live data)
// │      → Poll every ~30s for live updates
// │
// │  #3  DESSICATOR_SENSORS  — only temp / humid / hasData fields
// │      → GET /api/sensor-readings/p1f1/dessicators
// │      → Returns: { id, temp, humid, hasData }[]
// │      → Same polling pattern as #2
// │
// │  #4  handleSave() inside LimitsModal
// │      → POST /api/limits/p1f1/per-sensor
// │      → Body:    { limits: { [sensorId]: { tempUL, tempLL, humidUL, humidLL } } }
// │      → Success: { ok: true }
// │      → Error:   { ok: false, message: string }
// │      → React only updates allLimits state AFTER a confirmed success response
// │      → Backend must also validate (LL < UL, numeric) as the source of truth
// │
// └────────────────────────────────────────────────────────────────────────────
//
// ┌─ STAYS IN FRONTEND ────────────────────────────────────────────────────────
// │
// │  • getSensorLimits()         — local state lookup, no DB touch
// │  • getPaneStatus()           — derives ok/breach/no-data from state
// │  • getPaneDirection()        — UI positioning for popover arrows
// │  • getDessicatorZoneStatus() — aggregates dessicator statuses for badge
// │  • toggle / toggleAll        — checkbox selection state
// │  • validate() in modal       — client-side form check for instant feedback
// │  • STATUS_STYLES             — pure display constants
// │  • ALL_EDITABLE_SENSORS      — sensor list for modal UI, built from metadata
// │  • Sensor metadata           — id, name, color, x, y, direction
// │                                (layout config, owned by frontend)
// │
// └────────────────────────────────────────────────────────────────────────────


// ─────────────────────────────────────────────────────────────────────────────
// SECTION 1: DATA LAYER  (sample data — replace marked items with API calls)
// ─────────────────────────────────────────────────────────────────────────────

const FLOOR_PLAN_IMAGE = "/logo/assets/P1F1-6.png";

// [BACKEND #1] → GET /api/limits/p1f1/per-sensor
const DEFAULT_SENSOR_LIMITS = {
  //             tempUL  tempLL  humidUL  humidLL
  "dipping":     { tempUL: 28, tempLL: 20, humidUL: 60, humidLL: 40 },
  "smt":         { tempUL: 28, tempLL: 22, humidUL: 60, humidLL: 40 },
  "server-room": { tempUL: 28, tempLL: 22, humidUL: 60, humidLL: 40 },
  "aoi":         { tempUL: 28, tempLL: 20, humidUL: 70, humidLL: 40 },
  "smt-mh":      { tempUL: 28, tempLL: 20, humidUL: 70, humidLL: 40 },
  "dipping2":    { tempUL: 28, tempLL: 20, humidUL: 70, humidLL: 40 },
  "dess-2":      { tempUL: 28, tempLL: 20, humidUL: 50, humidLL:  0 },
  "dess-1":      { tempUL: 28, tempLL: 20, humidUL: 50, humidLL:  0 },
  "smt-cs":      { tempUL: 18, tempLL:  0, humidUL: 70, humidLL: -1 },
  "dess-3":      { tempUL: 30, tempLL: 20, humidUL: 50, humidLL:  0 },
  "dess-4":      { tempUL: 28, tempLL: 20, humidUL: 50, humidLL:  0 },
  "dess-5":      { tempUL: 28, tempLL: 20, humidUL: 50, humidLL:  0 },
  "smt-mh-rcv":  { tempUL: 28, tempLL: 22, humidUL: 70, humidLL: 40 },
  "bga-r":       { tempUL: 28, tempLL: 22, humidUL: 70, humidLL: 40 },
  "coating":     { tempUL: 28, tempLL: 22, humidUL: 70, humidLL: 40 },
  "dess-6":      { tempUL: 28, tempLL: 20, humidUL: 50, humidLL:  0 },
};

// Metadata (id, name, color, x, y, direction) → stays in frontend forever.
// [BACKEND #2] temp / humid / hasData → GET /api/sensor-readings/p1f1/current
const MAP_SENSORS = [
  { id: "aoi",         name: "AOI",                color: "#f5c518", x: 78.9,  y: 52.8, direction: "bottom", temp: 24.50, humid: 62.10, hasData: true  },
  { id: "dipping2",    name: "Dipping2",           color: "#1e90ff", x: 53,    y: 48.5,                      temp: 22.40, humid: 60.80, hasData: true  },
  { id: "dipping",     name: "Dipping",            color: "#dc3545", x: 61.6,  y: 48.5, direction: "bottom", temp: null,  humid: null,  hasData: false },
  { id: "server-room", name: "Server Room",        color: "#00c9a7", x: 26.7,  y: 90.2, direction: "top",    temp: 17.70, humid: 54.60, hasData: true  },
  { id: "smt",         name: "SMT",                color: "#fd7e14", x: 80.6,  y: 12.7,                      temp: 25.10, humid: 49.90, hasData: true  },
  { id: "smt-cs",      name: "SMT - Cold Storage", color: "#198754", x: 96.3,  y: 50.8, direction: "left",   temp:  2.25, humid:  0.00, hasData: true  },
  { id: "smt-mh",      name: "SMT MH",             color: "#feaec9", x: 11,    y: 90.1,                      temp: null,  humid: null,  hasData: false },
  { id: "smt-mh-rcv",  name: "SMT MH Receiving",   color: "#6f92be", x: 17.62, y: 51.9, direction: "top",    temp: 23.20, humid: 72.20, hasData: true  },
  { id: "bga-r",       name: "BGA Rework",         color: "#ff00ff", x: 34,    y: 52.3, direction: "bottom", temp: 21.40, humid: 71.30, hasData: true  },
  { id: "coating",     name: "Coating Area",       color: "#ffffff", x: 60.5,  y: 80,                        temp: 21.40, humid: 71.30, hasData: true  },
];

const DESSICATOR_ZONE = { x: 11.5, y: 82 };

// [BACKEND #3] temp / humid / hasData → GET /api/sensor-readings/p1f1/dessicators
const DESSICATOR_SENSORS = [
  { id: "dess-1", name: "SMT MH Dessicator 1", temp: 21.90, humid: 44.40, hasData: true  },
  { id: "dess-2", name: "SMT MH Dessicator 2", temp: 22.20, humid: 52.30, hasData: true  }, // breach: 52.3 > humidUL 50
  { id: "dess-3", name: "SMT MH Dessicator 3", temp: 22.20, humid: 55.70, hasData: true  }, // breach: 55.7 > humidUL 50
  { id: "dess-4", name: "SMT MH Dessicator 4", temp: 21.30, humid: 47.80, hasData: true  },
  { id: "dess-5", name: "SMT MH Dessicator 5", temp: 21.30, humid: 37.50, hasData: true  },
  { id: "dess-6", name: "SMT MH Dessicator 6", temp: null,  humid: null,  hasData: false },
];


// ─────────────────────────────────────────────────────────────────────────────
// SECTION 2: PURE UTILITY FUNCTIONS
// ─────────────────────────────────────────────────────────────────────────────

function getSensorLimits(sensorId, allLimits) {
  return allLimits[sensorId] ?? { tempUL: 28, tempLL: 13, humidUL: 80, humidLL: 40 };
}

function getPaneStatus(sensor, allLimits) {
  if (!sensor.hasData) return "no-data";
  const lim = getSensorLimits(sensor.id, allLimits);
  const tempBreach  = sensor.temp  > lim.tempUL  || sensor.temp  < lim.tempLL;
  const humidBreach = sensor.humid > lim.humidUL || sensor.humid < lim.humidLL;
  if (tempBreach || humidBreach) return "breach";
  return "ok";
}

const STATUS_STYLES = {
  "ok":      { bg: "#e8fff8", text: "#212529", border: "#00c9a7", dot: "#00c9a7" },
  "breach":  { bg: "#ffe8e8", text: "#212529", border: "#dc3545", dot: "#dc3545" },
  "no-data": { bg: "#f0f0f0", text: "#495057", border: "#adb5bd", dot: "#adb5bd" },
};

function getPaneDirection(sensor) {
  if (sensor.direction) return sensor.direction;
  if (sensor.y < 20) return "bottom";
  if (sensor.y > 78) return "top";
  if (sensor.x > 80) return "left";
  if (sensor.x < 20) return "right";
  return "top";
}

function getDessicatorZoneStatus(allLimits) {
  if (DESSICATOR_SENSORS.every((s) => !s.hasData)) return "no-data";
  if (DESSICATOR_SENSORS.some((s) => getPaneStatus(s, allLimits) === "breach")) return "breach";
  return "ok";
}


// ─────────────────────────────────────────────────────────────────────────────
// SECTION 3: LIMITS MODAL  (per-sensor, two-panel layout)
// ─────────────────────────────────────────────────────────────────────────────

const ALL_EDITABLE_SENSORS = [
  ...MAP_SENSORS.map((s)        => ({ id: s.id, name: s.name, group: "Sensors"     })),
  ...DESSICATOR_SENSORS.map((s) => ({ id: s.id, name: s.name, group: "Dessicators" })),
];

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 4: REUSABLE UI COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────

function SensorPane({ sensor, allLimits }) {
  const status = getPaneStatus(sensor, allLimits);
  const style  = STATUS_STYLES[status];
  const lim    = getSensorLimits(sensor.id, allLimits);
  return (
    <div style={{ background: style.bg, border: `2px solid ${style.border}`, borderRadius: 8, padding: "8px 12px", minWidth: 155, color: style.text, boxShadow: "0 4px 12px rgba(0,0,0,.18)", pointerEvents: "none", whiteSpace: "nowrap" }}>
      <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 4 }}>{sensor.name}</div>
      {sensor.hasData ? (
        <>
          <div style={{ fontSize: 12 }}>
            Temp: <strong>{sensor.temp?.toFixed(2)}°C</strong>
            <span style={{ fontSize: 10, color: "#adb5bd", marginLeft: 4 }}>{lim.tempLL}–{lim.tempUL}°C</span>
          </div>
          <div style={{ fontSize: 12 }}>
            Humid: <strong>{sensor.humid?.toFixed(2)}%</strong>
            <span style={{ fontSize: 10, color: "#adb5bd", marginLeft: 4 }}>{lim.humidLL}–{lim.humidUL}%</span>
          </div>
        </>
      ) : (
        <div style={{ fontSize: 12, opacity: .75 }}>No data available</div>
      )}
    </div>
  );
}

function SensorMarker({ sensor, selected, onToggle, allLimits }) {
  const isWhite = sensor.color === "#ffffff";
  const dir     = getPaneDirection(sensor);
  const status  = getPaneStatus(sensor, allLimits);

  const arrowBase = { position: "absolute", width: 0, height: 0, border: "7px solid transparent" };
  const arrowStyle = {
    top:    { ...arrowBase, bottom: -13, left: "50%", transform: "translateX(-50%)", borderTopColor:    STATUS_STYLES[status].border, borderBottom: "none" },
    bottom: { ...arrowBase, top:    -13, left: "50%", transform: "translateX(-50%)", borderBottomColor: STATUS_STYLES[status].border, borderTop:    "none" },
    left:   { ...arrowBase, right:  -13, top:  "50%", transform: "translateY(-50%)", borderLeftColor:   STATUS_STYLES[status].border, borderRight:  "none" },
    right:  { ...arrowBase, left:   -13, top:  "50%", transform: "translateY(-50%)", borderRightColor:  STATUS_STYLES[status].border, borderLeft:   "none" },
  };
  const panePos = {
    top:    { bottom: "calc(100% + 10px)", left: "50%", transform: "translateX(-50%)" },
    bottom: { top:    "calc(100% + 10px)", left: "50%", transform: "translateX(-50%)" },
    left:   { right:  "calc(100% + 10px)", top:  "50%", transform: "translateY(-50%)" },
    right:  { left:   "calc(100% + 10px)", top:  "50%", transform: "translateY(-50%)" },
  };

  return (
    <div onClick={() => onToggle(sensor.id)} style={{ position: "absolute", left: `${sensor.x}%`, top: `${sensor.y}%`, transform: "translate(-50%, -50%)", zIndex: selected ? 20 : 10, cursor: "pointer" }}>
      <div style={{ width: 16, height: 16, background: sensor.color, border: `2px solid ${isWhite ? "#adb5bd" : "rgba(0,0,0,.35)"}`, borderRadius: 3, boxShadow: selected ? "0 0 0 3px rgba(67,94,190,.5)" : "0 1px 4px rgba(0,0,0,.4)", transition: "box-shadow .15s" }} />
      {selected && (
        <div style={{ position: "absolute", zIndex: 30, filter: "drop-shadow(0 4px 8px rgba(0,0,0,.18))", ...panePos[dir] }}>
          <div style={{ position: "relative" }}>
            <div style={arrowStyle[dir]} />
            <SensorPane sensor={sensor} allLimits={allLimits} />
          </div>
        </div>
      )}
    </div>
  );
}

function DessicatorZoneMarker({ open, onToggle, allLimits }) {
  const zoneStatus  = getDessicatorZoneStatus(allLimits);
  const breachCount = DESSICATOR_SENSORS.filter((s) => getPaneStatus(s, allLimits) === "breach").length;
  const dotColor    = STATUS_STYLES[zoneStatus].border;

  return (
    <div onClick={onToggle} style={{ position: "absolute", left: `${DESSICATOR_ZONE.x}%`, top: `${DESSICATOR_ZONE.y}%`, transform: "translate(-50%, -50%)", zIndex: open ? 25 : 15, cursor: "pointer" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 4, background: open ? "#435ebe" : "#fff", border: `2px solid ${open ? "#435ebe" : "#adb5bd"}`, borderRadius: 6, padding: "3px 7px", boxShadow: "0 2px 8px rgba(0,0,0,.2)", whiteSpace: "nowrap", transition: "all .15s" }}>
        <div style={{ width: 7, height: 7, borderRadius: "50%", background: dotColor, flexShrink: 0 }} />
        <span style={{ fontSize: 10, fontWeight: 700, color: open ? "#fff" : "#495057", letterSpacing: ".04em" }}>DESSICATORS</span>
        {breachCount > 0 && (
          <span style={{ fontSize: 9, fontWeight: 700, background: "#dc3545", color: "#fff", borderRadius: 8, padding: "1px 4px", marginLeft: 2 }}>{breachCount}</span>
        )}
      </div>

      {open && (
        <div style={{ position: "absolute", bottom: "calc(100% + -150px)", left: "-32%", transform: "translateY(-50%)", zIndex: 35, background: "#fff", border: "1.5px solid #dee2e6", borderRadius: 10, padding: "10px 12px", boxShadow: "0 6px 20px rgba(0,0,0,.18)", minWidth: 220, pointerEvents: "none" }}>
          <div style={{ position: "absolute", bottom: -8, left: "50%", transform: "translateX(-50%)", width: 0, height: 0, borderLeft: "7px solid transparent", borderRight: "7px solid transparent", borderTop: "8px solid #dee2e6" }} />
          <div style={{ position: "absolute", bottom: -6, left: "50%", transform: "translateX(-50%)", width: 0, height: 0, borderLeft: "6px solid transparent", borderRight: "6px solid transparent", borderTop: "7px solid #fff" }} />
          <div style={{ fontSize: 10, fontWeight: 700, color: "#adb5bd", textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 8 }}>Dessicators</div>
          {DESSICATOR_SENSORS.map((s) => {
            const st  = getPaneStatus(s, allLimits);
            const ss  = STATUS_STYLES[st];
            const lim = getSensorLimits(s.id, allLimits);
            return (
              <div key={s.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "5px 8px", borderRadius: 6, marginBottom: 4, background: ss.bg, border: `1px solid ${ss.border}` }}>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: ss.text }}>{s.name}</div>
                  {s.hasData
                    ? <div style={{ fontSize: 10, color: "#6c757d" }}>{s.temp?.toFixed(1)}°C · {s.humid?.toFixed(1)}% <span style={{ opacity: .6 }}>(H≤{lim.humidUL}%)</span></div>
                    : <div style={{ fontSize: 10, color: "#adb5bd" }}>No data</div>
                  }
                </div>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: ss.dot, flexShrink: 0 }} />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function SensorListItem({ sensor, selected, onToggle, allLimits }) {
  const statusDot = STATUS_STYLES[getPaneStatus(sensor, allLimits)].dot;
  return (
    <div onClick={() => onToggle(sensor.id)} className="flex items-center gap-2 px-3 py-2 rounded-md cursor-pointer" style={{ background: "transparent", userSelect: "none" }}
      onMouseEnter={(e) => { e.currentTarget.style.background = "#f3f4f6"; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
    >
      <div style={{ width: 16, height: 16, flexShrink: 0, border: `2px solid ${selected ? "#435ebe" : "#adb5bd"}`, borderRadius: 3, background: selected ? "#435ebe" : "transparent", display: "flex", alignItems: "center", justifyContent: "center" }}>
        {selected && <span style={{ color: "#fff", fontSize: 9, lineHeight: 1 }}>✓</span>}
      </div>
      <div style={{ width: 14, height: 14, flexShrink: 0, background: sensor.color, border: `1.5px solid ${sensor.color === "#ffffff" ? "#adb5bd" : "rgba(0,0,0,.2)"}`, borderRadius: 2 }} />
      <span style={{ fontSize: 13 }}>{sensor.name}</span>
      <div style={{ marginLeft: "auto", flexShrink: 0 }}>
        <span style={{ width: 8, height: 8, borderRadius: "50%", background: statusDot, display: "block" }} />
      </div>
    </div>
  );
}

function DessicatorCard({ sensor, allLimits }) {
  const status = getPaneStatus(sensor, allLimits);
  const style  = STATUS_STYLES[status];
  return (
    <div style={{ background: style.bg, border: `2px solid ${style.border}`, borderRadius: 8, padding: "8px 12px", color: style.text, minWidth: 170, flex: "0 0 auto", boxShadow: "0 4px 12px rgba(0,0,0,.1)" }}>
      <div style={{ fontWeight: 700, fontSize: 12, marginBottom: 4 }}>{sensor.name}</div>
      {sensor.hasData ? (
        <>
          <div style={{ fontSize: 12 }}>Temp: <strong>{sensor.temp?.toFixed(2)}°C</strong></div>
          <div style={{ fontSize: 12 }}>Humidity: <strong>{sensor.humid?.toFixed(2)}%</strong></div>
        </>
      ) : (
        <div style={{ fontSize: 12, opacity: .75 }}>No data available</div>
      )}
    </div>
  );
}


// ─────────────────────────────────────────────────────────────────────────────
// SECTION 5: MAIN PAGE
// ─────────────────────────────────────────────────────────────────────────────

export default function P1F1MapPage() {
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [dessOpen,    setDessOpen]    = useState(false);
  const [limitsOpen,  setLimitsOpen]  = useState(false);

  /**
   * Live per-sensor limits state — seeded from DEFAULT_SENSOR_LIMITS.
   * TO REPLACE seed value with data fetched from backend.
   */
  const [allLimits, setAllLimits] = useState({ ...DEFAULT_SENSOR_LIMITS });

  const allIds           = MAP_SENSORS.map((s) => s.id);
  const allSelected      = selectedIds.size === allIds.length;
  const totalActiveCount = MAP_SENSORS.filter(s => s.hasData).length;

  const toggle    = (id) => setSelectedIds((prev) => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; });
  const toggleAll = () => setSelectedIds(allSelected ? new Set() : new Set(allIds));

  return (
    <div className="flex gap-0 h-screen overflow-hidden">

      {/* ── LEFT PANEL ── */}
      <aside style={{ width: 260, flexShrink: 0, background: "#fff", borderRight: "1px solid #e9ecef", display: "flex", flexDirection: "column", overflow: "hidden" }}>

        <div style={{ padding: "16px 16px 12px", borderBottom: "1px solid #e9ecef", display: "flex", flexDirection: "column", gap: 8 }}>
          <h1 className="text-2xl font-bold">Line Name</h1>

          {/* Select all button */}
          <Button
            type="button"
            size="default"
            variant={allSelected ? "outline" : "default"}
            className="w-full flex items-center justify-center gap-1.5 font-bold text-sm cursor-pointer"
            onClick={toggleAll}
          >
            {allSelected ? "Deselect All" : "Select All"}
          </Button>

          {/* Adjust Limits button */}
          <Button
            type="button"
            size="default"
            variant={limitsOpen ? "outline" : "default"}
            className="w-full flex items-center justify-center gap-1.5 font-bold text-sm cursor-pointer"
            onClick={() => setLimitsOpen(true)}
          >
            <span>Adjust Limits</span>
          </Button>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "8px" }}>
          <div className="text-sm px-1 pt-2 pb-1">Sensors</div>
          {MAP_SENSORS.map((s) => (
            <SensorListItem key={s.id} sensor={s} selected={selectedIds.has(s.id)} onToggle={toggle} allLimits={allLimits} />
          ))}
        </div>

        <div style={{ padding: "10px 16px", borderTop: "1px solid #e9ecef", display: "flex", flexDirection: "column", gap: 4 }}>
          {[
            { color: STATUS_STYLES["ok"].dot,      label: "Within limits"  },
            { color: STATUS_STYLES["breach"].dot,   label: "Limit breached" },
            { color: STATUS_STYLES["no-data"].dot,  label: "No data"        },
          ].map(({ color, label }) => (
            <div key={label} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "#6c757d" }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: color, flexShrink: 0 }} />
              {label}
            </div>
          ))}
        </div>
      </aside>

      {/* ── RIGHT AREA ── */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "auto", borderRadius: 5 }}>
        <div style={{ padding: "14px 24px" }} className="bg-background">
          <h1 className="text-2xl font-bold">Map View</h1>
          <p className="text-sm text-muted-foreground mt-1">{totalActiveCount} sensor{totalActiveCount !== 1 ? "s" : ""} active · Plant 1 Floor 1</p>
        </div>

        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 12, padding: 20, overflow: "visible", borderRadius: 5 }}>
          <div
            style={{ flex: 1, position: "relative", overflow: "hidden", borderRadius: 5, background: "transparent", border: "1px solid #e9ecef" }}
            onClick={(e) => { if (e.target === e.currentTarget || e.target.tagName === "IMG") setDessOpen(false); }}
          >
            <img src={FLOOR_PLAN_IMAGE} alt="P1F1 Floor Plan" style={{ width: "100%", height: "100%", objectFit: "contain", display: "block", userSelect: "none", pointerEvents: "none" }} />
            {MAP_SENSORS.map((sensor) => (
              <SensorMarker key={sensor.id} sensor={sensor} selected={selectedIds.has(sensor.id)} onToggle={toggle} allLimits={allLimits} />
            ))}
            <DessicatorZoneMarker open={dessOpen} onToggle={() => setDessOpen((v) => !v)} allLimits={allLimits} />
          </div>

          <div style={{ background: "#fff", border: "1px solid #e9ecef", borderRadius: 5, padding: "10px 16px", flexShrink: 0 }}>
            <div className="text-sm mb-2">Dessicators</div>
            <div style={{ display: "flex", gap: 10, overflowX: "auto" }}>
              {DESSICATOR_SENSORS.map((s) => (
                <DessicatorCard key={s.id} sensor={s} allLimits={allLimits} />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── LIMITS MODAL ── */}
      <SensorLimitsModal
        open={limitsOpen}
        onOpenChange={setLimitsOpen}
        allLimits={allLimits}
        onSave={(newLimits) => setAllLimits(newLimits)}
        sensors={ALL_EDITABLE_SENSORS}
      />
    </div>
  );
}
