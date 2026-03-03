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
// Rule of thumb:
//   STAYS IN FRONTEND  → UI state, selection, filtering, sorting, display
//                        derivations, client-side validation (instant feedback)
//   MOVES TO BACKEND   → anything that reads from or writes to the database
//
// ┌─ TRANSFER TO BACKEND ──────────────────────────────────────────────────────
// │
// │  #1  DEFAULT_SENSOR_LIMITS  (hardcoded below)
// │      → GET /api/limits/p2f2/per-sensor
// │      → Returns: { [sensorId]: { tempUL, tempLL, humidUL, humidLL } }
// │      → Called once on page load; seeds the allLimits state
// │
// │  #2  MAP_SENSORS  — only temp / humid / hasData fields
// │      → GET /api/sensor-readings/p2f2/current
// │      → Returns: { id, temp, humid, hasData }[]
// │      → id, name, color, x, y, direction stay hardcoded in the frontend
// │        (they are layout/display config, not live data)
// │      → Poll every ~30s for live updates
// │
// │  #3  handleSave() inside SensorLimitsModal
// │      → POST /api/limits/p2f2/per-sensor
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
// │  • getSensorLimits()    — local state lookup, no DB touch
// │  • getPaneStatus()      — derives ok/breach/no-data from state
// │  • getPaneDirection()   — UI positioning for popover arrows
// │  • toggle / toggleAll   — checkbox selection state
// │  • STATUS_STYLES        — pure display constants
// │  • ALL_EDITABLE_SENSORS — sensor list for modal UI, built from metadata
// │  • Sensor metadata      — id, name, color, x, y, direction
// │                           (layout config, owned by frontend)
// │
// └────────────────────────────────────────────────────────────────────────────


// ─────────────────────────────────────────────────────────────────────────────
// SECTION 1: DATA LAYER  (sample data — replace marked items with API calls)
// ─────────────────────────────────────────────────────────────────────────────

const FLOOR_PLAN_IMAGE = "/logo/assets/P2F2-1.png";

// [BACKEND #1] → GET /api/limits/p2f2/per-sensor
const DEFAULT_SENSOR_LIMITS = {
  //                      tempUL  tempLL  humidUL  humidLL
  "calibration-room": { tempUL: 30, tempLL: 15, humidUL: 85, humidLL: 35 },
  "jcm-assy":         { tempUL: 30, tempLL: 15, humidUL: 85, humidLL: 35 },
  "wh-brother-pkg":   { tempUL: 30, tempLL: 15, humidUL: 85, humidLL: 35 },
  "wh-mh-jcm-assy":   { tempUL: 30, tempLL: 15, humidUL: 85, humidLL: 35 },
  "cis":              { tempUL: 30, tempLL: 15, humidUL: 85, humidLL: 35 },
};

// Metadata (id, name, color, x, y, direction) → stays in frontend forever.
// [BACKEND #2] temp / humid / hasData → GET /api/sensor-readings/p2f2/current
const MAP_SENSORS = [
  { id: "calibration-room", name: "Calibration Room",     color: "#f5c518", x: 35.73, y: 72.7,                       temp: 22.30, humid: 53.70, hasData: true  },
  { id: "jcm-assy",         name: "JCM Assy",             color: "#3d5afe", x: 63.2,  y: 17.6,                       temp: 26.50, humid: 50.40, hasData: true  },
  { id: "wh-brother-pkg",   name: "WH Brother Packaging", color: "#1e90ff", x: 52.8,  y: 9.2,  direction: "left",   temp: 21.70, humid: 57.20, hasData: true  },
  { id: "wh-mh-jcm-assy",   name: "WH-MH JCM Assy",      color: "#dc3545", x: 39.8,  y: 32.32,direction: "top",    temp: null,  humid: null,  hasData: false },
  { id: "cis",              name: "CIS",                  color: "#ffffff", x: 39,    y: 44.45,direction: "left",   temp: 26.00, humid: 54.60, hasData: true  },
];

// No dessicators on P2F2
const DESSICATOR_SENSORS = [];


// ─────────────────────────────────────────────────────────────────────────────
// SECTION 2: PURE UTILITY FUNCTIONS
// ─────────────────────────────────────────────────────────────────────────────

function getSensorLimits(sensorId, allLimits) {
  return allLimits[sensorId] ?? { tempUL: 30, tempLL: 15, humidUL: 85, humidLL: 35 };
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


// ─────────────────────────────────────────────────────────────────────────────
// SECTION 3: LIMITS MODAL
// Handled by SensorLimitsModal in CustomModal.jsx — imported above.
// ─────────────────────────────────────────────────────────────────────────────

const ALL_EDITABLE_SENSORS = [
  ...MAP_SENSORS.map((s) => ({ id: s.id, name: s.name, group: "Sensors" })),
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

function SensorListItem({ sensor, selected, onToggle, allLimits }) {
  const statusDot = STATUS_STYLES[getPaneStatus(sensor, allLimits)].dot;
  return (
    <div
      onClick={() => onToggle(sensor.id)}
      className="flex items-center gap-2 px-3 py-2 rounded-md cursor-pointer"
      style={{ background: "transparent", userSelect: "none" }}
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


// ─────────────────────────────────────────────────────────────────────────────
// SECTION 5: MAIN PAGE
// ─────────────────────────────────────────────────────────────────────────────

export default function P2F2MapPage() {
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [limitsOpen,  setLimitsOpen]  = useState(false);

  // Live per-sensor limits state — seeded from DEFAULT_SENSOR_LIMITS.
  // [BACKEND #1] TO REPLACE: seed with data fetched from backend on page load.
  const [allLimits, setAllLimits] = useState({ ...DEFAULT_SENSOR_LIMITS });

  const allIds           = MAP_SENSORS.map((s) => s.id);
  const allSelected      = selectedIds.size === allIds.length;
  const totalActiveCount = MAP_SENSORS.filter((s) => s.hasData).length;

  const toggle    = (id) => setSelectedIds((prev) => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; });
  const toggleAll = () => setSelectedIds(allSelected ? new Set() : new Set(allIds));

  return (
    <div className="flex gap-0 h-screen overflow-hidden">

      {/* ── LEFT PANEL ── */}
      <aside style={{ width: 260, flexShrink: 0, background: "#fff", borderRight: "1px solid #e9ecef", display: "flex", flexDirection: "column", overflow: "hidden" }}>

        <div style={{ padding: "16px 16px 12px", borderBottom: "1px solid #e9ecef", display: "flex", flexDirection: "column", gap: 8 }}>
          <h1 className="text-2xl font-bold">Line Name</h1>

          {/* Select All button */}
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
            Adjust Limits
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
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "auto" }}>
        <div style={{ padding: "14px 24px" }} className="bg-background">
          <h1 className="text-2xl font-bold">Map View</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {totalActiveCount} sensor{totalActiveCount !== 1 ? "s" : ""} active · Plant 2 Floor 2
          </p>
        </div>

        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 12, padding: 20, overflow: "visible" }}>
          <div style={{ flex: 1, position: "relative", overflow: "hidden", borderRadius: 5, background: "transparent", border: "1px solid #e9ecef" }}>
            <img
              src={FLOOR_PLAN_IMAGE}
              alt="P2F2 Floor Plan"
              style={{ width: "100%", height: "100%", objectFit: "contain", display: "block", userSelect: "none", pointerEvents: "none" }}
            />
            {MAP_SENSORS.map((sensor) => (
              <SensorMarker key={sensor.id} sensor={sensor} selected={selectedIds.has(sensor.id)} onToggle={toggle} allLimits={allLimits} />
            ))}
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