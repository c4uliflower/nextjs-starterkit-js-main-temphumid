"use client";

// ─────────────────────────────────────────────────────────────────────────────
// IMPORTS
// ─────────────────────────────────────────────────────────────────────────────

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { CustomModal } from "@/components/custom/CustomModal";


// ─────────────────────────────────────────────────────────────────────────────
// BACKEND TRANSFER REFERENCE
// ─────────────────────────────────────────────────────────────────────────────
//
// ┌─ TRANSFER TO BACKEND ──────────────────────────────────────────────────────
// │
// │  #1  DEFAULT_SENSOR_LIMITS
// │      → GET /api/limits/p1f1/per-sensor
// │      → Returns: { [sensorId]: { tempUL, tempLL, humidUL, humidLL } }
// │
// │  #2  MAP_SENSORS — only temp / humid / hasData fields
// │      → GET /api/sensor-readings/p1f1/current
// │      → Poll every ~30s
// │
// │  #3  DESSICATOR_SENSORS — only temp / humid / hasData fields
// │      → GET /api/sensor-readings/p1f1/dessicators
// │
// │  #4  handleSaveLimits() — POST /api/limits/p1f1/per-sensor
// │
// │  #5  activeLocation flag
// │      → GET /api/locations/p1f1/active-status
// │      → Returns: { [sensorId]: boolean }
// │      → Currently hardcoded from Excel "Active Location?" column
// │
// └────────────────────────────────────────────────────────────────────────────


// ─────────────────────────────────────────────────────────────────────────────
// SECTION 1: DATA LAYER
// ─────────────────────────────────────────────────────────────────────────────

const FLOOR_PLAN_IMAGE = "/logo/assets/P1F1-6.png";

const DEFAULT_SENSOR_LIMITS = {
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

// ─── activeLocation ────────────────────────────────────────────────────────
// Sourced from the "Active Location?" column in the Excel / DB.
// Area ID → Active Location?
//   P1F1-01 Dipping          → Y
//   P1F1-02 SMT              → Y
//   P1F1-03 Server Room      → Y  (no Area listed, kept Y)
//   P1F1-04 AOI              → Y
//   P1F1-05 SMT MH           → Y
//   P1F1-06 Dipping2         → Y
//   P1F1-07 SMT MH Dess 2    → Y
//   P1F1-09 SMT MH Dess 1    → Y
//   P1F1-10 SMT Cold Storage → Y  (location P1F1C)
//   P1F1-11 SMT MH Dess 3    → Y
//   P1F1-12 SMT MH Dess 4    → Y
//   P1F1-13 SMT MH Dess 5    → Y
//   P1F1-14 SMT MH Receiving → Y
//   P1F1-15 BGA Rework       → Y
//   P1F1-16 CIS              → Y  (no Area — treat as active)
//   P1F1-17 Coating          → Y
// [BACKEND #5] → replace hardcoded values with API response
// ──────────────────────────────────────────────────────────────────────────

const MAP_SENSORS = [
  { id: "aoi",         name: "AOI",                color: "#f5c518", x: 78.9,  y: 52.8, direction: "bottom", temp: 24.50, humid: 62.10, hasData: true,  activeLocation: true  },
  { id: "dipping2",    name: "Dipping2",           color: "#1e90ff", x: 53,    y: 48.5,                      temp: 22.40, humid: 60.80, hasData: true,  activeLocation: true  },
  { id: "dipping",     name: "Dipping",            color: "#dc3545", x: 61.6,  y: 48.5, direction: "bottom", temp: null,  humid: null,  hasData: false, activeLocation: true  },
  { id: "server-room", name: "Server Room",        color: "#00c9a7", x: 26.7,  y: 90.2, direction: "top",    temp: 17.70, humid: 54.60, hasData: true,  activeLocation: true  },
  { id: "smt",         name: "SMT",                color: "#fd7e14", x: 80.6,  y: 12.7,                      temp: 25.10, humid: 49.90, hasData: true,  activeLocation: true  },
  { id: "smt-cs",      name: "SMT - Cold Storage", color: "#198754", x: 96.3,  y: 50.8, direction: "left",   temp:  2.25, humid:  0.00, hasData: true,  activeLocation: true  },
  { id: "smt-mh",      name: "SMT MH",             color: "#feaec9", x: 11,    y: 90.1,                      temp: null,  humid: null,  hasData: false, activeLocation: true  },
  { id: "smt-mh-rcv",  name: "SMT MH Receiving",   color: "#6f92be", x: 17.62, y: 51.9, direction: "top",    temp: 23.20, humid: 72.20, hasData: true,  activeLocation: true  },
  { id: "bga-r",       name: "BGA Rework",         color: "#ff00ff", x: 34,    y: 52.3, direction: "bottom", temp: 21.40, humid: 71.30, hasData: true,  activeLocation: true  },
  { id: "coating",     name: "Coating Area",       color: "#ffffff", x: 60.5,  y: 80,                        temp: 21.40, humid: 71.30, hasData: true,  activeLocation: true  }, // example inactive
];

const DESSICATOR_ZONE = { x: 11.5, y: 82 };

const DESSICATOR_SENSORS = [
  { id: "dess-1", name: "SMT MH Dessicator 1", temp: 21.90, humid: 44.40, hasData: true,  activeLocation: true  },
  { id: "dess-2", name: "SMT MH Dessicator 2", temp: 22.20, humid: 52.30, hasData: true,  activeLocation: true  },
  { id: "dess-3", name: "SMT MH Dessicator 3", temp: 22.20, humid: 55.70, hasData: true,  activeLocation: true  },
  { id: "dess-4", name: "SMT MH Dessicator 4", temp: 21.30, humid: 47.80, hasData: true,  activeLocation: true  },
  { id: "dess-5", name: "SMT MH Dessicator 5", temp: 21.30, humid: 37.50, hasData: true,  activeLocation: true  },
  { id: "dess-6", name: "SMT MH Dessicator 6", temp: null,  humid: null,  hasData: false, activeLocation: true  },
];

const ALL_EDITABLE_SENSORS = [
  ...MAP_SENSORS.map(s        => ({ id: s.id, name: s.name, group: "Sensors"     })),
  ...DESSICATOR_SENSORS.map(s => ({ id: s.id, name: s.name, group: "Dessicators" })),
];


// ─────────────────────────────────────────────────────────────────────────────
// SECTION 2: UTILITY
// ─────────────────────────────────────────────────────────────────────────────

function getSensorLimits(sensorId, allLimits) {
  return allLimits[sensorId] ?? { tempUL: 28, tempLL: 13, humidUL: 80, humidLL: 40 };
}

// ─── getPaneStatus ────────────────────────────────────────────────────────────
// Returns one of four statuses:
//   "ok"              — within limits (active or inactive area)
//   "breach"          — exceeds limits AND area is active   → triggers red/alarm
//   "inactive-breach" — exceeds limits BUT area is inactive → green + badge only
//   "no-data"         — sensor has no reading
// ─────────────────────────────────────────────────────────────────────────────
function getPaneStatus(sensor, allLimits) {
  if (!sensor.hasData) return "no-data";
  const lim = getSensorLimits(sensor.id, allLimits);
  const tempBreach  = sensor.temp  > lim.tempUL  || sensor.temp  < lim.tempLL;
  const humidBreach = sensor.humid > lim.humidUL || sensor.humid < lim.humidLL;
  const isBreaching = tempBreach || humidBreach;

  if (!isBreaching) return "ok";
  return sensor.activeLocation ? "breach" : "inactive-breach";
}

const STATUS_STYLES = {
  "ok":              { bg: "#e8fff8", text: "#212529", border: "#00c9a7", dot: "#00c9a7" },
  "breach":          { bg: "#ffe8e8", text: "#212529", border: "#dc3545", dot: "#dc3545" },
  // inactive-breach: visually green (no alarm) but has a subtle amber border to
  // distinguish it from a truly healthy reading in the pane/card detail view.
  // The dot in the sidebar/legend remains green so it never looks like an alarm.
  "inactive-breach": { bg: "#e8fff8", text: "#212529", border: "#00c9a7", dot: "#00c9a7" },
  "no-data":         { bg: "#f0f0f0", text: "#495057", border: "#adb5bd", dot: "#adb5bd" },
};

// Small pill badge rendered inside the sensor pane when area is inactive + breaching
function InactiveAreaBadge() {
  return (
    <span style={{
      display: "inline-flex",
      alignItems: "center",
      gap: 3,
      fontSize: 8,
      fontWeight: 700,
      letterSpacing: ".04em",
      textTransform: "uppercase",
      background: "#fff8e1",
      color: "#b08000",
      border: "1px solid #ffe082",
      borderRadius: 5,
      padding: "1px 5px",
      verticalAlign: "middle",
      whiteSpace: "nowrap",
    }}>
      Inactive Area
    </span>
  );
}

function getPaneDirection(sensor) {
  if (sensor.direction) return sensor.direction;
  if (sensor.y < 20) return "bottom";
  if (sensor.y > 78) return "top";
  if (sensor.x > 80) return "left";
  if (sensor.x < 20) return "right";
  return "top";
}

function getDessicatorZoneStatus(allLimits) {
  if (DESSICATOR_SENSORS.every(s => !s.hasData)) return "no-data";
  // Only "breach" (active area breach) should make the zone indicator red
  if (DESSICATOR_SENSORS.some(s => getPaneStatus(s, allLimits) === "breach")) return "breach";
  return "ok";
}


// ─────────────────────────────────────────────────────────────────────────────
// SECTION 3: SENSOR LIMITS MODAL CONTENT
// ─────────────────────────────────────────────────────────────────────────────

function SensorLimitsContent({ allLimits, onSave, onClose, sensors }) {
  const [draft,    setDraft]    = useState(() =>
    Object.fromEntries(
      sensors.map(({ id }) => [id, { ...(allLimits[id] ?? { tempUL: 28, tempLL: 13, humidUL: 80, humidLL: 40 }) }])
    )
  );
  const [errors,   setErrors]   = useState({});
  const [activeId, setActiveId] = useState(sensors[0]?.id);
  const [saving,   setSaving]   = useState(false);
  const [apiError, setApiError] = useState(null);

  const setField = (sensorId, key, val) => {
    setDraft(prev => ({ ...prev, [sensorId]: { ...prev[sensorId], [key]: val } }));
    setErrors(prev => { const n = { ...prev }; delete n[`${sensorId}.${key}`]; return n; });
    setApiError(null);
  };

  const validate = () => {
    const e = {}; const parsed = {};
    for (const { id } of sensors) {
      const row = draft[id]; parsed[id] = {};
      for (const key of ["tempUL", "tempLL", "humidUL", "humidLL"]) {
        const num = parseFloat(row?.[key]);
        if (isNaN(num)) { e[`${id}.${key}`] = "Required"; continue; }
        parsed[id][key] = num;
      }
      if (!e[`${id}.tempLL`]  && !e[`${id}.tempUL`]  && parsed[id].tempLL  >= parsed[id].tempUL)  e[`${id}.tempLL`]  = "LL must be < UL";
      if (!e[`${id}.humidLL`] && !e[`${id}.humidUL`] && parsed[id].humidLL >= parsed[id].humidUL) e[`${id}.humidLL`] = "LL must be < UL";
    }
    return { errors: e, parsed };
  };

  const handleSaveLimits = async () => {
    const { errors: e, parsed } = validate();
    if (Object.keys(e).length) { setErrors(e); return; }
    setSaving(true); setApiError(null);
    try {
      await new Promise(r => setTimeout(r, 600));
      onSave(parsed);
      onClose();
    } catch (err) {
      setApiError(err.message ?? "Something went wrong. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const hasRowError = id =>
    ["tempUL", "tempLL", "humidUL", "humidLL"].some(k => errors[`${id}.${k}`]);

  const NumField = ({ sensorId, fieldKey, label, unit }) => {
    const err = errors[`${sensorId}.${fieldKey}`];
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 3, flex: 1 }}>
        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</label>
        <div style={{ position: "relative" }}>
          <input
            type="number"
            value={draft[sensorId]?.[fieldKey] ?? ""}
            onChange={e => setField(sensorId, fieldKey, e.target.value)}
            disabled={saving}
            style={{
              width: "100%", padding: "7px 26px 7px 9px", borderRadius: 6, fontSize: 13,
              border: `1.5px solid ${err ? "#dc3545" : "#dee2e6"}`,
              background: err ? "#fff5f5" : saving ? "#f8f9fa" : "#fff",
              outline: "none", boxSizing: "border-box", opacity: saving ? 0.7 : 1,
            }}
          />
          <span style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", fontSize: 10, color: "#adb5bd", pointerEvents: "none" }}>{unit}</span>
        </div>
        {err && <span className="text-xs text-destructive">{err}</span>}
      </div>
    );
  };

  const activeSensor = sensors.find(s => s.id === activeId);
  const groups = [...new Set(sensors.map(s => s.group))];

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
      <div style={{ padding: "16px 20px 14px", borderBottom: "1px solid #e9ecef", flexShrink: 0 }}>
        <p className="text-base font-semibold">Adjust Sensor Limits</p>
        <p className="text-sm text-muted-foreground mt-0.5">Plant 1 Floor 1 · Each sensor has its own threshold</p>
      </div>

      <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
        <div style={{ width: 180, flexShrink: 0, borderRight: "1px solid #e9ecef", overflowY: "auto", padding: "8px 0" }}>
          {groups.map(group => {
            const list = sensors.filter(s => s.group === group);
            return (
              <div key={group}>
                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-widest" style={{ padding: "10px 16px 4px" }}>
                  {group}
                </div>
                {list.map(({ id, name }) => (
                  <div
                    key={id}
                    onClick={() => !saving && setActiveId(id)}
                    style={{
                      padding: "9px 16px", cursor: saving ? "default" : "pointer",
                      background: id === activeId ? "rgba(67,94,190,.08)" : "transparent",
                      borderLeft: `3px solid ${id === activeId ? "#435ebe" : "transparent"}`,
                      display: "flex", alignItems: "center", justifyContent: "space-between",
                      transition: "background .1s",
                    }}
                    className={`text-sm ${id === activeId ? "font-semibold" : ""}`}
                  >
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}</span>
                    {hasRowError(id) && <span className="text-destructive" style={{ fontSize: 16, marginLeft: 4, lineHeight: 1 }}>•</span>}
                  </div>
                ))}
              </div>
            );
          })}
        </div>

        <div style={{ flex: 1, minWidth: 0, overflowY: "auto", padding: "24px 28px", display: "flex", flexDirection: "column", gap: 24, background: "#fff" }}>
          <p className="text-base font-semibold">{activeSensor?.name}</p>
          <div>
            <p className="text-sm font-medium mb-3">Temperature</p>
            <div style={{ display: "flex", gap: 16 }}>
              <NumField sensorId={activeId} fieldKey="tempLL" label="Lower Limit" unit="°C" />
              <NumField sensorId={activeId} fieldKey="tempUL" label="Upper Limit" unit="°C" />
            </div>
          </div>
          <div>
            <p className="text-sm font-medium mb-3">Humidity</p>
            <div style={{ display: "flex", gap: 16 }}>
              <NumField sensorId={activeId} fieldKey="humidLL" label="Lower Limit" unit="%" />
              <NumField sensorId={activeId} fieldKey="humidUL" label="Upper Limit" unit="%" />
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: "auto" }}>
            {groups.map(group => {
              const list = sensors.filter(s => s.group === group);
              if (!list.find(s => s.id === activeId)) return null;
              return (
                <Button key={group} type="button" size="default" variant="default" className="cursor-pointer" disabled={saving}
                  onClick={() => {
                    const src = draft[activeId];
                    setDraft(prev => {
                      const next = { ...prev };
                      list.forEach(({ id }) => { next[id] = { ...src }; });
                      return next;
                    });
                  }}
                >
                  Apply to all {group.toLowerCase()}
                </Button>
              );
            })}
          </div>
          {apiError && (
            <div style={{ background: "#ffe8e8", border: "1.5px solid #dc3545", borderRadius: 8, padding: "10px 14px" }} className="text-sm text-destructive">
              {apiError}
            </div>
          )}
        </div>
      </div>

      <div style={{ padding: "12px 20px 14px", borderTop: "1px solid #e9ecef", display: "flex", gap: 8, alignItems: "center", justifyContent: "flex-end", flexShrink: 0, background: "#fff" }}>
        {saving && <span className="text-sm text-muted-foreground" style={{ marginRight: "auto" }}>Saving to database…</span>}
        <Button variant="outline" size="default" className="cursor-pointer" onClick={onClose} disabled={saving}>Cancel</Button>
        <Button variant="default" size="default" className="cursor-pointer" onClick={handleSaveLimits} disabled={saving}>
          {saving ? "Saving…" : "Save All"}
        </Button>
      </div>
    </div>
  );
}


// ─────────────────────────────────────────────────────────────────────────────
// SECTION 4: MAP UI COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────

function SensorPane({ sensor, allLimits }) {
  const status = getPaneStatus(sensor, allLimits);
  const style  = STATUS_STYLES[status];
  const lim    = getSensorLimits(sensor.id, allLimits);
  const isInactiveBreach = status === "inactive-breach";

  return (
    <div style={{ background: style.bg, border: `2px solid ${style.border}`, borderRadius: 8, padding: "8px 12px", minWidth: 155, color: style.text, boxShadow: "0 4px 12px rgba(0,0,0,.18)", pointerEvents: "none", whiteSpace: "nowrap" }}>
      <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 4, display: "flex", alignItems: "center", flexWrap: "wrap", gap: 4 }}>
        {sensor.name}
        {isInactiveBreach && <InactiveAreaBadge />}
      </div>
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
        <div style={{ fontSize: 12, opacity: 0.75 }}>No data available</div>
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
    top:    { bottom: "calc(100% + 10px)", left: "50%",  transform: "translateX(-50%)" },
    bottom: { top:    "calc(100% + 10px)", left: "50%",  transform: "translateX(-50%)" },
    left:   { right:  "calc(100% + 10px)", top:  "50%",  transform: "translateY(-50%)" },
    right:  { left:   "calc(100% + 10px)", top:  "50%",  transform: "translateY(-50%)" },
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
  const breachCount = DESSICATOR_SENSORS.filter(s => getPaneStatus(s, allLimits) === "breach").length;
  // inactive-breaches do NOT count toward the red badge — only active breaches do
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
          {DESSICATOR_SENSORS.map(s => {
            const st  = getPaneStatus(s, allLimits);
            const ss  = STATUS_STYLES[st];
            const lim = getSensorLimits(s.id, allLimits);
            const isInactiveBreach = st === "inactive-breach";
            return (
              <div key={s.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "5px 8px", borderRadius: 6, marginBottom: 4, background: ss.bg, border: `1px solid ${ss.border}` }}>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: ss.text, display: "flex", alignItems: "center", gap: 4, flexWrap: "wrap" }}>
                    {s.name}
                    {isInactiveBreach && <InactiveAreaBadge />}
                  </div>
                  {s.hasData
                    ? <div style={{ fontSize: 10, color: "#6c757d" }}>{s.temp?.toFixed(1)}°C · {s.humid?.toFixed(1)}% <span style={{ opacity: 0.6 }}>(H≤{lim.humidUL}%)</span></div>
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
  const status    = getPaneStatus(sensor, allLimits);
  const statusDot = STATUS_STYLES[status].dot;
  return (
    <div
      onClick={() => onToggle(sensor.id)}
      className="flex items-center gap-2 px-3 py-2 rounded-md cursor-pointer"
      style={{ background: "transparent", userSelect: "none" }}
      onMouseEnter={e => { e.currentTarget.style.background = "#f3f4f6"; }}
      onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
    >
      <div style={{ width: 16, height: 16, flexShrink: 0, border: `2px solid ${selected ? "#435ebe" : "#adb5bd"}`, borderRadius: 3, background: selected ? "#435ebe" : "transparent", display: "flex", alignItems: "center", justifyContent: "center" }}>
        {selected && <span style={{ color: "#fff", fontSize: 9, lineHeight: 1 }}>✓</span>}
      </div>
      <div style={{ width: 14, height: 14, flexShrink: 0, background: sensor.color, border: `1.5px solid ${sensor.color === "#ffffff" ? "#adb5bd" : "rgba(0,0,0,.2)"}`, borderRadius: 2 }} />
      <span style={{ fontSize: 13 }}>{sensor.name}</span>
      <div style={{ marginLeft: "auto", flexShrink: 0, display: "flex", alignItems: "center", gap: 4 }}>
        {/* Show a small ⏸ pause icon in the list if area is inactive, regardless of breach state */}
        {!sensor.activeLocation && <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#b08000", display: "block" }} title="Inactive area — alarms suppressed" />}
        <span style={{ width: 8, height: 8, borderRadius: "50%", background: statusDot, display: "block" }} />
      </div>
    </div>
  );
}

function DessicatorCard({ sensor, allLimits }) {
  const status = getPaneStatus(sensor, allLimits);
  const style  = STATUS_STYLES[status];
  const isInactiveBreach = status === "inactive-breach";
  return (
    <div style={{ background: style.bg, border: `2px solid ${style.border}`, borderRadius: 8, padding: "8px 12px", color: style.text, minWidth: 170, flex: "0 0 auto", boxShadow: "0 4px 12px rgba(0,0,0,.1)" }}>
      <div style={{ fontWeight: 700, fontSize: 12, marginBottom: 4, display: "flex", alignItems: "center", flexWrap: "wrap", gap: 4 }}>
        {sensor.name}
        {isInactiveBreach && <InactiveAreaBadge />}
      </div>
      {sensor.hasData ? (
        <>
          <div style={{ fontSize: 12 }}>Temp: <strong>{sensor.temp?.toFixed(2)}°C</strong></div>
          <div style={{ fontSize: 12 }}>Humidity: <strong>{sensor.humid?.toFixed(2)}%</strong></div>
        </>
      ) : (
        <div style={{ fontSize: 12, opacity: 0.75 }}>No data available</div>
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

  const [allLimits, setAllLimits] = useState({ ...DEFAULT_SENSOR_LIMITS });

  const allIds           = MAP_SENSORS.map(s => s.id);
  const allSelected      = selectedIds.size === allIds.length;
  const totalActiveCount = MAP_SENSORS.filter(s => s.hasData).length;

  const toggle    = id => setSelectedIds(prev => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; });
  const toggleAll = () => setSelectedIds(allSelected ? new Set() : new Set(allIds));

  return (
    <div className="flex gap-0 h-screen overflow-hidden">

      {/* ── LEFT PANEL ── */}
      <aside style={{ width: 260, flexShrink: 0, background: "#fff", borderRight: "1px solid #e9ecef", display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <div style={{ padding: "16px 16px 12px", borderBottom: "1px solid #e9ecef", display: "flex", flexDirection: "column", gap: 8 }}>
          <h1 className="text-2xl font-bold">Line Name</h1>
          <Button type="button" size="default" variant={allSelected ? "outline" : "default"} className="w-full flex items-center justify-center gap-1.5 font-bold text-sm cursor-pointer" onClick={toggleAll}>
            {allSelected ? "Deselect All" : "Select All"}
          </Button>
          <Button type="button" size="default" variant={limitsOpen ? "outline" : "default"} className="w-full flex items-center justify-center gap-1.5 font-bold text-sm cursor-pointer" onClick={() => setLimitsOpen(true)}>
            Adjust Sensor Limits
          </Button>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "8px" }}>
          <div className="text-sm px-1 pt-2 pb-1">Sensors</div>
          {MAP_SENSORS.map(s => (
            <SensorListItem key={s.id} sensor={s} selected={selectedIds.has(s.id)} onToggle={toggle} allLimits={allLimits} />
          ))}
        </div>

        {/* ── LEGEND ── */}
        <div style={{ padding: "10px 16px", borderTop: "1px solid #e9ecef", display: "flex", flexDirection: "column", gap: 4 }}>
          {[
            { color: STATUS_STYLES["ok"].dot,      label: "Within limits"              },
            { color: STATUS_STYLES["breach"].dot,   label: "Limit breached"             },
            { color: STATUS_STYLES["no-data"].dot,  label: "No data"                    },
            // inactive-breach uses same green dot — explained by the ⏸ text instead
            { color: null,                          label: "Inactive area", isText: true },
          ].map(({ color, label, isText }) => (
            <div key={label} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "#6c757d" }}>
              {isText
                ? <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#b08000", display: "block", flexShrink: 0 }} />
                : <div style={{ width: 8, height: 8, borderRadius: "50%", background: color, flexShrink: 0 }} />
              }
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
            onClick={e => { if (e.target === e.currentTarget || e.target.tagName === "IMG") setDessOpen(false); }}
          >
            <img src={FLOOR_PLAN_IMAGE} alt="P1F1 Floor Plan" style={{ width: "100%", height: "100%", objectFit: "contain", display: "block", userSelect: "none", pointerEvents: "none" }} />
            {MAP_SENSORS.map(sensor => (
              <SensorMarker key={sensor.id} sensor={sensor} selected={selectedIds.has(sensor.id)} onToggle={toggle} allLimits={allLimits} />
            ))}
            <DessicatorZoneMarker open={dessOpen} onToggle={() => setDessOpen(v => !v)} allLimits={allLimits} />
          </div>

          <div style={{ background: "#fff", border: "1px solid #e9ecef", borderRadius: 5, padding: "10px 16px", flexShrink: 0 }}>
            <div className="text-sm mb-2">Dessicators</div>
            <div style={{ display: "flex", gap: 10, overflowX: "auto" }}>
              {DESSICATOR_SENSORS.map(s => (
                <DessicatorCard key={s.id} sensor={s} allLimits={allLimits} />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── SENSOR LIMITS MODAL ── */}
      <CustomModal
        open={limitsOpen}
        onOpenChange={open => { if (!open) setLimitsOpen(false); }}
        title="Adjust Sensor Limits"
        size="lg"
        fixedLayout
      >
        <SensorLimitsContent
          allLimits={allLimits}
          onSave={newLimits => setAllLimits(newLimits)}
          onClose={() => setLimitsOpen(false)}
          sensors={ALL_EDITABLE_SENSORS}
        />
      </CustomModal>

    </div>
  );
}