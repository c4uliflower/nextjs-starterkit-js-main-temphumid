"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import axios from "@/lib/axios";

const API_BASE = '/api/temphumid';

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 1: DATA LAYER
// ─────────────────────────────────────────────────────────────────────────────

const FLOOR_PLAN_IMAGE = "/logo/assets/P1-P2F2-1.png";

const INACTIVE_AREAS = new Set([]);

let mapSensorsCache = null;
let statusCache     = {};

// Static sensor registry — Plant = '1 & 2', Floor = '2', single bridge sensor.
const MAP_SENSORS = [
  { id: "p1p2-bridge", areaId: "P1F2-06", name: "P1P2_Bridge", color: "#dc3545", x: 23, y: 41.5, direction: "right" },
];

// Used for status fallback keying
const ALL_EDITABLE_SENSORS = MAP_SENSORS.map(s => ({ id: s.id, name: s.name, areaId: s.areaId, group: "Sensors" }));

function getPaneStatus(sensor) { return sensor.status ?? "no-data"; }

const STATUS_STYLES = {
  "ok":              { bg: "#e8fff8", text: "#212529", border: "#00c9a7", dot: "#00c9a7" },
  "breach":          { bg: "#ffe8e8", text: "#212529", border: "#dc3545", dot: "#dc3545" },
  "inactive-breach": { bg: "#e8fff8", text: "#212529", border: "#00c9a7", dot: "#00c9a7" },
  "no-data":         { bg: "#f0f0f0", text: "#495057", border: "#adb5bd", dot: "#adb5bd" },
};

function InactiveAreaBadge() {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: 8, fontWeight: 700, letterSpacing: ".04em", textTransform: "uppercase", background: "#fff8e1", color: "#000", border: "1px solid #ffe082", borderRadius: 5, padding: "1px 5px", verticalAlign: "middle", whiteSpace: "nowrap" }}>
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

const SPINNER_STYLE = `@keyframes spinLoader { to { transform: rotate(360deg); } }`;

function LoadingOverlay() {
  return (
    <>
      <style>{SPINNER_STYLE}</style>
      <div style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(0,0,0,.55)", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ background: "var(--card)", borderRadius: 10, padding: "36px 48px", display: "flex", flexDirection: "column", alignItems: "center", gap: 20, boxShadow: "0 8px 40px rgba(0,0,0,.18)", minWidth: 260 }}>
          <div style={{ width: 44, height: 44, borderRadius: "50%", border: "4px solid var(--border)", borderTop: "4px solid #435ebe", animation: "spinLoader 0.8s linear infinite" }} />
          <div style={{ textAlign: "center" }}>
            <p style={{ fontWeight: 700, fontSize: 15, color: "var(--foreground)", margin: 0 }}>Fetching sensor data</p>
            <p style={{ fontSize: 12, color: "var(--muted-foreground)", marginTop: 6 }}>Please wait while live readings are loaded…</p>
          </div>
        </div>
      </div>
    </>
  );
}


// ─────────────────────────────────────────────────────────────────────────────
// SECTION 3: MAP UI COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────

function SensorPane({ sensor }) {
  const status = getPaneStatus(sensor); const style = STATUS_STYLES[status];
  const lim    = sensor.limits ?? { tempUL: "?", tempLL: "?", humidUL: "?", humidLL: "?" };
  const isInactiveBreach = status === "inactive-breach" || sensor.activeLocation === false;
  return (
    <div style={{ background: style.bg, border: `2px solid ${style.border}`, borderRadius: 8, padding: "8px 12px", minWidth: 155, color: style.text, boxShadow: "0 4px 12px rgba(0,0,0,.18)", pointerEvents: "none", whiteSpace: "nowrap" }}>
      <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 4, display: "flex", alignItems: "center", flexWrap: "wrap", gap: 4 }}>
        {sensor.name}{isInactiveBreach && <InactiveAreaBadge />}
      </div>
      {sensor.hasData
        ? (<><div style={{ fontSize: 12 }}>Temp: <strong>{sensor.temp?.toFixed(2)}°C</strong><span style={{ fontSize: 10, color: "#adb5bd", marginLeft: 4 }}>{lim.tempLL}–{lim.tempUL}°C</span></div><div style={{ fontSize: 12 }}>Humid: <strong>{sensor.humid?.toFixed(2)}%</strong><span style={{ fontSize: 10, color: "#adb5bd", marginLeft: 4 }}>{lim.humidLL}–{lim.humidUL}%</span></div></>)
        : <div style={{ fontSize: 12, opacity: 0.75 }}>No data available</div>}
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
          <div style={{ position: "relative" }}><div style={arrowStyle[dir]} /><SensorPane sensor={sensor} /></div>
        </div>
      )}
    </div>
  );
}

function SensorListItem({ sensor, selected, onToggle }) {
  const status = getPaneStatus(sensor); const statusDot = STATUS_STYLES[status].dot;
  return (
    <div onClick={() => onToggle(sensor.id)} className="flex items-center gap-2 px-3 py-2 rounded-md cursor-pointer" style={{ background: "transparent", userSelect: "none" }} onMouseEnter={e => { e.currentTarget.style.background = "var(--accent"; }} onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}>
      <div style={{ width: 16, height: 16, flexShrink: 0, border: `2px solid ${selected ? "#435ebe" : "#adb5bd"}`, borderRadius: 3, background: selected ? "#435ebe" : "transparent", display: "flex", alignItems: "center", justifyContent: "center" }}>
        {selected && <span style={{ color: "#fff", fontSize: 9, lineHeight: 1 }}>✓</span>}
      </div>
      <div style={{ width: 14, height: 14, flexShrink: 0, background: sensor.color, border: `1.5px solid ${sensor.color === "#ffffff" ? "#adb5bd" : "rgba(0,0,0,.2)"}`, borderRadius: 2 }} />
      <span style={{ fontSize: 13 }}>{sensor.name}</span>
      <div style={{ marginLeft: "auto", flexShrink: 0, display: "flex", alignItems: "center", gap: 4 }}>
        {sensor.activeLocation === false && <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#ffe082", display: "block" }} title="Inactive area — alarms suppressed" />}
        <span style={{ width: 8, height: 8, borderRadius: "50%", background: statusDot, display: "block" }} />
      </div>
    </div>
  );
}

const LEGEND = [
  { color: STATUS_STYLES["ok"].dot,      label: "Within limits"  },
  { color: STATUS_STYLES["breach"].dot,  label: "Limit breached" },
  { color: STATUS_STYLES["no-data"].dot, label: "No data"        },
  //{ color: null, label: "Inactive area", isText: true            },
];


// ─────────────────────────────────────────────────────────────────────────────
// SECTION 4: MAIN PAGE
// ─────────────────────────────────────────────────────────────────────────────

const hasLiveData = (sensors) => sensors?.some(s => s.hasData) ?? false;

export default function P1and2F2MapPage() {
  const [activeSensorIds, setActiveSensorIds] = useState(
    () => new Set(MAP_SENSORS.filter(s => statusCache[s.id] !== "Inactive").map(s => s.id))
  );
  const [selectedIds, setSelectedIds] = useState(
    () => new Set(MAP_SENSORS.filter(s => statusCache[s.id] !== "Inactive").map(s => s.id))
  );
  const [mapSensors, setMapSensors] = useState(mapSensorsCache ?? MAP_SENSORS);
  const [loading,    setLoading]    = useState(!hasLiveData(mapSensorsCache ?? []));

  const visibleSensors   = mapSensors.filter(s => activeSensorIds.has(s.id));
  const allIds           = visibleSensors.map(s => s.id);
  const allSelected      = selectedIds.size === allIds.length && allIds.length > 0;
  const totalActiveCount = mapSensors.filter(s => s.hasData).length;

  const recomputeActiveFromCache = () => {
    const activeIds = new Set(MAP_SENSORS.filter(s => statusCache[s.id] !== "Inactive").map(s => s.id));
    setActiveSensorIds(activeIds);
    setSelectedIds(activeIds);
  };

  useEffect(() => {
    let interval;
    const fetchReadings = async () => {
      try {
        const res  = await axios.get(`${API_BASE}/sensors/readings/current`, { params: { floor: "p12f2" } });
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

        if (Object.keys(statusCache).length === 0) {
          try {
            const res     = await axios.get(`${API_BASE}/sensors/status`, { params: { floor: "p12f2" } });
            const entries = res.data.data.map(d => {
              const sensor = MAP_SENSORS.find(s => s.areaId === d.areaId);
              return sensor ? [sensor.id, d.status] : null;
            }).filter(Boolean);
            statusCache = Object.fromEntries(entries);
            recomputeActiveFromCache();
          } catch {
            statusCache = Object.fromEntries(ALL_EDITABLE_SENSORS.map(s => [s.id, "Active"]));
            recomputeActiveFromCache();
          }
        }
      } catch (err) { console.error("Failed to fetch P1&2F2 readings:", err); }
    };
    fetchReadings();
    interval = setInterval(fetchReadings, 30_000);
    return () => clearInterval(interval);
  }, []);

  const toggle    = id => setSelectedIds(prev => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; });
  const toggleAll = () => setSelectedIds(allSelected ? new Set() : new Set(allIds));

  return (
    <div className="flex flex-col h-full overflow-hidden" style={{ minHeight: 0 }}>
      {loading && <LoadingOverlay />}

      {/* ── Page header ── */}
      <div style={{ marginTop: 10, padding: "14px 24px", flexShrink: 0 }} className="bg-background">
        <h1 className="text-2xl font-bold">Map View</h1>
        <p className="text-sm text-muted-foreground mt-1">{totalActiveCount} sensor{totalActiveCount !== 1 ? "s" : ""} active · Plant 1 and 2 Floor 2 (Bridge)</p>
      </div>

      <div className="flex flex-1 overflow-hidden" style={{ minHeight: 0 }}>

        {/* ── Sidebar ── */}
        <div style={{ paddingLeft: 20, paddingTop: 20, paddingBottom: 20, boxSizing: "border-box", display: "flex", flexDirection: "column" }}>
          <aside style={{ width: 260, flexShrink: 0, background: "var(--card)", border: "1px solid var(--border)", display: "flex", flexDirection: "column", overflow: "hidden", borderRadius: 5 }}>
            <div style={{ padding: "12px 16px 12px", borderBottom: "1px solid var(--border)", display: "flex", flexDirection: "column", gap: 8 }}>
              <Button type="button" size="default" variant={allSelected ? "outline" : "default"} className="w-full flex items-center justify-center gap-1.5 font-bold text-sm cursor-pointer" onClick={toggleAll}>{allSelected ? "Deselect All" : "Select All"}</Button>
            </div>
            <div style={{ flex: 1, overflowY: "auto", padding: "8px 12px" }}>
              <div className="text-sm px-1 pt-2 pb-1">Line Name</div>
              {visibleSensors.map(s => <SensorListItem key={s.id} sensor={s} selected={selectedIds.has(s.id)} onToggle={toggle} />)}
            </div>
            <div style={{ padding: "10px 20px 16px", borderTop: "1px solid var(--border)", display: "flex", flexDirection: "column", gap: 4 }}>
              {LEGEND.map(({ color, label, isText }) => (
                <div key={label} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "var(--muted-foreground)" }}>
                  {isText ? <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#ffe082", display: "block", flexShrink: 0 }} /> : <div style={{ width: 8, height: 8, borderRadius: "50%", background: color, flexShrink: 0 }} />}
                  {label}
                </div>
              ))}
            </div>
          </aside>
        </div>

        {/* ── Map area ── */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", minHeight: 0 }}>
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 12, padding: 20, overflow: "hidden", minHeight: 0 }}>
            <div style={{ flex: 1, position: "relative", overflow: "hidden", borderRadius: 5, background: "transparent", border: "1px solid #e9ecef", minHeight: 0 }}>
              <img src={FLOOR_PLAN_IMAGE} alt="P1&2F2 Floor Plan" style={{ width: "100%", height: "100%", objectFit: "contain", display: "block", userSelect: "none", pointerEvents: "none" }} />
              {visibleSensors.map(sensor => <SensorMarker key={sensor.id} sensor={sensor} selected={selectedIds.has(sensor.id)} onToggle={toggle} />)}
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}