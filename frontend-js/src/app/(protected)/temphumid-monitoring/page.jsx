"use client";

import { useState, useEffect } from "react";

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 1: DATA LAYER  ← replace with real API calls
// ─────────────────────────────────────────────────────────────────────────────

/**
 * FLOORS — one entry per map page.
 * status: "ok" | "breach" | "no-data"
 * breachedSensors: list shown in the modal right panel (red accordion rows)
 * image: thumbnail of the floor plan
 * href: link to the full map page (used by the nav bar tabs)
 *
 * TO REPLACE: derive status + breachedSensors from your API sensor readings.
 */
const FLOORS = [
  {
    id: "p1f1",
    label: "P1F1",
    image: "/logo/assets/P1F1-4.jpg",
    href: "/temphumid-p1f1",
    status: "breach",
    summary: "2 sensors in breach",
    breachedSensors: [
      { name: "SMT - Cold Storage",     temp: 2.25, humid: 0.00 },
      { name: "SMT MH Dessicator 5",    temp: 21.30, humid: 37.50 }
    ],
    stableMessage: null,
  },
  {
    id: "p1f2",
    label: "P1F2",
    image: "/logo/assets/P1F2.png",
    href: "/temphumid-p1f2",
    status: "ok",
    summary: "All stable",
    breachedSensors: [],
    stableMessage: "All temperature and humidity levels at P1F2 are within acceptable limits.",
  },
  {
    id: "p2f1",
    label: "P2F1",
    image: "/logo/assets/P2F1.png",
    href: "/temphumid-p2f1",
    status: "breach",
    summary: "2 sensors in breach",
    breachedSensors: [
        { name: "WH - Cold Storage", temp: 4.00, humid: 0.00 },
        { name: "WH - Cold Storage 2", temp: 2.75, humid: 0.00 },
    ],
    stableMessage: "All temperature and humidity levels at P2F1 are within acceptable limits.",
  },
  {
    id: "p2f2",
    label: "P2F2",
    image: "/logo/assets/P2F2.png",
    href: "/temphumid-p2f2",
    status: "ok",
    summary: "All stable",
    breachedSensors: [],
    stableMessage: null,
  },
  {
    id: "p1and2f2",
    label: "P1&2F2",
    image: "/logo/assets/P1 & P2F2-1.png",
    href: "/temphumid-p1and2f2",
    status: "ok",
    summary: "All stable",
    breachedSensors: [],
    stableMessage: "All temperature and humidity levels at P1&2F2 are within acceptable limits.",
  },
  {
    id: "wh",
    label: "WH",
    image: "/logo/assets/WH.png",
    href: "/temphumid-wh",
    status: "ok",
    summary: "All stable",
    breachedSensors: [],
    stableMessage: "All temperature and humidity levels at WH are within acceptable limits.",
  },
];

/**
 * ACTIVITY LOG
 * TO REPLACE: fetch("/api/sensor-logs") → map to this shape.
 * Each entry: { id, message, timestamp }
 */
const ACTIVITY_LOG = [
  { id: 1, message: "0xDD8EBA last data recorded was on 2025-06-11 17:15:15.000" },
  { id: 2, message: "0xI9ADE3 last data recorded was on 2025-06-12 23:32:12.000" },
  { id: 3, message: "0xD88694 last data recorded was on 2026-02-06 20:29:48.000" },
  { id: 4, message: "0x4E4D85 last data recorded was on 2025-08-16 07:01:34.000" },
  { id: 5, message: "WH-MH JCM Assy last data recorded was on 2024-08-31 13:13:30.000" },
  { id: 6, message: "0xAF3C12 last data recorded was on 2025-11-03 09:44:22.000" },
  { id: 7, message: "SMT - Cold Storage last data recorded was on 2026-01-15 03:20:11.000" },
];


// ─────────────────────────────────────────────────────────────────────────────
// SECTION 2: BLINK ANIMATION (injected once via <style>)
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
// SECTION 3: SUB-COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────

/** Blinking red dot for breach floors */
function BreachDot() {
  return (
    <div style={{
      width: 10, height: 10, borderRadius: "50%",
      background: "#dc3545", flexShrink: 0,
      animation: "dotPulse 1s ease-in-out infinite",
    }} />
  );
}

/** Single floor thumbnail card */
function FloorCard({ floor, onClick }) {
  const isBreach = floor.status === "breach";
  return (
    <div
      onClick={() => onClick(floor)}
      style={{
        borderRadius: 12,
        overflow: "hidden",
        cursor: "pointer",
        border: `2px solid ${isBreach ? "#dc3545" : "#00c9a7"}`,
        animation: isBreach ? "borderBlink 1.2s ease-in-out infinite" : "none",
        background: "#fff",
        transition: "transform .15s",
        display: "flex",
        flexDirection: "column",
      }}
      onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-3px)"; }}
      onMouseLeave={(e) => { e.currentTarget.style.transform = "translateY(0)"; }}
    >
      {/* Thumbnail */}
      <div style={{ flex: 1, overflow: "hidden", background: "#f8f9fa", minHeight: 180, maxHeight: 240 }}>
        <img
          src={floor.image}
          alt={floor.label}
          style={{ width: "100%", height: "100%", objectFit: "contain", display: "block", pointerEvents: "none", userSelect: "none" }}
        />
      </div>

      {/* Label bar */}
      <div style={{
        padding: "10px 14px",
        background: isBreach ? "#ffe8e8" : "#e8fff8",
        display: "flex",
        alignItems: "center",
        gap: 8,
      }}>
        {isBreach && <BreachDot />}
        <span style={{ fontWeight: 700, fontSize: 15, color: isBreach ? "#b02a37" : "#0a6644", flex: 1 }}>
          {floor.label}
        </span>
        <span style={{ fontSize: 11, color: isBreach ? "#dc3545" : "#198754", fontWeight: 600 }}>
          {floor.summary}
        </span>
      </div>
    </div>
  );
}

/** Breached sensor accordion row */
function BreachRow({ sensor, index }) {
  const [open, setOpen] = useState(false);
  return (
    <div
      style={{
        background: "#ffe8e8",
        border: "1px solid rgba(220,53,69,.25)",
        borderRadius: 8,
        marginBottom: 8,
        overflow: "hidden",
        animation: `slideIn .2s ease both`,
        animationDelay: `${index * 0.05}s`,
      }}
    >
      {/* Header row */}
      <div
        onClick={() => setOpen((v) => !v)}
        style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "12px 16px", cursor: "pointer", userSelect: "none",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#dc3545", animation: "dotPulse 1.2s ease-in-out infinite" }} />
          <span style={{ fontWeight: 600, fontSize: 14, color: "#7a1c1c" }}>{sensor.name}</span>
        </div>
        <span style={{ fontSize: 16, color: "#dc3545", transition: "transform .2s", display: "inline-block", transform: open ? "rotate(180deg)" : "rotate(0deg)" }}>
          ‹
        </span>
      </div>

      {/* Expanded readings */}
      {open && (
        <div style={{ padding: "0 16px 12px", borderTop: "1px solid rgba(220,53,69,.15)" }}>
          <div style={{ fontSize: 13, color: "#7a1c1c", marginTop: 8 }}>
            Temp: <strong>{sensor.temp.toFixed(2)}°C</strong>
            &nbsp;·&nbsp;
            Humidity: <strong>{sensor.humid.toFixed(2)}%</strong>
          </div>
          <div style={{ fontSize: 11, color: "#dc3545", marginTop: 4, fontWeight: 600 }}>
            ⚠ Exceeds limit
          </div>
        </div>
      )}
    </div>
  );
}

/** Full-screen modal that slides in when a floor card is clicked */
function FloorModal({ floor, onClose }) {
  const isBreach = floor.status === "breach";

  // Close on Escape key
  useEffect(() => {
    const handler = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 100,
      background: "rgba(0,0,0,.45)",
      display: "flex", flexDirection: "column",
      animation: "slideIn .18s ease",
    }}>
      {/* Modal content — full screen minus overlay */}
      <div style={{ flex: 1, background: "#fff", display: "flex", flexDirection: "column", overflow: "hidden" }}>

        {/* Header */}
        <div style={{
          padding: "14px 24px", borderBottom: "1px solid #e9ecef",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          background: "#fff",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {isBreach && <BreachDot />}
            <span style={{ fontWeight: 700, fontSize: 18, color: "#212529" }}>{floor.label}</span>
            <span style={{
              fontSize: 11, fontWeight: 700, padding: "3px 8px", borderRadius: 20,
              background: isBreach ? "#dc3545" : "#00c9a7",
              color: isBreach ? "#fff" : "#000",
            }}>
              {floor.summary}
            </span>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "none", border: "none", fontSize: 24,
              cursor: "pointer", color: "#6c757d", lineHeight: 1,
              padding: "0 4px",
            }}
          >
            ×
          </button>
        </div>

        {/* Body: floor plan + right panel */}
        <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>

          {/* Floor plan image */}
          <div style={{ flex: 1, overflow: "hidden", position: "relative", background: "#f8f9fa" }}>
            <img
              src={floor.image}
              alt={floor.label}
              style={{ width: "100%", height: "100%", objectFit: "contain", display: "block", userSelect: "none" }}
            />

            {/* Pulsing ring overlay on breached sensor markers */}
            {isBreach && floor.breachedSensors.map((s, i) => (
              /* These are decorative — positions would come from MAP_SENSORS in a real integration */
              /* For now we show them as ambient rings at approximate spots */
              null
            ))}
          </div>

          {/* Right panel */}
          <div style={{
            width: 320, flexShrink: 0,
            borderLeft: "1px solid #e9ecef",
            display: "flex", flexDirection: "column",
            overflow: "hidden",
            background: isBreach ? "#fff5f5" : "#f0fff8",
          }}>
            <div style={{ flex: 1, overflowY: "auto", padding: "16px" }}>
              {isBreach ? (
                <>
                  <div style={{
                    fontSize: 11, fontWeight: 700, color: "#dc3545",
                    textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 12,
                  }}>
                    Sensors in Breach
                  </div>
                  {floor.breachedSensors.map((s, i) => (
                    <BreachRow key={s.name} sensor={s} index={i} />
                  ))}
                </>
              ) : (
                <div style={{
                  display: "flex", flexDirection: "column",
                  alignItems: "center", justifyContent: "center",
                  height: "100%", padding: 24, textAlign: "center",
                  gap: 12,
                }}>
                  <div style={{ fontWeight: 700, fontSize: 16, color: "#0a6644" }}>All Clear</div>
                  <div style={{ fontSize: 13, color: "#198754", lineHeight: 1.6 }}>
                    {floor.stableMessage}
                  </div>
                </div>
              )}
            </div>

            {/* Go to full map link */}
            <div style={{ padding: "12px 16px", borderTop: "1px solid #e9ecef", background: "#fff" }}>
              <a
                href={floor.href}
                style={{
                  display: "block", textAlign: "center",
                  padding: "10px", borderRadius: 8,
                  background: "#435ebe", color: "#fff",
                  fontWeight: 700, fontSize: 13,
                  textDecoration: "none", transition: "background .15s",
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = "#3347a8"; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "#435ebe"; }}
              >
                Open Full Map →
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Single log row */
function LogRow({ entry, index }) {
  return (
    <div style={{
      padding: "14px 20px",
      border: "1px solid #dee2e6",
      borderRadius: 8,
      background: "#fff",
      fontSize: 13,
      color: "#495057",
      fontFamily: "monospace",
      animation: `slideIn .2s ease both`,
      animationDelay: `${index * 0.04}s`,
    }}>
      {entry.message}
    </div>
  );
}


// ─────────────────────────────────────────────────────────────────────────────
// SECTION 4: MAIN PAGE
// ─────────────────────────────────────────────────────────────────────────────

export default function MonitoringPage() {
  const [activeFloor, setActiveFloor] = useState(null);

  return (
    <>
      {/* Inject keyframe animations */}
      <style>{GLOBAL_STYLES}</style>

      <div style={{
        minHeight: "100vh",
        overflowX: "hidden",
      }}>

        {/* ── Page title ─────────────────────────────────────────────────────── */}
        <div style={{
          padding: "25px 30px 5px",
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>

          <div style={{ padding: "14x 24px"}} className="bg-background">
            <h1 className="text-2xl font-bold">Monitoring</h1>
            <p className="text-muted-foreground mt-1">
                Live status across all floors · {FLOORS.filter((f) => f.status === "breach").length} floor{FLOORS.filter((f) => f.status === "breach").length !== 1 ? "s" : ""} in breach
            </p>
            </div>

          {/* Breach count badge */}
          {FLOORS.some((f) => f.status === "breach") && (
            <div style={{
              display: "flex", alignItems: "center", gap: 8,
              background: "#ffe8e8", border: "1.5px solid #dc3545",
              borderRadius: 5, padding: "6px 14px",
              animation: "borderBlink 1.4s ease-in-out infinite",
            }}>
              <BreachDot />
              <span style={{ fontSize: 13, fontWeight: 700, color: "#dc3545" }}>
                ALARM ACTIVE
              </span>
            </div>
          )}
        </div>

        <div style={{ padding: "24px 32px", display: "flex", flexDirection: "column", gap: 28 }}>

          {/* ── Floor grid ───────────────────────────────────────────────────── */}
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: 20,
          }}>
            {FLOORS.map((floor) => (
              <FloorCard key={floor.id} floor={floor} onClick={setActiveFloor} />
            ))}
          </div>

          {/* ── Activity log ─────────────────────────────────────────────────── */}
          <div style={{
            background: "#fff",
            border: "1px solid #dee2e6",
            borderRadius: 12,
            padding: "20px 24px",
          }}>
            <div style={{
              fontWeight: 700, fontSize: 13, color: "#6c757d",
              textTransform: "uppercase", letterSpacing: ".08em",
              marginBottom: 14,
            }}>
              Activity Log
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {ACTIVITY_LOG.map((entry, i) => (
                <LogRow key={entry.id} entry={entry} index={i} />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Floor modal overlay ───────────────────────────────────────────────── */}
      {activeFloor && (
        <FloorModal floor={activeFloor} onClose={() => setActiveFloor(null)} />
      )}
    </>
  );
}