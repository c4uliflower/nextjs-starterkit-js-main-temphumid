"use client";

import { useState, useEffect, useRef } from "react";
import { DataTable } from "@/components/custom/DataTable";
import { CardSkeleton } from "@/components/custom/CardSkeleton";
import { Button } from "@/components/ui/button";
import axios from "@/lib/axios";

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 1: CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

const API_BASE = '/api/temphumid';

const INACTIVE_AREAS = new Set([]);

let floorsCache   = null;
let statusCache   = {};
let statusCacheTime = 0;
const STATUS_CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

// Module-level Set — tracks which areaIds have an active (open/acknowledged)
// alert this session so the button shows "Forwarded to Facilities" without
// needing to re-fetch on every modal open.
// Seeded from the API on page mount; cleared per-areaId when resolved.
let forwardedAreaIds = new Set();

const ALL_FLOORS = [
  {
    id:    "p1f1",
    label: "Plant 1 · Floor 1",
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
    ],
  },
  {
    id:    "p1f2",
    label: "Plant 1 · Floor 2",
    image: "/logo/assets/P1F2-1.png",
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
    label: "Plant 2 · Floor 1",
    image: "/logo/assets/P2F1-1.png",
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
    label: "Plant 2 · Floor 2",
    image: "/logo/assets/P2F2-1.png",
    href:  "/temphumid-p2f2",
    sensors: [
      { id: "calibration-room", areaId: "P2F2-04", name: "Calibration Room"     },
      { id: "jcm-assy",         areaId: "P2F2-01", name: "JCM Assy"             },
      { id: "wh-brother-pkg",   areaId: "P2F2-02", name: "WH Brother Packaging" },
      { id: "wh-mh-jcm-assy",   areaId: "P2F2-03", name: "WH-MH JCM Assy"       },
      { id: "cis",              areaId: "P1F1-16", name: "CIS"                  },
    ],
  },
  {
    id:    "wh",
    label: "Warehouse",
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
    label: "Bridge",
    image: "/logo/assets/P1-P2F2-1.png",
    href:  "/temphumid-p12f2",
    sensors: [
      { id: "p1p2-bridge", areaId: "P1F2-06", name: "P1P2 Bridge" },
    ],
  },
];

const FLOOR_SLUG = {
  p1f1:     "p1f1",
  p1f2:     "p1f2",
  p2f1:     "p2f1",
  p2f2:     "p2f2",
  wh:       "wh",
  p1and2f2: "p12f2",
};


// ─────────────────────────────────────────────────────────────────────────────
// SECTION 2: ANIMATIONS
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
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes spinLoader {
    to { transform: rotate(360deg); }
  }
`;


// ─────────────────────────────────────────────────────────────────────────────
// SECTION 3: HELPERS & STATUS CONFIG
// ─────────────────────────────────────────────────────────────────────────────

function parseUTC(dateString) {
  if (!dateString) return null;
  if (dateString.includes("Z") || dateString.includes("+")) return new Date(dateString);
  return new Date(dateString.replace(" ", "T") + "+08:00"); // ← PHT offset
}

function formatTimer(seconds) {
  const abs = Math.abs(Math.round(seconds ?? 0));
  const h   = Math.floor(abs / 3600);
  const m   = Math.floor((abs % 3600) / 60);
  const s   = abs % 60;
  return [h, m, s].map(v => String(v).padStart(2, "0")).join(":");
}

function useElapsed(processedAt) {
  const getSnapshot = () => {
    const start = parseUTC(processedAt);
    const end   = new Date();

    if (!start || Number.isNaN(start.getTime())) return 0;
    return Math.max(0, Math.floor((end.getTime() - start.getTime()) / 1000));
  };

  const [elapsed, setElapsed] = useState(getSnapshot);

  useEffect(() => {
    setElapsed(getSnapshot());
    const id = setInterval(() => setElapsed(getSnapshot()), 1000);
    return () => clearInterval(id);
  }, [processedAt]);

  return elapsed;
}

function getSensorStatus(sensor) {
  if (sensor.maintenanceOngoing) return "maintenance";
  if (!sensor.hasData) return "no_data";
  if (sensor.breach)   return "breach";
  return "active";
}

const STATUS_PRIORITY = { breach: 0, maintenance: 1, no_data: 2, active: 3 };

function getFloorStatus(floor) {
  let top = "active";
  for (const s of floor.sensors) {
    const st = getSensorStatus(s);
    if (STATUS_PRIORITY[st] < STATUS_PRIORITY[top]) top = st;
  }
  return top;
}

function getFloorSummary(floor) {
  const breached    = floor.sensors.filter(s => getSensorStatus(s) === "breach").length;
  const maintenance = floor.sensors.filter(s => getSensorStatus(s) === "maintenance").length;
  const noData      = floor.sensors.filter(s => getSensorStatus(s) === "no_data").length;
  const parts = [];
  if (breached    > 0) parts.push(`${breached} in breach`);
  if (maintenance > 0) parts.push(`${maintenance} in maintenance`);
  if (noData      > 0) parts.push(`${noData} no data`);
  return parts.length ? parts.join(" · ") : "All stable";
}

const STATUS_CONFIG = {
  breach:      { color: "#dc3545", bg: "#ffe8e8", label: "Breach",                dot: "#dc3545" },
  maintenance: { color: "var(--warning)", bg: "color-mix(in srgb, var(--warning) 12%, white)", label: "Maintenance", dot: "var(--warning)" },
  no_data:     { color: "#6c757d", bg: "#f1f3f5", label: "No Data",               dot: "#adb5bd" },
  active:      { color: "#198754", bg: "#e8fff8", label: "Active",                dot: "#00c9a7" },
};

function formatNotifiedBy(user) {
  if (!user) return "unknown";
  const name = `${user.first_name ?? ""} ${user.last_name ?? ""}`.trim();
  return user.employee_no ? `${name} (${user.employee_no})` : name || "unknown";
}

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
// ─────────────────────────────────────────────────────────────────────────────

function LoadingOverlay() {
  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 200,
      background: "rgba(0,0,0,.55)",
      display: "flex", alignItems: "center", justifyContent: "center",
    }}>
      <div style={{
        background: "var(--card)", borderRadius: 10, padding: "36px 48px",
        display: "flex", flexDirection: "column", alignItems: "center", gap: 20,
        boxShadow: "0 8px 40px rgba(0,0,0,.18)", minWidth: 260,
      }}>
        <div style={{
          width: 44, height: 44, borderRadius: "50%",
          border: "4px solid var(--border)", borderTop: "4px solid #435ebe",
          animation: "spinLoader 0.8s linear infinite",
        }} />
        <div style={{ textAlign: "center" }}>
          <p style={{ fontWeight: 700, fontSize: 15, color: "var(--foreground)", margin: 0 }}>Fetching sensor data</p>
          <p style={{ fontSize: 12, color: "var(--muted-foreground)", marginTop: 6 }}>Please wait while live readings are loaded…</p>
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
        background: "var(--card)", transition: "transform .15s",
        display: "flex", flexDirection: "column",
      }}
      onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-3px)"; }}
      onMouseLeave={e => { e.currentTarget.style.transform = "translateY(0)"; }}
    >
      <div style={{ flex: 1, overflow: "hidden", background: "var(--muted)", minHeight: 180, maxHeight: 240 }}>
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

// ─────────────────────────────────────────────────────────────────────────────
// SensorStatusRow — includes inline Notify Facilities button for breached sensors.
// Uses Button from @/components/ui/button — same import as every other page.
// notifyState is managed by the parent (FloorModal) to allow cross-sensor
// awareness (e.g. resetting state when needed) without prop-drilling a ref.
// ─────────────────────────────────────────────────────────────────────────────

function SensorStatusRow({ sensor, index, floorLabel, currentUser, notifyState, onNotifyStateChange }) {
  const [open, setOpen] = useState(false);
  const status   = getSensorStatus(sensor);
  const cfg      = STATUS_CONFIG[status];
  const isBreach = status === "breach";

  // notifyState for this sensor: "idle" | "sending" | "forwarded"
  const btnState    = notifyState ?? "idle";
  const isForwarded = btnState === "forwarded";
  const isSending   = btnState === "sending";

  const handleNotify = async () => {
    if (btnState !== "idle") return;
    onNotifyStateChange(sensor.areaId, "sending");

    try {
      await axios.post(`${API_BASE}/facilities/alerts`, {
        areaId:      sensor.areaId,
        lineName:    sensor.name,
        temperature: sensor.temp,
        humidity:    sensor.humid,
        tempUL:      sensor.tempUL,
        tempLL:      sensor.tempLL,
        humidUL:     sensor.humidUL,
        humidLL:     sensor.humidLL,
        // notifiedBy is derived server-side from the authenticated user.
        // We do not send it from the client — same pattern as changed_by
        // in SensorLimitController and SensorStatusController.
      });

      forwardedAreaIds.add(sensor.areaId);
      onNotifyStateChange(sensor.areaId, "forwarded");

      try {
        localStorage.setItem("facilitiesAlertSent", String(Date.now()));
      } catch {}
    } catch (err) {
      console.error("Notify Facilities failed:", err);
      onNotifyStateChange(sensor.areaId, "idle");
    }
  };

  return (
    <div style={{
      background: cfg.bg, border: `1px solid ${cfg.color}25`,
      borderRadius: 5, marginBottom: 8, overflow: "hidden",
      animation: "slideIn .2s ease both", animationDelay: `${index * 0.05}s`,
    }}>
      <div
        onClick={() => setOpen(v => !v)}
        style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "12px 16px", cursor: "pointer", userSelect: "none",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <StatusDot status={status} size={8} />
          <span style={{ fontWeight: 600, fontSize: 14, color: cfg.color }}>{sensor.name}</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{
            fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 5,
            background: cfg.color, color: "#fff",
            letterSpacing: ".04em", textTransform: "uppercase",
          }}>
            {cfg.label}
          </span>
          <span style={{
            fontSize: 16, color: cfg.color, transition: "transform .2s",
            display: "inline-block", transform: open ? "rotate(180deg)" : "rotate(0deg)",
          }}>‹</span>
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

              {isBreach && (
                <div style={{ marginTop: 8 }}>
                  <div style={{ fontSize: 11, color: "#dc3545", fontWeight: 600, marginBottom: 6 }}>
                    Exceeds limit
                  </div>

                  {/* ── Notify Facilities — uses Button from @/components/ui/button ── */}
                  {isForwarded ? (
                    // Forwarded state — muted, disabled, shows checkmark
                    <div style={{
                      display: "flex", alignItems: "center", gap: 6,
                      padding: "6px 10px", borderRadius: 6,
                      background: "var(--muted)", border: "1px solid var(--border)",
                    }}>
                      <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
                        <circle cx="8" cy="8" r="7" stroke="#6c757d" strokeWidth="1.5"/>
                        <path d="M5 8l2 2 4-4" stroke="#6c757d" strokeWidth="1.5"
                          strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                      <span style={{ fontSize: 11, fontWeight: 600, color: "var(--muted-foreground)" }}>
                        Forwarded to Facilities
                      </span>
                    </div>
                  ) : (
                    <Button
                      variant="destructive"
                      size="sm"
                      className="w-full cursor-pointer"
                      disabled={isSending}
                      onClick={handleNotify}
                    >
                      {isSending ? "Notifying…" : "Notify Facilities"}
                    </Button>
                  )}
                </div>
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

function MaintenanceStatusRow({ sensor, index }) {
  const elapsed = useElapsed(sensor.maintenanceStartedAt);
  const cfg     = STATUS_CONFIG.maintenance;

  return (
    <div style={{
      background: cfg.bg,
      border: `1px solid ${cfg.color}25`,
      borderRadius: 5,
      marginBottom: 8,
      overflow: "hidden",
      animation: "slideIn .2s ease both",
      animationDelay: `${index * 0.05}s`,
    }}>
      <div style={{
        padding: "12px 16px",
      }}>
        {/* top row */}
        <div style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 10,
        }}>
          <div style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            minWidth: 0,
            flex: 1,
          }}>
            <StatusDot status="maintenance" size={8} />
            <span style={{
              fontWeight: 600,
              fontSize: 14,
              color: cfg.color,
              lineHeight: 1.2,
              wordBreak: "break-word",
            }}>
              {sensor.name}
            </span>
          </div>

          <span style={{
            fontSize: 10,
            fontWeight: 700,
            padding: "2px 7px",
            borderRadius: 5,
            background: cfg.color,
            color: "#fff",
            letterSpacing: ".04em",
            textTransform: "uppercase",
            flexShrink: 0,
          }}>
            Maintenance
          </span>
        </div>

        {/* bottom row */}
        <div style={{
          marginTop: 10,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
        }}>
          <div style={{
            fontSize: 11,
            color: cfg.color,
            fontWeight: 600,
          }}>
            Started: {parseUTC(sensor.maintenanceStartedAt)?.toLocaleString() ?? "unknown"}
          </div>

          <div style={{
            fontSize: 12,
            fontWeight: 700,
            color: cfg.color,
            fontFamily: "monospace",
            flexShrink: 0,
          }}>
            {formatTimer(elapsed)}
          </div>
        </div>
      </div>
    </div>
  );
}

function FloorModal({ floor, onClose, currentUser }) {
  const floorStatus = getFloorStatus(floor);
  const summary     = getFloorSummary(floor);
  const cfg         = STATUS_CONFIG[floorStatus];
  const isBreach    = floorStatus === "breach";
  const isAllGood   = floorStatus === "active";

  // notifyStates: { [areaId]: "idle" | "sending" | "forwarded" }
  // Initialized from module-level forwardedAreaIds so state persists
  // across modal close/reopen within the same session.
  const [notifyStates, setNotifyStates] = useState(() => {
    const init = {};
    for (const s of floor.sensors) {
      init[s.areaId] = forwardedAreaIds.has(s.areaId) ? "forwarded" : "idle";
    }
    return init;
  });

  const handleNotifyStateChange = (areaId, newState) => {
    setNotifyStates(prev => ({ ...prev, [areaId]: newState }));
  };

  useEffect(() => {
    const next = {};
    for (const s of floor.sensors) {
      next[s.areaId] = forwardedAreaIds.has(s.areaId) ? "forwarded" : "idle";
    }
    setNotifyStates(next);
  }, [floor]);

  const activeSensors = floor.sensors.filter(s => getSensorStatus(s) === "active");

  const maintenanceSensors = floor.sensors
    .filter(s => getSensorStatus(s) === "maintenance")
    .sort((a, b) => {
      const aTime = parseUTC(a.maintenanceStartedAt)?.getTime() ?? 0;
      const bTime = parseUTC(b.maintenanceStartedAt)?.getTime() ?? 0;
      return aTime - bTime;
    });

  const flaggedSensors = floor.sensors
    .filter(s => {
      const st = getSensorStatus(s);
      return st !== "active" && st !== "maintenance";
    })
    .sort((a, b) => STATUS_PRIORITY[getSensorStatus(a)] - STATUS_PRIORITY[getSensorStatus(b)]);

   const counts = {};
    [...maintenanceSensors, ...flaggedSensors].forEach(s => {
      const st = getSensorStatus(s);
      counts[st] = (counts[st] || 0) + 1;
    });

  useEffect(() => {
    const handler = e => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 100,
      background: "rgba(0,0,0,.65)",
      display: "flex", flexDirection: "column",
      animation: "slideIn .18s ease",
    }}>
      <div style={{ flex: 1, background: "var(--card)", display: "flex", flexDirection: "column", overflow: "hidden" }}>

        <div style={{
          padding: "14px 24px", borderBottom: "1px solid var(--border)",
          background: "var(--card)", display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {isBreach && <BreachDot />}
            {!isBreach && !isAllGood && <StatusDot status={floorStatus} size={10} />}
            <span style={{ fontWeight: 700, fontSize: 18, color: "var(--foreground)" }}>{floor.label}</span>
            <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 8px", borderRadius: 5, background: cfg.color, color: "#fff" }}>{summary}</span>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 24, cursor: "pointer", color: "var(--muted-foreground)", lineHeight: 1, padding: "0 4px" }}>×</button>
        </div>

        <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
          <div style={{ flex: 1, overflow: "hidden", position: "relative", background: "var(--muted)" }}>
            <img src={floor.image} alt={floor.label}
              style={{ width: "100%", height: "100%", objectFit: "contain", display: "block", userSelect: "none" }} />
          </div>

          <div style={{
            width: 320, flexShrink: 0, borderLeft: "1px solid var(--border)",
            display: "flex", flexDirection: "column", overflow: "hidden",
            background: "var(--card)",
          }}>
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
                      <span key={st} style={{
                        display: "flex", alignItems: "center", gap: 5,
                        fontSize: 11, fontWeight: 700, padding: "3px 9px", borderRadius: 5,
                        background: STATUS_CONFIG[st].bg, color: STATUS_CONFIG[st].color,
                        border: `1px solid ${STATUS_CONFIG[st].color}40`,
                      }}>
                        <StatusDot status={st} size={6} />
                        {count} {STATUS_CONFIG[st].label}
                      </span>
                    ))}
                  </div>

                  <div style={{ fontSize: 11, fontWeight: 700, color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 12 }}>
                    Sensor Flags
                  </div>

                  {flaggedSensors.map((s, i) => (
                    <SensorStatusRow
                      key={s.id}
                      sensor={s}
                      index={i}
                      floorLabel={floor.label}
                      currentUser={currentUser}
                      notifyState={notifyStates[s.areaId]}
                      onNotifyStateChange={handleNotifyStateChange}
                    />
                  ))}

                  {maintenanceSensors.length > 0 && (
                    <>
                      <div style={{ fontSize: 11, fontWeight: 700, color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: ".08em", marginTop: 12, marginBottom: 8 }}>
                        Ongoing({maintenanceSensors.length})
                      </div>

                      {maintenanceSensors.map((s, i) => (
                        <MaintenanceStatusRow
                          key={s.id}
                          sensor={s}
                          index={i}
                        />
                      ))}
                    </>
                  )}

                  {activeSensors.length > 0 && (
                    <>
                      <div style={{ fontSize: 11, fontWeight: 700, color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: ".08em", marginTop: 12, marginBottom: 8 }}>
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

            <div style={{ padding: "12px 16px", borderTop: "1px solid var(--border)", background: "var(--card)" }}>
              <a href={floor.href}
                style={{ display: "block", textAlign: "center", padding: "10px", borderRadius: 5, background: "#435ebe", color: "#fff", fontWeight: 700, fontSize: 13, textDecoration: "none", cursor: "pointer", transition: "background .15s" }}
                onMouseEnter={e => { e.currentTarget.style.background = "#3347a8"; }}
                onMouseLeave={e => { e.currentTarget.style.background = "#435ebe"; }}>
                Open Full Map
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
        ? row.getValue("temp").toFixed(2) : "—",
  },
  {
    accessorKey: "humid",
    header: "Humidity (%)",
    cell: ({ row }) =>
      row.original.hasData && row.getValue("humid") !== null
        ? row.getValue("humid").toFixed(2) : "—",
  },
  {
    id: "tempLimits", header: "Temp Limits (°C)",
    cell: ({ row }) =>
      row.original.tempLL != null && row.original.tempUL != null
        ? `${row.original.tempLL} – ${row.original.tempUL}` : "—",
  },
  {
    id: "humidLimits", header: "Humid Limits (%)",
    cell: ({ row }) =>
      row.original.humidLL != null && row.original.humidUL != null
        ? `${row.original.humidLL} – ${row.original.humidUL}` : "—",
  },
  {
    id: "status", accessorFn: row => getSensorStatus(row), header: "Status",
    cell: ({ row }) => {
      const status = getSensorStatus(row.original);
      const cfg    = STATUS_CONFIG[status];
      return (
        <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 5, background: cfg.color, color: "#fff", textTransform: "uppercase", letterSpacing: ".04em" }}>
          {cfg.label}
        </span>
      );
    },
  },
  {
    accessorKey: "lastSeen", header: "Last Seen",
    cell: ({ row }) => row.original.lastSeen ?? "—",
  },
];


// ─────────────────────────────────────────────────────────────────────────────
// SECTION 7: MAIN PAGE
// ─────────────────────────────────────────────────────────────────────────────

export default function MonitoringPage() {
  const hasLiveData = (floorList) => floorList.some(f => f.sensors.some(s => s.hasData));
  const [floors,      setFloors]      = useState(floorsCache ?? ALL_FLOORS);
  const [activeFloor, setActiveFloor] = useState(null);
  const [loading,     setLoading]     = useState(!hasLiveData(floorsCache ?? ALL_FLOORS));
  const abortRef                      = useRef(null);

  // TODO: replace with real user from your auth context.
  // import { useAuth } from "@/hooks/useAuth";
  // const { user } = useAuth();
  const currentUser = null;

  // Seed forwardedAreaIds from active Facilities alerts.
  const syncForwardedAreaIds = async (signal) => {
    try {
      const res = await axios.get(`${API_BASE}/facilities/alerts`, {
        params: { status: ['open', 'acknowledged', 'verifying'] },
        paramsSerializer: (p) =>
          p.status.map(s => `status[]=${encodeURIComponent(s)}`).join('&'),
        signal,
      });

      forwardedAreaIds = new Set(res.data.data.map(alert => alert.areaId));
    } catch {
      // non-critical — keep current state if sync fails
    }
  };

  useEffect(() => {
    syncForwardedAreaIds();
  }, []);

  useEffect(() => {
    const handleStorage = (e) => {
      if (e.key === "facilitiesAlertSent" || e.key === "facilitiesAlertResolved") {
        syncForwardedAreaIds();
      }
    };

    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        syncForwardedAreaIds();
      }
    };

    window.addEventListener("storage", handleStorage);
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      window.removeEventListener("storage", handleStorage);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, []);

  useEffect(() => {
    const fetchAllFloors = async () => {
      if (abortRef.current) abortRef.current.abort();
      abortRef.current = new AbortController();
      const signal = abortRef.current.signal;

      try {
        if (Object.keys(statusCache).length === 0 || Date.now() - statusCacheTime > STATUS_CACHE_TTL_MS) {
          const statusResults = await Promise.all(
            ALL_FLOORS.map(floor =>
              axios.get(`${API_BASE}/sensors/status`, { params: { floor: FLOOR_SLUG[floor.id] }, signal })
                .then(res => res.data.data)
                .catch(() => [])
            )
          );
          statusResults.flat().forEach(d => { statusCache[d.areaId] = d.status; });
          statusCacheTime = Date.now();
          floorsCache = null;
        }

        await syncForwardedAreaIds(signal);

        const downtimeRes = await axios
          .get(`/api/temphumid/downtime/active`, { signal })
          .then(res => res.data.data)
          .catch(err => {
            if (axios.isCancel?.(err) || err?.name === "CanceledError") return null;
            return [];
          });

        if (downtimeRes === null) return;

        const downtimeByArea = {};
        downtimeRes.forEach(r => {
          downtimeByArea[r.area_id] = r;
        });

        const results = await Promise.all(
          ALL_FLOORS.map(floor =>
            axios.get(`${API_BASE}/sensors/readings/current`, { params: { floor: FLOOR_SLUG[floor.id] }, signal })
              .then(res => ({ floorId: floor.id, data: res.data.data }))
              .catch(err => {
                if (axios.isCancel?.(err) || err?.name === "CanceledError") return null;
                return { floorId: floor.id, data: [] };
              })
          )
        );

        if (results.some(r => r === null)) return;

        const liveByFloor = {};
        results.forEach(({ floorId, data }) => {
          liveByFloor[floorId] = {};
          data.forEach(d => { liveByFloor[floorId][d.areaId] = d; });
        });

                const newFloors = ALL_FLOORS.map(floor => ({
                  ...floor,
                  sensors: floor.sensors
                    .filter(sensor => statusCache[sensor.areaId] !== "Inactive")
                    .map(sensor => {
                      const live       = liveByFloor[floor.id]?.[sensor.areaId];
                      const downtime   = downtimeByArea[sensor.areaId] ?? null;
                      const isInactive = INACTIVE_AREAS.has(sensor.areaId);

                      if (!live) {
                        return {
                          ...sensor,
                          hasData: false,
                          breach: false,
                          temp: null,
                          humid: null,
                          lastSeen: null,
                          limits: null,
                          maintenanceOngoing: !!downtime,
                          maintenanceStartedAt: downtime?.processed_at ?? null,
                          maintenanceRecordId: downtime?.id ?? null,
                        };
                      }

                      const breach = live.status === "breach" && !isInactive && !downtime;

                      return {
                        ...sensor,
                        temp:    live.temperature,
                        humid:   live.humidity,
                        hasData: live.hasData,
                        lastSeen: live.lastSeen,
                        breach,
                        limits:  live.limits,
                        tempUL:  live.limits?.tempUL  ?? null,
                        tempLL:  live.limits?.tempLL  ?? null,
                        humidUL: live.limits?.humidUL ?? null,
                        humidLL: live.limits?.humidLL ?? null,
                        maintenanceOngoing: !!downtime,
                        maintenanceStartedAt: downtime?.processed_at ?? null,
                        maintenanceRecordId: downtime?.id ?? null,
                      };
                    }),
                }));

        floorsCache = newFloors;
        setFloors(newFloors);
        if (hasLiveData(newFloors)) setLoading(false);
        setActiveFloor(prev => {
          if (!prev) return null;
          const nextFloor = newFloors.find(f => f.id === prev.id) ?? prev;
          return nextFloor;
        });
      } catch (err) {
        console.error("Failed to fetch monitoring data:", err);
      }
    };

    fetchAllFloors();
    const interval = setInterval(() => fetchAllFloors(), 30_000);
    return () => { clearInterval(interval); if (abortRef.current) abortRef.current.abort(); };
  }, []);

  const tableData = floors.flatMap(floor =>
    floor.sensors.map(sensor => ({
      id: `${floor.id}__${sensor.id}`, floor: floor.label, name: sensor.name,
      temp: sensor.temp ?? null, humid: sensor.humid ?? null,
      hasData: sensor.hasData ?? false, breach: sensor.breach ?? false,
      lastSeen: sensor.lastSeen ?? null,
      tempUL: sensor.tempUL ?? null, tempLL: sensor.tempLL ?? null,
      humidUL: sensor.humidUL ?? null, humidLL: sensor.humidLL ?? null,
    }))
  );

  const breachFloorCount = floors.filter(f => getFloorStatus(f) === "breach").length;

  return (
    <>
      <style>{GLOBAL_STYLES}</style>
      {loading && <LoadingOverlay />}

      <div style={{ minHeight: "100vh", overflowX: "hidden" }}>
        <div style={{ padding: "14px 24px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div className="bg-background mt-2.5">
            <h1 className="text-2xl font-bold">Monitoring</h1>
            <p className="text-muted-foreground mt-1">
              {loading ? "Loading live data…" : `Live status across all floors · ${breachFloorCount} floor${breachFloorCount !== 1 ? "s" : ""} in breach`}
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
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 20 }}>
            {loading
              ? Array.from({ length: ALL_FLOORS.length }).map((_, i) => <CardSkeleton key={i} />)
              : floors.map(floor => (
                  <FloorCard key={floor.id} floor={floor} onClick={f => setActiveFloor(floors.find(x => x.id === f.id) ?? f)} />
                ))
            }
          </div>

          <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 5, padding: "20px 24px" }}>
            <p className="font-bold mb-4">Activity Log</p>
            {tableData.length === 0
              ? <p className="text-sm text-muted-foreground text-center" style={{ padding: "24px 0" }}>No sensor data available.</p>
              : <DataTable columns={SENSOR_TABLE_COLUMNS} data={tableData} />
            }
          </div>
        </div>
      </div>

      {activeFloor && (
        <FloorModal
          floor={activeFloor}
          onClose={() => setActiveFloor(null)}
          currentUser={currentUser}
        />
      )}
    </>
  );
}