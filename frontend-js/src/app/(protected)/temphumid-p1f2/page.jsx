"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import axios from "@/lib/axios";
import { CustomModal } from "@/components/custom/CustomModal";

const API_BASE = '/api/temphumid';
// Module-level cache — persists across page navigations
let mapSensorsCache = null;
let limitsCache     = {};  // persists fetched limits across modal opens


// ─────────────────────────────────────────────────────────────────────────────
// SECTION 1: DATA LAYER
// ─────────────────────────────────────────────────────────────────────────────

const FLOOR_PLAN_IMAGE = "/logo/assets/P1F2-1.png";
const INACTIVE_AREAS   = new Set([]);


const MAP_SENSORS = [
  { id: "brother-assy-1", areaId: "P1F2-03", name: "Brother Assy 1",       color: "#ffb6c1", x: 73.1,  y: 53.5, direction: "bottom", },
  { id: "brother-assy-2", areaId: "P1F2-02", name: "Brother Assy 2",       color: "#00bcd4", x: 57.7,  y: 48.6,                      },
  { id: "jcm-pcba",       areaId: "P1F2-01", name: "JCM PCBA",             color: "#3d5afe", x: 38.75, y: 41.7,                      },
  { id: "mh-brother-pkg", areaId: "P1F2-05", name: "MH Brother Packaging", color: "#198754", x: 95.35, y: 50.3, direction: "left",   },
];

const ALL_EDITABLE_SENSORS = [
  ...MAP_SENSORS.map(s => ({ id: s.id, name: s.name, group: "Sensors" })),
];


// ─────────────────────────────────────────────────────────────────────────────
// SECTION 2: UTILITY
// ─────────────────────────────────────────────────────────────────────────────

function getPaneStatus(sensor) { return sensor.status ?? "no-data"; }

const STATUS_STYLES = {
  "ok":              { bg: "#e8fff8", text: "#212529", border: "#00c9a7", dot: "#00c9a7" },
  "breach":          { bg: "#ffe8e8", text: "#212529", border: "#dc3545", dot: "#dc3545" },
  "inactive-breach": { bg: "#e8fff8", text: "#212529", border: "#00c9a7", dot: "#00c9a7" },
  "no-data":         { bg: "#f0f0f0", text: "#495057", border: "#adb5bd", dot: "#adb5bd" },
};

function InactiveAreaBadge() {
  return <span style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: 8, fontWeight: 700, letterSpacing: ".04em", textTransform: "uppercase", background: "#fff8e1", color: "#000", border: "1px solid #ffe082", borderRadius: 5, padding: "1px 5px", verticalAlign: "middle", whiteSpace: "nowrap" }}>Inactive Area</span>;
}

function getPaneDirection(sensor) {
  if (sensor.direction) return sensor.direction;
  if (sensor.y < 20) return "bottom"; if (sensor.y > 78) return "top";
  if (sensor.x > 80) return "left";  if (sensor.x < 20) return "right";
  return "top";
}

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
// SECTION 3: SENSOR LIMITS MODAL CONTENT
// ─────────────────────────────────────────────────────────────────────────────

const NumField = ({ sensorId, fieldKey, label, unit, draft, errors, onSetField, saving }) => {
  const err = errors[`${sensorId}.${fieldKey}`];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 3, flex: 1 }}>
      <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</label>
      <div style={{ position: "relative" }}>
        <input type="number" value={draft[sensorId]?.[fieldKey] ?? ""} onChange={e => onSetField(sensorId, fieldKey, e.target.value)} disabled={saving}
          style={{ width: "100%", padding: "7px 26px 7px 9px", borderRadius: 6, fontSize: 13, border: `1.5px solid ${err ? "#dc3545" : "#dee2e6"}`, background: err ? "#fff5f5" : saving ? "#f8f9fa" : "#fff", outline: "none", boxSizing: "border-box", opacity: saving ? 0.7 : 1 }} />
        <span style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", fontSize: 10, color: "#adb5bd", pointerEvents: "none" }}>{unit}</span>
      </div>
      {err && <span className="text-xs text-destructive">{err}</span>}
    </div>
  );
};

function SensorLimitsContent({ allLimits, onSave, onClose, sensors }) {
  const [draft,    setDraft]    = useState(() => ({ ...limitsCache }));
  const [loading,  setLoading]  = useState(false);
  const [errors,   setErrors]   = useState({});
  const [activeId, setActiveId] = useState(sensors[0]?.id);
  const [saving,   setSaving]   = useState(false);
  const [apiError, setApiError] = useState(null);

  const originalRef = useRef(JSON.parse(JSON.stringify(limitsCache)));

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

  const getChangedIds = (parsed) =>
    Object.keys(parsed).filter(id => {
      const orig = originalRef.current[id];
      const curr = parsed[id];
      if (!orig || !curr) return false;
      return ["tempUL", "tempLL", "humidUL", "humidLL"].some(
        k => parseFloat(orig[k]) !== parseFloat(curr[k])
      );
    });

  const isChanged = (id) => {
    const orig = originalRef.current[id];
    const curr = draft[id];
    if (!orig || !curr) return false;
    return ["tempUL", "tempLL", "humidUL", "humidLL"].some(
      k => parseFloat(orig[k]) !== parseFloat(curr[k])
    );
  };

  const changedIds = getChangedIds(
    Object.fromEntries(
      sensors.map(({ id }) => [id, {
        tempUL:  parseFloat(draft[id]?.tempUL),
        tempLL:  parseFloat(draft[id]?.tempLL),
        humidUL: parseFloat(draft[id]?.humidUL),
        humidLL: parseFloat(draft[id]?.humidLL),
      }])
    )
  );
  const hasChanges = changedIds.length > 0;

  const handleSaveLimits = async () => {
    const { errors: e, parsed } = validate();
    if (Object.keys(e).length) { setErrors(e); return; }
    const changed = getChangedIds(parsed);
    if (changed.length === 0) { onClose(); return; }
    setSaving(true); setApiError(null);
    try {
      const payload = { sensors: changed.map(id => { const sensor = MAP_SENSORS.find(s => s.id === id); return { areaId: sensor.areaId, ...parsed[id] }; }) };
      await axios.post(`${API_BASE}/sensors/limits/batch`, payload);
      limitsCache = { ...limitsCache, ...parsed }; // update cache with saved values
      onSave(parsed); onClose();
    } catch (err) { setApiError(err.message ?? "Something went wrong. Please try again."); }
    finally { setSaving(false); }
  };

  const hasRowError  = id => ["tempUL", "tempLL", "humidUL", "humidLL"].some(k => errors[`${id}.${k}`]);
  const activeSensor = sensors.find(s => s.id === activeId);
  const groups       = [...new Set(sensors.map(s => s.group))];

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
      <div style={{ padding: "16px 20px 14px", borderBottom: "1px solid #e9ecef", flexShrink: 0 }}>
        <p className="text-base font-semibold">Adjust Sensor Limits</p>
        <p className="text-sm text-muted-foreground mt-0.5">
          Plant 1 Floor 2 · Each sensor has its own threshold
          {hasChanges && !loading && (
            <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 700, color: "#435ebe" }}>
              {changedIds.length} unsaved change{changedIds.length !== 1 ? "s" : ""}
            </span>
          )}
        </p>
      </div>
      <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
        <div style={{ width: 180, flexShrink: 0, borderRight: "1px solid #e9ecef", overflowY: "auto", padding: "8px 0" }}>
          {groups.map(group => {
            const list = sensors.filter(s => s.group === group);
            return (
              <div key={group}>
                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-widest" style={{ padding: "10px 16px 4px" }}>{group}</div>
                {list.map(({ id, name }) => (
                  <div key={id} onClick={() => !saving && setActiveId(id)}
                    style={{ padding: "9px 16px", cursor: saving ? "default" : "pointer", background: id === activeId ? "rgba(67,94,190,.08)" : "transparent", borderLeft: `3px solid ${id === activeId ? "#435ebe" : "transparent"}`, display: "flex", alignItems: "center", justifyContent: "space-between", transition: "background .1s" }}
                    className={`text-sm ${id === activeId ? "font-semibold" : ""}`}>
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}</span>
                    <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
                      {!hasRowError(id) && isChanged(id) && (
                        <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#fd7e14", display: "block" }} title="Unsaved change" />
                      )}
                      {hasRowError(id) && <span className="text-destructive" style={{ fontSize: 16, marginLeft: 4, lineHeight: 1 }}>•</span>}
                    </div>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
        <div style={{ flex: 1, minWidth: 0, overflowY: "auto", padding: "24px 28px", display: "flex", flexDirection: "column", gap: 24, background: "#fff" }}>
          <p className="text-base font-semibold">{activeSensor?.name}</p>
          <div><p className="text-sm font-medium mb-3">Temperature</p><div style={{ display: "flex", gap: 16 }}><NumField sensorId={activeId} fieldKey="tempLL"  label="Lower Limit" unit="°C" draft={draft} errors={errors} onSetField={setField} saving={saving} /><NumField sensorId={activeId} fieldKey="tempUL"  label="Upper Limit" unit="°C" draft={draft} errors={errors} onSetField={setField} saving={saving} /></div></div>
          <div><p className="text-sm font-medium mb-3">Humidity</p><div style={{ display: "flex", gap: 16 }}><NumField sensorId={activeId} fieldKey="humidLL" label="Lower Limit" unit="%" draft={draft} errors={errors} onSetField={setField} saving={saving} /><NumField sensorId={activeId} fieldKey="humidUL" label="Upper Limit" unit="%" draft={draft} errors={errors} onSetField={setField} saving={saving} /></div></div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: "auto" }}>
            {groups.map(group => { const list = sensors.filter(s => s.group === group); if (!list.find(s => s.id === activeId)) return null; return (<Button key={group} type="button" size="default" variant="default" className="cursor-pointer" disabled={saving} onClick={() => { const src = draft[activeId]; setDraft(prev => { const next = { ...prev }; list.forEach(({ id }) => { next[id] = { ...src }; }); return next; }); }}>Apply to all {group.toLowerCase()}</Button>); })}
          </div>
          {apiError && <div style={{ background: "#ffe8e8", border: "1.5px solid #dc3545", borderRadius: 8, padding: "10px 14px" }} className="text-sm text-destructive">{apiError}</div>}
        </div>
      </div>
      <div style={{ padding: "12px 20px 14px", borderTop: "1px solid #e9ecef", display: "flex", gap: 8, alignItems: "center", justifyContent: "flex-end", flexShrink: 0, background: "#fff" }}>
        {saving             && <span className="text-sm text-muted-foreground" style={{ marginRight: "auto" }}>Saving to database…</span>}
        {loading && !saving && <span className="text-sm text-muted-foreground" style={{ marginRight: "auto" }}>Refreshing limits…</span>}
        <Button variant="outline" size="default" className="cursor-pointer" onClick={onClose} disabled={saving}>Cancel</Button>
        <Button variant="default" size="default" className="cursor-pointer" onClick={handleSaveLimits} disabled={saving || !hasChanges}>{saving ? "Saving…" : "Save All"}</Button>
      </div>
    </div>
  );
}


// ─────────────────────────────────────────────────────────────────────────────
// SECTION 4: MAP UI COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────

function SensorPane({ sensor }) {
  const status = getPaneStatus(sensor); const style = STATUS_STYLES[status];
  const lim    = sensor.limits ?? { tempUL: "?", tempLL: "?", humidUL: "?", humidLL: "?" };
  const isInactiveBreach = status === "inactive-breach" || sensor.activeLocation === false;
  return (
    <div style={{ background: style.bg, border: `2px solid ${style.border}`, borderRadius: 8, padding: "8px 12px", minWidth: 155, color: style.text, boxShadow: "0 4px 12px rgba(0,0,0,.18)", pointerEvents: "none", whiteSpace: "nowrap" }}>
      <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 4, display: "flex", alignItems: "center", flexWrap: "wrap", gap: 4 }}>{sensor.name}{isInactiveBreach && <InactiveAreaBadge />}</div>
      {sensor.hasData ? (<><div style={{ fontSize: 12 }}>Temp: <strong>{sensor.temp?.toFixed(2)}°C</strong><span style={{ fontSize: 10, color: "#adb5bd", marginLeft: 4 }}>{lim.tempLL}–{lim.tempUL}°C</span></div><div style={{ fontSize: 12 }}>Humid: <strong>{sensor.humid?.toFixed(2)}%</strong><span style={{ fontSize: 10, color: "#adb5bd", marginLeft: 4 }}>{lim.humidLL}–{lim.humidUL}%</span></div></>) : <div style={{ fontSize: 12, opacity: 0.75 }}>No data available</div>}
    </div>
  );
}

function SensorMarker({ sensor, selected, onToggle }) {
  const isWhite = sensor.color === "#ffffff"; const dir = getPaneDirection(sensor); const status = getPaneStatus(sensor);
  const arrowBase = { position: "absolute", width: 0, height: 0, border: "7px solid transparent" };
  const arrowStyle = {
    top:    { ...arrowBase, bottom: -13, left: "50%", transform: "translateX(-50%)", borderTopColor:    STATUS_STYLES[status].border, borderBottom: "none" },
    bottom: { ...arrowBase, top:    -13, left: "50%", transform: "translateX(-50%)", borderBottomColor: STATUS_STYLES[status].border, borderTop:    "none" },
    left:   { ...arrowBase, right:  -13, top:  "50%", transform: "translateY(-50%)", borderLeftColor:   STATUS_STYLES[status].border, borderRight:  "none" },
    right:  { ...arrowBase, left:   -13, top:  "50%", transform: "translateY(-50%)", borderRightColor:  STATUS_STYLES[status].border, borderLeft:   "none" },
  };
  const panePos = { top: { bottom: "calc(100% + 10px)", left: "50%", transform: "translateX(-50%)" }, bottom: { top: "calc(100% + 10px)", left: "50%", transform: "translateX(-50%)" }, left: { right: "calc(100% + 10px)", top: "50%", transform: "translateY(-50%)" }, right: { left: "calc(100% + 10px)", top: "50%", transform: "translateY(-50%)" } };
  return (
    <div onClick={() => onToggle(sensor.id)} style={{ position: "absolute", left: `${sensor.x}%`, top: `${sensor.y}%`, transform: "translate(-50%, -50%)", zIndex: selected ? 20 : 10, cursor: "pointer" }}>
      <div style={{ width: 16, height: 16, background: sensor.color, border: `2px solid ${isWhite ? "#adb5bd" : "rgba(0,0,0,.35)"}`, borderRadius: 3, boxShadow: selected ? "0 0 0 3px rgba(67,94,190,.5)" : "0 1px 4px rgba(0,0,0,.4)", transition: "box-shadow .15s" }} />
      {selected && <div style={{ position: "absolute", zIndex: 30, filter: "drop-shadow(0 4px 8px rgba(0,0,0,.18))", ...panePos[dir] }}><div style={{ position: "relative" }}><div style={arrowStyle[dir]} /><SensorPane sensor={sensor} /></div></div>}
    </div>
  );
}

function SensorListItem({ sensor, selected, onToggle }) {
  const status = getPaneStatus(sensor); const statusDot = STATUS_STYLES[status].dot;
  return (
    <div onClick={() => onToggle(sensor.id)} className="flex items-center gap-2 px-3 py-2 rounded-md cursor-pointer" style={{ background: "transparent", userSelect: "none" }}
      onMouseEnter={e => { e.currentTarget.style.background = "#f3f4f6"; }} onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}>
      <div style={{ width: 16, height: 16, flexShrink: 0, border: `2px solid ${selected ? "#435ebe" : "#adb5bd"}`, borderRadius: 3, background: selected ? "#435ebe" : "transparent", display: "flex", alignItems: "center", justifyContent: "center" }}>{selected && <span style={{ color: "#fff", fontSize: 9, lineHeight: 1 }}>✓</span>}</div>
      <div style={{ width: 14, height: 14, flexShrink: 0, background: sensor.color, border: `1.5px solid ${sensor.color === "#ffffff" ? "#adb5bd" : "rgba(0,0,0,.2)"}`, borderRadius: 2 }} />
      <span style={{ fontSize: 13 }}>{sensor.name}</span>
      <div style={{ marginLeft: "auto", flexShrink: 0, display: "flex", alignItems: "center", gap: 4 }}>
        {sensor.activeLocation === false && <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#ffe082", display: "block" }} title="Inactive area — alarms suppressed" />}
        <span style={{ width: 8, height: 8, borderRadius: "50%", background: statusDot, display: "block" }} />
      </div>
    </div>
  );
}


// ─────────────────────────────────────────────────────────────────────────────
// SECTION 5: MAIN PAGE
// ─────────────────────────────────────────────────────────────────────────────

const hasLiveData = (sensors) => sensors?.some(s => s.hasData) ?? false;

export default function P1F2MapPage() {
  const [selectedIds, setSelectedIds] = useState(new Set(MAP_SENSORS.map(s => s.id)));
  const [limitsOpen,  setLimitsOpen]  = useState(false);
  const [allLimits,   setAllLimits]   = useState({});
  const [mapSensors,  setMapSensors]  = useState(mapSensorsCache ?? MAP_SENSORS);
  const [loading,     setLoading]     = useState(!hasLiveData(mapSensorsCache ?? []));

  const [limitsReady, setLimitsReady] = useState(Object.keys(limitsCache).length > 0);

  const allIds           = mapSensors.map(s => s.id);
  const allSelected      = selectedIds.size === allIds.length;
  const totalActiveCount = mapSensors.filter(s => s.hasData).length;

  const limitsOpenRef = useRef(false);
  useEffect(() => { limitsOpenRef.current = limitsOpen; }, [limitsOpen]);

  useEffect(() => {
    let interval;
    const fetchReadings = async () => {
      try {
        const res  = await axios.get(`${API_BASE}/sensors/readings/current`, { params: { floor: "p1f2" } });
        const json = res.data;
        const newSensors = MAP_SENSORS.map(sensor => {
          const live = json.data.find(d => d.areaId === sensor.areaId);
          if (!live) return sensor;
          const activeLocation = !INACTIVE_AREAS.has(sensor.areaId);
          let status = live.status;
          if (status === "breach" && !activeLocation) status = "inactive-breach";
          return { ...sensor, temp: live.temperature, humid: live.humidity, hasData: live.hasData, lastSeen: live.lastSeen, activeLocation, status, limits: live.limits };
        });
        mapSensorsCache = newSensors;
        setMapSensors(newSensors);
        if (hasLiveData(newSensors)) setLoading(false);

        // Fetch limits once on first load — modal reads from limitsCache, no fetch on open
        if (Object.keys(limitsCache).length === 0) {
          const entries = await Promise.all(
            MAP_SENSORS.map(async (sensor) => {
              try {
                const res = await axios.get(`${API_BASE}/sensors/${sensor.areaId}/limits`);
                const d   = res.data.data;
                return [sensor.id, { tempUL: d.tempUL, tempLL: d.tempLL, humidUL: d.humidUL, humidLL: d.humidLL }];
              } catch {
                return [sensor.id, { tempUL: 28, tempLL: 13, humidUL: 80, humidLL: 40 }];
              }
            })
          );
          limitsCache = Object.fromEntries(entries);
          setLimitsReady(true);
        }

        // Only update allLimits if modal is closed — prevents disrupting draft state mid-edit
        if (!limitsOpenRef.current) {
          setAllLimits(prev => {
            const next = { ...prev };
            json.data.forEach(d => { const sensor = MAP_SENSORS.find(s => s.areaId === d.areaId); if (sensor) next[sensor.id] = d.limits; });
            return next;
          });
        }
      } catch (err) { console.error("Failed to fetch P1F2 readings:", err); }
    };
    fetchReadings();
    interval = setInterval(fetchReadings, 30_000);
    return () => clearInterval(interval);
  }, []);

  const toggle    = id => setSelectedIds(prev => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; });
  const toggleAll = () => setSelectedIds(allSelected ? new Set() : new Set(allIds));

  const LEGEND = [{ color: STATUS_STYLES["ok"].dot, label: "Within limits" }, { color: STATUS_STYLES["breach"].dot, label: "Limit breached" }, { color: STATUS_STYLES["no-data"].dot, label: "No data" }, { color: null, label: "Inactive area", isText: true }];

  return (
    <div className="flex flex-col h-full overflow-hidden" style={{ minHeight: 0 }}>
      {loading && <LoadingOverlay />}
      <div style={{ marginTop: 10, padding: "14px 24px", flexShrink: 0 }} className="bg-background">
        <h1 className="text-2xl font-bold">Map View</h1>
        <p className="text-sm text-muted-foreground mt-1">{totalActiveCount} sensor{totalActiveCount !== 1 ? "s" : ""} active · Plant 1 Floor 2</p>
      </div>
      <div className="flex flex-1 overflow-hidden" style={{ minHeight: 0 }}>
        <div style={{ paddingLeft: 20, paddingTop: 20, paddingBottom: 20, boxSizing: "border-box", display: "flex", flexDirection: "column" }}>
          <aside style={{ width: 260, flexShrink: 0, background: "#fff", border: "1px solid #e9ecef", display: "flex", flexDirection: "column", overflow: "hidden", borderRadius: 5 }}>
            <div style={{ padding: "12px 16px 12px", borderBottom: "1px solid #e9ecef", display: "flex", flexDirection: "column", gap: 8 }}>
              <Button type="button" size="default" variant={allSelected ? "outline" : "default"} className="w-full flex items-center justify-center gap-1.5 font-bold text-sm cursor-pointer" onClick={toggleAll}>{allSelected ? "Deselect All" : "Select All"}</Button>
              <Button type="button" size="default" variant={limitsOpen ? "outline" : "default"} className="w-full flex items-center justify-center gap-1.5 font-bold text-sm cursor-pointer" disabled={!limitsReady} onClick={() => setLimitsOpen(true)}>{limitsReady ? "Adjust Sensor Limits" : "Loading Limits…"}</Button>
            </div>
            <div style={{ flex: 1, overflowY: "auto", padding: "8px 12px" }}>
              <div className="text-sm px-1 pt-2 pb-1">Line Name</div>
              {mapSensors.map(s => <SensorListItem key={s.id} sensor={s} selected={selectedIds.has(s.id)} onToggle={toggle} />)}
            </div>
            <div style={{ padding: "10px 20px 16px", borderTop: "1px solid #e9ecef", display: "flex", flexDirection: "column", gap: 4 }}>
              {LEGEND.map(({ color, label, isText }) => (
                <div key={label} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "#6c757d" }}>
                  {isText ? <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#ffe082", display: "block", flexShrink: 0 }} /> : <div style={{ width: 8, height: 8, borderRadius: "50%", background: color, flexShrink: 0 }} />}
                  {label}
                </div>
              ))}
            </div>
          </aside>
        </div>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", minHeight: 0 }}>
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 12, padding: 20, overflow: "hidden", minHeight: 0, borderRadius: 5 }}>
            <div style={{ flex: 1, position: "relative", overflow: "hidden", borderRadius: 5, background: "transparent", border: "1px solid #e9ecef", minHeight: 0 }}>
              <img src={FLOOR_PLAN_IMAGE} alt="P1F2 Floor Plan" style={{ width: "100%", height: "100%", objectFit: "contain", display: "block", userSelect: "none", pointerEvents: "none" }} />
              {mapSensors.map(sensor => <SensorMarker key={sensor.id} sensor={sensor} selected={selectedIds.has(sensor.id)} onToggle={toggle} />)}
            </div>
          </div>
        </div>
      </div>
      <CustomModal open={limitsOpen} onOpenChange={open => { if (!open) setLimitsOpen(false); }} title="Adjust Sensor Limits" size="lg" fixedLayout>
        <SensorLimitsContent allLimits={allLimits} onSave={newLimits => setAllLimits(newLimits)} onClose={() => setLimitsOpen(false)} sensors={ALL_EDITABLE_SENSORS} />
      </CustomModal>
    </div>
  );
}