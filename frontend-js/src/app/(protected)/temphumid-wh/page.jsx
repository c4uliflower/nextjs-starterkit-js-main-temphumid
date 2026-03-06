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

// Metadata (id, name, color, x, y, direction) → stays in frontend forever.
// [BACKEND #2] temp / humid / hasData → GET /api/sensor-readings/wh/current
const MAP_SENSORS = [
  { id: "wh-a", name: "WH - A", color: "#fd7e14", x: 43,   y: 20,  temp: 27.60, humid: 74.60,                      hasData: true,  activeLocation: true  },
  { id: "wh-b", name: "WH - B", color: "#fd7e14", x: 80.8, y: 15,  temp: 28.60, humid: 62.10,                      hasData: true,  activeLocation: true  },
  { id: "wh-c", name: "WH - C", color: "#fd7e14", x: 74,   y: 46,  temp: 26.80, humid: 66.70, direction: "right",  hasData: true,  activeLocation: true  },
  { id: "wh-d", name: "WH - D", color: "#fd7e14", x: 44.5, y: 46,  temp: 28.70, humid: 65.90, direction: "left",   hasData: true,  activeLocation: true  },
  { id: "wh-e", name: "WH - E", color: "#fd7e14", x: 57.5, y: 45,  temp: 29.80, humid: 61.20,                      hasData: true,  activeLocation: true  },
  { id: "wh-f", name: "WH - F", color: "#fd7e14", x: 57.5, y: 45,  temp: 26.90, humid: 67.10, direction: "right",  hasData: true,  activeLocation: true  },
  { id: "wh-g", name: "WH - G", color: "#fd7e14", x: 57.5, y: 45,  temp: 28.50, humid: 57.40, direction: "bottom", hasData: true,  activeLocation: true  },
  { id: "wh-h", name: "WH - H", color: "#fd7e14", x: 75,   y: 72,  temp: 30,    humid: 59.70,                      hasData: true,  activeLocation: true  },
];

// No dessicators on P12F2
const DESSICATOR_SENSORS = [];

// Sensor list passed to SensorLimitsContent — built from page metadata
const ALL_EDITABLE_SENSORS = [
  ...MAP_SENSORS.map(s        => ({ id: s.id, name: s.name, group: "Sensors"     })),
  ...DESSICATOR_SENSORS.map(s => ({ id: s.id, name: s.name, group: "Dessicators" })),
];


// ─────────────────────────────────────────────────────────────────────────────
// SECTION 2: PURE UTILITY FUNCTIONS
// ─────────────────────────────────────────────────────────────────────────────

function getSensorLimits(sensorId, allLimits) {
  return allLimits[sensorId] ?? { tempUL: 30, tempLL: 15, humidUL: 85, humidLL: 35 };
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

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 3: SENSOR LIMITS MODAL CONTENT
//
// WHAT MOVED HERE (was inside SensorLimitsModal in CustomModal.jsx):
//   • draft state       — in-progress edits for all sensors
//   • errors state      — per-field validation errors
//   • activeId state    — which sensor is selected in the left panel
//   • saving state      — tracks POST request lifecycle
//   • apiError state    — surfaces server-side errors
//   • setField()        — updates draft + clears field error
//   • validate()        — client-side LL < UL check
//   • handleSaveLimits()— validates → POST → onSave() → onClose()
//   • hasRowError()     — checks if a row has any validation error
//   • NumField          — number input with unit label + error display
//   • The full two-panel JSX (left sensor list + right edit panel + footer)
//
// WHY it lives here and not in CustomModal:
//   CustomModal is a reusable shell — it should not know about sensor IDs,
//   limit fields, or floor-specific API endpoints. Keeping this content here
//   means you can have different limit modals per floor with different sensors,
//   limits, and API endpoints, all using the same CustomModal wrapper.
//
// Props:
//   allLimits  — { [sensorId]: { tempUL, tempLL, humidUL, humidLL } }
//   onSave     — (newLimits) => void — called only after confirmed save
//   onClose    — () => void — closes the modal
//   sensors    — ALL_EDITABLE_SENSORS from this page
// ─────────────────────────────────────────────────────────────────────────────

function SensorLimitsContent({ allLimits, onSave, onClose, sensors }) {
  const [draft, setDraft] = useState(() =>
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

  // Client-side validation — instant feedback only.
  // Backend must also validate as the source of truth.
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

  // [BACKEND #4] → POST /api/limits/wh/per-sensor
  const handleSaveLimits = async () => {
    const { errors: e, parsed } = validate();
    if (Object.keys(e).length) { setErrors(e); return; }
    setSaving(true); setApiError(null);
    try {
      // ── [BACKEND] uncomment + remove setTimeout when backend is ready ─────
      // const res  = await fetch("/api/limits/wh/per-sensor", {
      //   method:  "POST",
      //   headers: { "Content-Type": "application/json" },
      //   body:    JSON.stringify({ limits: parsed }),
      // });
      // const json = await res.json();
      // if (!res.ok || !json.ok) throw new Error(json.message ?? "Save failed");
      await new Promise(r => setTimeout(r, 600)); // temp stub
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

  // Number input with unit label + inline error
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

  // This content is rendered inside <CustomModal className="p-0 gap-0 overflow-hidden flex flex-col" style={{ height: "80vh" }}>.
  // That className strips CustomModal's default padding so this two-panel layout
  // can control every pixel — pinned header, scrollable left/right panels, pinned footer.
  // minHeight:0 on the body row is critical: without it, flex children default to
  // min-height:auto and push the footer outside the modal box.
  return (
    // Outer wrapper fills the full DialogContent box (flex column, height:80vh)
    // Three children: header (shrink:0), body (flex:1 min-h:0), footer (shrink:0)
    <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>

      {/* ── PINNED HEADER ── */}
      <div style={{ padding: "16px 20px 14px", borderBottom: "1px solid #e9ecef", flexShrink: 0 }}>
        <p className="text-base font-semibold">Adjust Sensor Limits</p>
        <p className="text-sm text-muted-foreground mt-0.5">Warehouse · Each sensor has its own threshold</p>
      </div>

      {/* ── SCROLLABLE TWO-PANEL BODY ── */}
      {/* minHeight:0 is the critical rule — without it flex children won't shrink
          below their content size, so the footer gets pushed out of the box     */}
      <div style={{ display: "flex", flex: 1, minHeight: 0 }}>

        {/* Left — sensor list, scrolls independently */}
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

        {/* Right — edit panel, scrolls independently */}
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

          {/* Quick apply — copies active sensor limits to all in the same group */}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: "auto" }}>
            {groups.map(group => {
              const list = sensors.filter(s => s.group === group);
              if (!list.find(s => s.id === activeId)) return null;
              return (
                <Button
                  key={group}
                  type="button"
                  size="default"
                  variant="default"
                  className="cursor-pointer"
                  disabled={saving}
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

      {/* ── PINNED FOOTER ── */}
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
// SECTION 4: REUSABLE UI COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────

function SensorPane({ sensor, allLimits }) {
  const status = getPaneStatus(sensor, allLimits);
  const style  = STATUS_STYLES[status];
  const lim    = getSensorLimits(sensor.id, allLimits);
  const isInactiveBreach = !sensor.activeLocation;
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
  const status    = getPaneStatus(sensor, allLimits);
  const statusDot = STATUS_STYLES[status].dot;
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
      <div style={{ marginLeft: "auto", flexShrink: 0, display: "flex", alignItems: "center", gap: 4 }}>
        {!sensor.activeLocation && <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#b08000", display: "block" }} title="Inactive area — alarms suppressed" />}
        <span style={{ width: 8, height: 8, borderRadius: "50%", background: statusDot, display: "block" }} />
      </div>
    </div>
  );
}


// ─────────────────────────────────────────────────────────────────────────────
// SECTION 5: MAIN PAGE
// ─────────────────────────────────────────────────────────────────────────────

export default function WHMapPage() {
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
            Adjust Sensor Limits
          </Button>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "8px" }}>
          <div className="text-sm font-semibold px-1 pt-2 pb-1">Sensors</div>
          {MAP_SENSORS.map((s) => (
            <SensorListItem key={s.id} sensor={s} selected={selectedIds.has(s.id)} onToggle={toggle} allLimits={allLimits} />
          ))}
        </div>

        <div style={{ padding: "10px 16px", borderTop: "1px solid #e9ecef", display: "flex", flexDirection: "column", gap: 4 }}>
          {[
            { color: STATUS_STYLES["ok"].dot,      label: "Within limits"              },
            { color: STATUS_STYLES["breach"].dot,   label: "Limit breached"             },
            { color: STATUS_STYLES["no-data"].dot,  label: "No data"                    },
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
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", borderRadius: 5 }}>
        <div style={{ padding: "14px 24px" }} className="bg-background">
          <h1 className="text-2xl font-bold">Map View</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {totalActiveCount} sensor{totalActiveCount !== 1 ? "s" : ""} active · Warehouse
          </p>
        </div>

        <div style={{ flex: 1, display: "flex", gap: 16, padding: 20, overflow: "hidden" }}>
          <div style={{ flex: 1, position: "relative", overflow: "visible", borderRadius: 5, background: "#fff", border: "1px solid #e9ecef" }}>
            <img
              src={FLOOR_PLAN_IMAGE}
              alt="Warehouse Floor Plan"
              style={{ width: "100%", height: "100%", objectFit: "contain", display: "block", userSelect: "none", pointerEvents: "none" }}
            />
            {MAP_SENSORS.map((sensor) => (
              <SensorMarker key={sensor.id} sensor={sensor} selected={selectedIds.has(sensor.id)} onToggle={toggle} allLimits={allLimits} />
            ))}
          </div>
        </div>
      </div>

      {/* ── SENSOR LIMITS MODAL ── */}
      {/*
        size="xl" gives us sm:max-w-4xl width.
        className overrides pad/gap to zero and forces fixed height so the
        two-panel layout inside SensorLimitsContent works correctly.
        The content component handles its own header text, scrollable panels,
        and pinned footer — CustomModal only provides the Dialog shell.
      */}
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