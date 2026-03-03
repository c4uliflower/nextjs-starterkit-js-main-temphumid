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

const FLOOR_PLAN_IMAGE = "/logo/assets/WH.png";

// [BACKEND #1] → GET /api/limits/wh/per-sensor
const DEFAULT_SENSOR_LIMITS = {
  //                      tempUL  tempLL  humidUL  humidLL
  "wh-a": { tempUL: 40, tempLL: 5, humidUL: 70, humidLL: 20 },
  "wh-b": { tempUL: 40, tempLL: 5, humidUL: 70, humidLL: 20 },
  "wh-c": { tempUL: 40, tempLL: 5, humidUL: 70, humidLL: 20 },
  "wh-d": { tempUL: 40, tempLL: 5, humidUL: 70, humidLL: 20 },
  "wh-e": { tempUL: 40, tempLL: 5, humidUL: 70, humidLL: 20 },
  "wh-f": { tempUL: 40, tempLL: 5, humidUL: 70, humidLL: 20 },
  "wh-g": { tempUL: 40, tempLL: 5, humidUL: 70, humidLL: 20 },
  "wh-h": { tempUL: 40, tempLL: 5, humidUL: 70, humidLL: 20 },
};

// Metadata (id, name, color, x, y, direction) → stays in frontend forever.
// [BACKEND #2] temp / humid / hasData → GET /api/sensor-readings/wh/current
const MAP_SENSORS = [
  { id: "wh-a", name: "WH - A", color: "#fd7e14", x: 43,   y: 20,  temp: 27.60, humid: 74.60, hasData: true },
  { id: "wh-b", name: "WH - B", color: "#fd7e14", x: 80.8, y: 15,  temp: 28.60, humid: 62.10, hasData: true },
  { id: "wh-c", name: "WH - C", color: "#fd7e14", x: 74,   y: 46,  temp: 26.80, humid: 66.70, direction: "right",  hasData: true },
  { id: "wh-d", name: "WH - D", color: "#fd7e14", x: 44.5, y: 46,  temp: 28.70, humid: 65.90, direction: "left",   hasData: true },
  { id: "wh-e", name: "WH - E", color: "#fd7e14", x: 57.5, y: 45,  temp: 29.80, humid: 61.20, hasData: true },
  { id: "wh-f", name: "WH - F", color: "#fd7e14", x: 57.5, y: 45,  temp: 26.90, humid: 67.10, direction: "right",  hasData: true },
  { id: "wh-g", name: "WH - G", color: "#fd7e14", x: 57.5, y: 45,  temp: 28.50, humid: 57.40, direction: "bottom", hasData: true },
  { id: "wh-h", name: "WH - H", color: "#fd7e14", x: 75,   y: 72,  temp: 30,    humid: 59.70, hasData: true },
];

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

export default function WHMapPage() {
// Live per-sensor limits state — seeded from DEFAULT_SENSOR_LIMITS.
// [BACKEND #1] TO REPLACE: seed with data fetched from backend on page load.
  const [allLimits, setAllLimits] = useState({ ...DEFAULT_SENSOR_LIMITS });
  const [limitsOpen, setLimitsOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const allIds      = [...MAP_SENSORS.map((s) => s.id), ...DESSICATOR_SENSORS.map((s) => s.id)];
  const allSelected = selectedIds.size === allIds.length;
  const totalActiveCount = MAP_SENSORS.filter(s => s.hasData).length;

  const toggle = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleAll = () => setSelectedIds(allSelected ? new Set() : new Set(allIds));
  const hasDessicators = DESSICATOR_SENSORS.length > 0;

  return (
    <div className="flex gap-0 h-screen overflow-hidden">
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
          <div className="text-sm font-semibold px-1 pt-2 pb-1">Sensors</div>
          {MAP_SENSORS.map((s) => (<SensorListItem key={s.id} sensor={s} selected={selectedIds.has(s.id)} onToggle={toggle} allLimits={allLimits} />))}
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

      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", borderRadius: 5 }}>
        <div style={{ padding: "14px 24px" }} className="bg-background">
          <h1 className="text-2xl font-bold">Map View</h1>
          <p className="text-sm text-muted-foreground mt-1">{totalActiveCount} sensor{totalActiveCount !== 1 ? "s" : ""} active · Warehouse</p>
        </div>

        <div style={{ flex: 1, display: "flex", gap: 16, padding: 20, overflow: "hidden" }}>
          <div style={{ flex: 1, position: "relative", overflow: "visible", borderRadius: 5, background: "#fff", border: "1px solid #e9ecef" }}>
            <img src={FLOOR_PLAN_IMAGE} alt="P1&2F2 Floor Plan" style={{ width: "100%", height: "100%", objectFit: "contain", display: "block", userSelect: "none", pointerEvents: "none", borderRadius: 10 }} />
            {MAP_SENSORS.map((sensor) => <SensorMarker key={sensor.id} sensor={sensor} selected={selectedIds.has(sensor.id)} onToggle={toggle} allLimits={allLimits} /> )} 
            </div>

          {hasDessicators && (
            <div style={{ width: 220, flexShrink: 0, display: "flex", flexDirection: "column", gap: 8, overflowY: "auto" }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#6c757d", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 4 }}>Dessicators</div>
              {DESSICATOR_SENSORS.map((s) => (
                <div key={s.id} onClick={() => toggle(s.id)} style={{ cursor: "pointer" }}>
                  <DessicatorCard sensor={s} selected={selectedIds.has(s.id)} />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
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