"use client";

// ─────────────────────────────────────────────────────────────────────────────
// /temphumid-facilities/page.jsx — Facilities Breach Alert Dashboard
//
// Flow:
//   acknowledged → [Open] → open
//   open → [Verify] → select action + remarks → [Verify] → verifying → resolved or bounce to open
//   open → [Schedule for maintenance] → remarks + [Confirm] → open (badge: Maintenance)
//   open (scheduled) → [Verify after maintenance] → remarks + [Verify] → verifying → resolved or bounce
//   open (scheduled) → [Cancel maintenance] → back to open (no badge)
//
// DB writes:
//   schedule   → PATCH /schedule    → sets action_type=schedule_repair, NO action log row
//   unschedule → PATCH /unschedule  → clears action_type, NO action log row
//   verify     → PATCH /verify      → sets verified_by/at, moves to verifying, inserts action log row
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useCallback, useRef } from "react";
import React from "react";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/custom/DataTable";
import { DashboardCard } from "@/components/custom/DashboardCard";
import { CustomModal } from "@/components/custom/CustomModal";
import { TriangleAlert, BellRing, Clock, CheckCheck } from "lucide-react";
import axios from "@/lib/axios";

const API_BASE = "/api/temphumid";

// Module-level cache — persists across navigations
let alertsCache = null;

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 1: CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

// Picker options — schedule_repair is NOT here, it has its own button
const ACTION_OPTIONS = [
  { value: "adjust_temp",  label: "Adjust temperature" },
  { value: "adjust_humid", label: "Adjust humidity"    },
  { value: "others",       label: "Others"             },
];

// Display labels for all action types including schedule_repair
const ACTION_LABELS = {
  adjust_temp:     "Adjust temperature",
  adjust_humid:    "Adjust humidity",
  schedule_repair: "Scheduled for maintenance",
  others:          "Others",
};

const ESCALATION_THRESHOLD_MINS = 120;
const NO_READING_WARN_MINS = 45;


const ACTIVE_COLUMNS = [
  { key: "acknowledged", label: "Acknowledged", accent: "#dc2626", dot: "#dc2626" },
  { key: "open",         label: "Open",         accent: "#f59e0b", dot: "#f59e0b" },
];

const SPINNER_STYLE = `
  @keyframes dotPulse   { 0%,100%{opacity:1} 50%{opacity:.25} }
  @keyframes spinLoader { to { transform: rotate(360deg); } }
  @keyframes slideDown  {
    from { opacity: 0; transform: translateY(-6px); }
    to   { opacity: 1; transform: translateY(0); }
  }
`;


// ─────────────────────────────────────────────────────────────────────────────
// SECTION 2: UTILITY
// ─────────────────────────────────────────────────────────────────────────────

function parseUTC(isoString) {
  if (!isoString) return null;
  if (isoString.includes("Z") || isoString.includes("+")) return new Date(isoString);
  return new Date(isoString.replace(" ", "T") + "+08:00");
}

function minutesSince(isoString) {
  const d = parseUTC(isoString);
  if (!d) return 0;
  return Math.floor((Date.now() - d.getTime()) / 60000);
}

function formatRelative(isoString) {
  if (!isoString) return "—";
  const mins = minutesSince(isoString);
  if (mins < 1)  return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  const rem = mins % 60;
  return rem > 0 ? `${hrs}h ${rem}m ago` : `${hrs}h ago`;
}

function formatAbsolute(isoString) {
  const d = parseUTC(isoString);
  if (!d) return "—";
  return d.toLocaleString("en-PH", {
    month: "short", day: "numeric",
    hour: "2-digit", minute: "2-digit", hour12: true,
    timeZone: "Asia/Manila",
  });
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

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 3: LOADING OVERLAY
// ─────────────────────────────────────────────────────────────────────────────

function LoadingOverlay() {
  return (
    <>
      <style>{SPINNER_STYLE}</style>
      <div style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(0,0,0,.55)", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ background: "var(--card)", borderRadius: 10, padding: "36px 48px", display: "flex", flexDirection: "column", alignItems: "center", gap: 20, boxShadow: "0 8px 40px rgba(0,0,0,.18)", minWidth: 260 }}>
          <div style={{ width: 44, height: 44, borderRadius: "50%", border: "4px solid var(--border)", borderTop: "4px solid #435ebe", animation: "spinLoader 0.8s linear infinite" }} />
          <div style={{ textAlign: "center" }}>
            <p style={{ fontWeight: 700, fontSize: 15, color: "var(--foreground)", margin: 0 }}>Loading alerts…</p>
            <p style={{ fontSize: 12, color: "var(--muted-foreground)", marginTop: 6 }}>Fetching the latest breach alerts</p>
          </div>
        </div>
      </div>
    </>
  );
}


// ─────────────────────────────────────────────────────────────────────────────
// SECTION 4: SCHEDULE FORM
// Shown when user clicks "Schedule for maintenance" — remarks + Confirm/Cancel
// Does NOT insert an action log row. Calls PATCH /schedule.
// ─────────────────────────────────────────────────────────────────────────────

function ScheduleForm({ alertId, onSubmit, onCancel }) {
  const [remarks,    setRemarks]    = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error,      setError]      = useState("");

  const handleConfirm = async () => {
    setSubmitting(true);
    setError("");
    try {
      const res = await axios.patch(
        `${API_BASE}/facilities/alerts/${alertId}/schedule`,
        { actionRemarks: remarks.trim() || null }
      );
      onSubmit(res.data.data);
    } catch (err) {
      setError(err.response?.data?.message ?? "Failed to schedule. Please try again.");
      setSubmitting(false);
    }
  };

  return (
    <div style={{
      marginTop: 10, padding: "10px",
      background: "var(--background)", border: "1px solid var(--border)", borderRadius: 6,
      animation: "slideDown .15s ease",
    }}>
      <p style={{ fontSize: 10, fontWeight: 700, color: "var(--muted-foreground)", margin: "0 0 7px", textTransform: "uppercase", letterSpacing: ".06em" }}>
        Schedule for maintenance
      </p>
      <textarea
        placeholder="Insert maintenance details or remarks"
        value={remarks}
        onChange={e => setRemarks(e.target.value)}
        rows={2}
        style={{
          width: "100%", padding: "5px 8px", borderRadius: 4, fontSize: 11,
          resize: "vertical", boxSizing: "border-box", fontFamily: "inherit", outline: "none",
          border: `1px solid ${error ? "#dc3545" : "var(--border)"}`,
          background: "var(--card)", color: "var(--foreground)",
          marginBottom: error ? 4 : 7, transition: "border-color .15s",
        }}
        onFocus={e => { if (!error) e.target.style.borderColor = "#435ebe"; }}
        onBlur={e  => { if (!error) e.target.style.borderColor = "var(--border)"; }}
      />
      {error && <p style={{ fontSize: 10, color: "#dc3545", margin: "0 0 5px" }}>{error}</p>}
      <div style={{ display: "flex", gap: 5 }}>
        <Button variant="default" size="sm" className="cursor-pointer flex-1" style={{ fontSize: 11, height: 28 }} disabled={submitting} onClick={handleConfirm}>
          {submitting ? "Scheduling…" : "Confirm"}
        </Button>
        <Button variant="outline" size="sm" className="cursor-pointer" style={{ fontSize: 11, height: 28 }} disabled={submitting} onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
}


// ─────────────────────────────────────────────────────────────────────────────
// SECTION 5: VERIFY FORM
// Shown when user clicks "Verify" or "Verify after maintenance".
// Always inserts an action log row. Calls PATCH /verify.
// lockedActionType = "schedule_repair" hides the action chips (maintenance path).
// ─────────────────────────────────────────────────────────────────────────────

function VerifyForm({ alertId, initialActionType, initialActionRemarks, lockedActionType, onSubmit, onCancel, onConflict }) {
  const [actionType,    setActionType]    = useState(lockedActionType ?? initialActionType ?? "");
  const [actionRemarks, setActionRemarks] = useState(initialActionRemarks ?? "");
  const [submitting,    setSubmitting]    = useState(false);
  const [error,         setError]         = useState("");

  const handleSubmit = async () => {
    if (!actionType) { setError("Please select an action type."); return; }
    if (actionType === "others" && !actionRemarks.trim()) {
      setError("Please describe the action taken.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const res = await axios.patch(
        `${API_BASE}/facilities/alerts/${alertId}/verify`,
        { actionType, actionRemarks: actionRemarks.trim() || null }
      );
      onSubmit(res.data.data);
    } catch (err) {
      if (err.response?.status === 409) {
        setError("Already actioned by someone else. Refreshing…");
        setTimeout(() => onConflict?.(), 800);
      } else {
        setError(err.response?.data?.message ?? "Failed to submit. Please try again.");
        setSubmitting(false);
      }
    }
  };

  return (
    <div style={{
      marginTop: 10, padding: "10px",
      background: "var(--background)", border: "1px solid var(--border)", borderRadius: 6,
      animation: "slideDown .15s ease",
    }}>
      <p style={{ fontSize: 10, fontWeight: 700, color: "var(--muted-foreground)", margin: "0 0 7px", textTransform: "uppercase", letterSpacing: ".06em" }}>
        {lockedActionType ? "Confirm maintenance verification" : "Action taken"}
      </p>

      {/* Action chips — hidden when locked to schedule_repair */}
      {!lockedActionType && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 7 }}>
          {ACTION_OPTIONS.map(opt => {
            const active = actionType === opt.value;
            return (
              <button
                key={opt.value}
                onClick={() => { setActionType(opt.value); setError(""); }}
                style={{
                  padding: "3px 9px", borderRadius: 4, fontSize: 11, cursor: "pointer",
                  border: `1.5px solid ${active ? "#435ebe" : "var(--border)"}`,
                  background: active ? "#435ebe" : "transparent",
                  color: active ? "#fff" : "var(--foreground)",
                  transition: "all .1s",
                }}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      )}

      <textarea
        placeholder={actionType === "others" ? "Required: describe the action…" : "Insert details or remarks"}
        value={actionRemarks}
        onChange={e => setActionRemarks(e.target.value)}
        rows={2}
        style={{
          width: "100%", padding: "5px 8px", borderRadius: 4, fontSize: 11,
          resize: "vertical", boxSizing: "border-box", fontFamily: "inherit", outline: "none",
          border: `1px solid ${error ? "#dc3545" : "var(--border)"}`,
          background: "var(--card)", color: "var(--foreground)",
          marginBottom: error ? 4 : 7, transition: "border-color .15s",
        }}
        onFocus={e => { if (!error) e.target.style.borderColor = "#435ebe"; }}
        onBlur={e  => { if (!error) e.target.style.borderColor = "var(--border)"; }}
      />
      {error && <p style={{ fontSize: 10, color: "#dc3545", margin: "0 0 5px" }}>{error}</p>}
      <div style={{ display: "flex", gap: 5 }}>
        <Button variant="default" size="sm" className="cursor-pointer flex-1" style={{ fontSize: 11, height: 28 }} disabled={submitting} onClick={handleSubmit}>
          {submitting ? "Submitting…" : "Verify"}
        </Button>
        <Button variant="outline" size="sm" className="cursor-pointer" style={{ fontSize: 11, height: 28 }} disabled={submitting} onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
}


// ─────────────────────────────────────────────────────────────────────────────
// SECTION 6: ALERT CARD
// ─────────────────────────────────────────────────────────────────────────────

// ─── BreachBadge ─────────────────────────────────────────────────────────────
 
function BreachBadge({ label }) {
  return (
    <span style={{
      fontSize: 10, fontWeight: 700, padding: "1px 6px", borderRadius: 4,
      background: "#fee2e2", color: "#b91c1c", border: "1px solid #fca5a5",
      letterSpacing: ".04em", whiteSpace: "nowrap",
    }}>
      {label}
    </span>
  );
}

// ─── BreachReadingsPanel ──────────────────────────────────────────────────────
 
export function BreachReadingsPanel({ alertId, compact = false }) {
  // compact=true  → used inside AlertCard (narrower, less padding)
  // compact=false → used inside the resolved modal (full width)
 
  const [open,    setOpen]    = useState(false);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState(null);
  const [rows,    setRows]    = useState([]);
  const [meta,    setMeta]    = useState(null); // { currentPage, lastPage, total, hasMore }
  const [page,    setPage]    = useState(1);
 
  const fetchPage = useCallback(async (targetPage) => {
    setLoading(true);
    setError(null);
    try {
      const res = await axios.get(
        `${API_BASE}/facilities/alerts/${alertId}/breach-events`,
        { params: { page: targetPage } }
      );
      setRows(res.data.data);
      setMeta(res.data.meta);
      setPage(targetPage);
    } catch (err) {
      setError(err.response?.data?.message ?? "Failed to load breach history.");
    } finally {
      setLoading(false);
    }
  }, [alertId]);
  useEffect(() => { fetchPage(1); }, [fetchPage]);
  const handleToggle = () => {
    if (!open && rows.length === 0 && !loading) {
      fetchPage(1);
    }
    setOpen(v => !v);
  };
 
  const isEmpty = !loading && !error && rows.length === 0 && meta !== null;
 
  return (
    <div style={{ marginTop: compact ? 10 : 0 }}>
 
      {/* ── Toggle button ── */}
      <button
        onClick={handleToggle}
        style={{
          display: "flex", alignItems: "center", gap: 6,
          background: "none", border: "none", cursor: "pointer", padding: 0,
          color: "var(--foreground)", width: "100%",
        }}
      >
        <span style={{
          fontSize: compact ? 11 : 12,
          fontWeight: 700,
          color: "var(--muted-foreground)",
          textTransform: "uppercase",
          letterSpacing: ".06em",
        }}>
          Incident Log
          {meta?.total != null && meta.total > 0 && (
            <span style={{
              marginLeft: 6, fontSize: 10, fontWeight: 700,
              padding: "1px 6px", borderRadius: 10,
              background: "#fee2e2", color: "#b91c1c",
            }}>
              {meta.total}
            </span>
          )}
        </span>
      </button>
 
      {/* ── Panel body ── */}
      {open && (
        <div style={{ marginTop: 8 }}>
 
          {/* Loading */}
          {loading && (
            <p style={{ fontSize: 12, color: "var(--muted-foreground)", margin: 0 }}>
              Loading…
            </p>
          )}
 
          {/* Error */}
          {error && !loading && (
            <div style={{
              fontSize: 11, color: "#b91c1c", padding: "6px 10px",
              background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: 5,
            }}>
              {error}
              <button
                onClick={() => fetchPage(page)}
                style={{ marginLeft: 8, fontSize: 11, color: "#b91c1c", cursor: "pointer", background: "none", border: "none", textDecoration: "underline", padding: 0 }}
              >
                Retry
              </button>
            </div>
          )}
 
          {/* Empty state */}
          {isEmpty && (
            <p style={{ fontSize: 12, color: "var(--muted-foreground)", margin: 0, fontStyle: "italic" }}>
              No breach readings recorded after this alert was acknowledged.
            </p>
          )}
 
          {/* Table */}
          {!loading && rows.length > 0 && (
            <>
              <div style={{ overflowX: "auto" }}>
                <table style={{
                  width: "100%", borderCollapse: "collapse",
                  fontSize: compact ? 11 : 12,
                }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid var(--border)" }}>
                      {["Time", "Temp (°C)", "Humid (%)", "Temp Limit", "Humid Limit", "Breached"].map(h => (
                        <th key={h} style={{
                          padding: compact ? "4px 6px" : "6px 10px",
                          textAlign: "left", fontWeight: 700,
                          color: "var(--muted-foreground)", whiteSpace: "nowrap",
                          fontSize: 10, textTransform: "uppercase", letterSpacing: ".05em",
                        }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, i) => (
                      <tr
                        key={i}
                        style={{
                          borderBottom: "1px solid var(--border)",
                          background: i % 2 === 0 ? "transparent" : "var(--muted)",
                        }}
                      >
                        {/* Time */}
                        <td style={{ padding: compact ? "4px 6px" : "6px 10px", whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>
                          {formatAbsolute(row.readingAt)}
                        </td>
 
                        {/* Temp */}
                        <td style={{
                          padding: compact ? "4px 6px" : "6px 10px",
                          fontWeight: row.breached.temp ? 700 : 400,
                          color: row.breached.temp ? "#b91c1c" : "var(--foreground)",
                          fontVariantNumeric: "tabular-nums",
                        }}>
                          {row.temperature.toFixed(2)}
                        </td>
 
                        {/* Humid */}
                        <td style={{
                          padding: compact ? "4px 6px" : "6px 10px",
                          fontWeight: row.breached.humid ? 700 : 400,
                          color: row.breached.humid ? "#b91c1c" : "var(--foreground)",
                          fontVariantNumeric: "tabular-nums",
                        }}>
                          {row.humidity.toFixed(2)}
                        </td>
 
                        {/* Temp Limit */}
                        <td style={{ padding: compact ? "4px 6px" : "6px 10px", color: "var(--muted-foreground)", whiteSpace: "nowrap" }}>
                          {row.limits.tempLL}–{row.limits.tempUL}
                        </td>
 
                        {/* Humid Limit */}
                        <td style={{ padding: compact ? "4px 6px" : "6px 10px", color: "var(--muted-foreground)", whiteSpace: "nowrap" }}>
                          {row.limits.humidLL}–{row.limits.humidUL}
                        </td>
 
                        {/* Breached badges */}
                        <td style={{ padding: compact ? "4px 6px" : "6px 10px" }}>
                          <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                            {row.breached.temp  && <BreachBadge label="Temp"  />}
                            {row.breached.humid && <BreachBadge label="Humid" />}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
 
              {/* Pagination */}
              {meta && meta.lastPage > 1 && (
                <div style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  marginTop: 8, paddingTop: 8, borderTop: "1px solid var(--border)",
                }}>
                  <span style={{ fontSize: 11, color: "var(--muted-foreground)" }}>
                    Page {meta.currentPage} of {meta.lastPage} · {meta.total} total
                  </span>
                  <div style={{ display: "flex", gap: 4 }}>
                    <Button
                      variant="outline" size="sm"
                      style={{ fontSize: 11, height: 26, padding: "0 10px" }}
                      disabled={meta.currentPage <= 1 || loading}
                      onClick={() => fetchPage(meta.currentPage - 1)}
                    >
                      Prev
                    </Button>
                    <Button
                      variant="outline" size="sm"
                      style={{ fontSize: 11, height: 26, padding: "0 10px" }}
                      disabled={!meta.hasMore || loading}
                      onClick={() => fetchPage(meta.currentPage + 1)}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function AlertCard({ alert, col, onAcknowledge, onResolve, onConflict }) {
  const [expanded,        setExpanded]        = useState(false);
  const [activeForm,      setActiveForm]      = useState(null); // null | "verify" | "schedule"
  const [acting,          setActing]          = useState(false);
  const [actionError,     setActionError]     = useState("");

  const isAcknowledged = alert.status === "acknowledged";
  const isOpen         = alert.status === "open";
  const isVerifying    = alert.status === "verifying";
  const isScheduled    = alert.actionType === "schedule_repair";
  const isMaintenanceOngoing = !!alert.maintenanceOngoing;
  const elapsed              = useElapsed(alert.maintenanceStartedAt);

  const minutesDelayed  = minutesSince(alert.acknowledgedAt);
  const isEscalated     = isAcknowledged && minutesDelayed >= ESCALATION_THRESHOLD_MINS;
  const backendCount    = Number(alert.escalationCount || 0);
  const frontendCount   = Math.floor(minutesDelayed / ESCALATION_THRESHOLD_MINS);
  const escalationCount = Math.max(backendCount, frontendCount);
  const delayedHours    = escalationCount * (ESCALATION_THRESHOLD_MINS / 60);
  const delayedLabel    = isEscalated ? `Delayed for ${delayedHours} hours` : "";

  const closeForm = () => setActiveForm(null);

  const handleAcknowledge = async () => {
    setActing(true);
    setActionError("");
    try {
      const res = await axios.patch(`${API_BASE}/facilities/alerts/${alert.id}/acknowledge`);
      onAcknowledge(res.data.data);
    } catch (err) {
      if (err.response?.status === 409) {
        setActionError("Already actioned by someone else. Refreshing…");
        onConflict();
      } else {
        setActionError(err.response?.data?.message ?? "Failed to open. Please try again.");
        setActing(false);
      }
    }
  };

  const handleUnschedule = async () => {
    setActing(true);
    setActionError("");
    try {
      const res = await axios.patch(`${API_BASE}/facilities/alerts/${alert.id}/unschedule`);
      onResolve(res.data.data);
    } catch (err) {
      setActionError(err.response?.data?.message ?? "Failed to cancel maintenance.");
    } finally {
      setActing(false);
    }
  };

  return (
    <div style={{
      background: "var(--card)",
      border: "1px solid var(--border)",
      borderLeft: `3px solid ${isEscalated ? "#dc2626" : col.accent}`,
      borderRadius: 6,
      overflow: "hidden",
      opacity: acting ? 0.6 : 1,
      transition: "opacity .15s",
    }}>
      {/* Card header — always visible, click to expand */}
      <div
        onClick={() => !acting && setExpanded(v => !v)}
        style={{ padding: "10px 12px", cursor: acting ? "default" : "pointer", userSelect: "none" }}
      >
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 6 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
            <span style={{
              width: 7, height: 7, borderRadius: "50%", flexShrink: 0,
              background: isEscalated ? "#dc2626" : col.dot,
              display: "inline-block",
              animation: (isEscalated && isAcknowledged) ? "dotPulse 1.4s ease-in-out infinite" : "none",
            }} />
            <span style={{ fontSize: 13, fontWeight: 600, color: "var(--foreground)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {alert.lineName}
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
            {/* Action type badge — yellow for all action types */}
            {(isOpen || isVerifying) && (
              <>
                {isMaintenanceOngoing ? (
                  <>
                    <span style={{
                      fontSize: 11, fontWeight: 800, padding: "0px 5px", borderRadius: 5, flexShrink: 0,
                      background: "#fef3c7", color: "#92400e", border: "1px solid #fcd34d",
                      letterSpacing: ".04em",
                    }}>
                      Maintenance (ongoing)
                    </span>
                    <span style={{
                      fontSize: 11,
                      fontWeight: 700,
                      fontFamily: "monospace",
                      color: "#92400e",
                      flexShrink: 0,
                    }}>
                      {formatTimer(elapsed)}
                    </span>
                  </>
                ) : (
                  alert.actionType && (
                    <span style={{
                      fontSize: 11, fontWeight: 800, padding: "0px 5px", borderRadius: 5, flexShrink: 0,
                      background: "#fef3c7", color: "#92400e", border: "1px solid #fcd34d",
                      letterSpacing: ".04em",
                    }}>
                      {ACTION_LABELS[alert.actionType] ?? alert.actionType}
                    </span>
                  )
                )}
              </>
            )}
            {/* Verifying badge */}
            {isVerifying && (
              <span style={{
                fontSize: 11, fontWeight: 800, padding: "0px 5px", borderRadius: 5, flexShrink: 0,
                background: minutesSince(alert.verifiedAt) >= NO_READING_WARN_MINS ? "#fef2f2" : "#eff6ff",
                color:      minutesSince(alert.verifiedAt) >= NO_READING_WARN_MINS ? "#b91c1c" : "#1d4ed8",
                border:     minutesSince(alert.verifiedAt) >= NO_READING_WARN_MINS ? "1px solid #fca5a5" : "1px solid #bfdbfe",
                letterSpacing: ".04em",
              }}>
                {minutesSince(alert.verifiedAt) >= NO_READING_WARN_MINS ? "Verifying · No reading" : "Verifying..."}
              </span>
            )}
            {/* Delayed badge */}
            {isEscalated && (
              <span style={{
                fontSize: 11, fontWeight: 800, padding: "0px 5px", borderRadius: 5, flexShrink: 0,
                background: "#fee2e2", color: "#dc2626", border: "1px solid #fca5a5",
                letterSpacing: ".04em",
              }}>
                {delayedLabel}
              </span>
            )}
          </div>
        </div>
        <div style={{ paddingLeft: 13, marginTop: 3, display: "flex", flexDirection: "column", gap: 1 }}>
          <span style={{ fontSize: 11, color: "var(--muted-foreground)" }}>{alert.areaId}</span>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: 11, color: "var(--muted-foreground)", fontVariantNumeric: "tabular-nums" }}>
              {alert.temperature?.toFixed(1)}°C · {alert.humidity?.toFixed(1)}%
            </span>
            <span style={{ fontSize: 11, color: "var(--muted-foreground)" }}>
              {formatRelative(alert.acknowledgedAt)}
            </span>
          </div>
        </div>
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div style={{ borderTop: "1px solid var(--border)", padding: "10px 12px", background: "var(--card)" }}>

          {/* Info rows */}
          <div style={{ fontSize: 11, color: "var(--muted-foreground)", display: "flex", flexDirection: "column", gap: 3, marginBottom: 10 }}>
            <div>
              <span style={{ fontWeight: 600, color: "var(--foreground)" }}>Temp</span>{" "}
              {alert.temperature?.toFixed(2)}°C
              <span style={{ opacity: .65, marginLeft: 3 }}>({alert.tempLL}–{alert.tempUL}°C)</span>
            </div>
            <div>
              <span style={{ fontWeight: 600, color: "var(--foreground)" }}>Humid</span>{" "}
              {alert.humidity?.toFixed(2)}%
              <span style={{ opacity: .65, marginLeft: 3 }}>({alert.humidLL}–{alert.humidUL}%)</span>
            </div>
            <div style={{ marginTop: 3 }}>
              Acknowledged by <strong style={{ color: "var(--foreground)" }}>{alert.acknowledgedBy}</strong>
              <br /><span>{formatAbsolute(alert.acknowledgedAt)}</span>
            </div>
            {alert.openedBy && (
              <div>
                Opened by <strong style={{ color: "var(--foreground)" }}>{alert.openedBy}</strong>
                <br /><span>{formatAbsolute(alert.openedAt)}</span>
              </div>
            )}
            {/* Only show verifiedBy if it's set — means an actual verify was submitted */}
            {alert.verifiedBy && (
              <div>
                Verified by <strong style={{ color: "var(--foreground)" }}>{alert.verifiedBy}</strong>
                <br /><span>{formatAbsolute(alert.verifiedAt)}</span>
              </div>
            )}
            
          {/* The Breach History */}
          <div style={{ marginTop: 5, marginBottom: 5, borderTop: "1px solid var(--border)"}}>
            <BreachReadingsPanel alertId={alert.id} compact={true} />
          </div>
          
          {/* The Manual Divider */}
            <div style={{ borderTop: "1px solid var(--border)"}} />
          </div>

          {actionError && (
            <p style={{ fontSize: 11, color: "#b45309", margin: "0 0 6px", background: "#fff7ed", border: "1px solid #f59e0b44", borderRadius: 4, padding: "4px 8px" }}>
              {actionError}
            </p>
          )}

          {/* ── ACKNOWLEDGED state ── */}
          {isAcknowledged && (
            <Button
              variant="outline" size="sm" className="cursor-pointer w-full"
              style={{ fontSize: 11, height: 30 }}
              disabled={acting}
              onClick={handleAcknowledge}
            >
              {acting ? "Opening…" : "Open"}
            </Button>
          )}

          {/* ── OPEN state ── */}
          {isOpen && (() => {

            // Form is open — show it, nothing else
            if (activeForm === "verify") {
              return (
                <VerifyForm
                  alertId={alert.id}
                  lockedActionType={isScheduled ? "schedule_repair" : null}
                  initialActionType={!isScheduled ? (alert.actionType ?? "") : ""}
                  initialActionRemarks={alert.actionRemarks ?? ""}
                  onConflict={onConflict}
                  onSubmit={(updatedAlert) => { closeForm(); onResolve(updatedAlert); }}
                  onCancel={closeForm}
                />
              );
            }

            if (activeForm === "schedule") {
              return (
                <ScheduleForm
                  alertId={alert.id}
                  onSubmit={(updatedAlert) => { closeForm(); onResolve(updatedAlert); }}
                  onCancel={closeForm}
                />
              );
            }

            // Scheduled for maintenance state
            if (isScheduled) {
                return (
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {alert.verifyAttemptCount > 0 && (
                      <p style={{ fontSize: 11, color: "#b45309", margin: 0 }}>
                        Previous verification failed — sensor still breaching.
                      </p>  
                    )}
                    <p style={{ fontSize: 11, color: "var(--muted-foreground)", margin: 0 }}>
                      Complete maintenance, then verify the sensor is back within limits.
                    </p>
                  <Button
                    variant="default" size="sm" className="cursor-pointer w-full"
                    style={{ fontSize: 11, height: 30 }}
                    disabled={acting}
                    onClick={() => setActiveForm("verify")}
                  >
                    Verify Post-Maintenance
                  </Button>
                  <Button
                    variant="outline" size="sm" className="cursor-pointer w-full"
                    style={{ fontSize: 11, height: 30, color: "var(--foreground)", borderColor: "var(--border)" }}
                    disabled={acting}
                    onClick={handleUnschedule}
                  >
                    Cancel maintenance
                  </Button>
                </div>
              );
            }

            // Fresh open OR bounced back from failed verify
            return (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {/* Prior action badge + bounce context if bounced back */}
                {alert.actionType && (
                  <>
                    <span style={{
                      fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 20,
                      background: "#eff6ff", color: "#1d4ed8", border: "1px solid #bfdbfe",
                      alignSelf: "flex-start",
                    }}>
                      {ACTION_LABELS[alert.actionType] ?? alert.actionType}
                    </span>
                    <p style={{ fontSize: 11, color: "#b45309", margin: 0 }}>
                      Previous verification failed — sensor still breaching. Try again or schedule for maintenance.
                    </p>
                  </>
                )}
                {/* Fresh open — no prior action */}
                {!alert.actionType && (
                  <p style={{ fontSize: 11, color: "var(--muted-foreground)", margin: 0 }}>
                    No action taken yet. Verify the sensor or schedule for maintenance.
                  </p>
                )}
                <Button
                  variant="default" size="sm" className="cursor-pointer w-full"
                  style={{ fontSize: 11, height: 30 }}
                  disabled={acting}
                  onClick={() => setActiveForm("verify")}
                >
                  Verify
                </Button>
                {/* Schedule button always available when not already scheduled */}
                <Button
                  variant="outline" size="sm" className="cursor-pointer w-full"
                  style={{ fontSize: 11, height: 30 }}
                  disabled={acting}
                  onClick={() => setActiveForm("schedule")}
                >
                  Schedule for maintenance
                </Button>
              </div>
            );
          })()}

          {/* ── VERIFYING state ── */}
          {isVerifying && (() => {
            const minsWaiting = minutesSince(alert.verifiedAt);
            const isStale     = minsWaiting >= NO_READING_WARN_MINS;

            return (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <Button
                  variant="outline" size="sm" className="cursor-pointer w-full"
                  style={{
                    fontSize: 11, height: 30,
                    borderColor: isStale ? "#fca5a5" : "#bfdbfe",
                    color:       isStale ? "#b91c1c" : "var(--foreground)",
                    background:  isStale ? "#fef2f2" : "transparent",
                  }}
                  disabled
                >
                  {isStale
                    ? `No reading received · ${minsWaiting}m waiting`
                    : "Waiting for the next reading…"}
                </Button>
                {isStale && (
                  <p style={{
                    fontSize: 10, color: "#b91c1c", margin: 0,
                    padding: "4px 8px", borderRadius: 4,
                    background: "#fef2f2", border: "1px solid #fca5a544",
                  }}>
                    No post-verification reading in {minsWaiting}m. Sensor may be offline or disconnected.
                  </p>
                )}
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
}


// ─────────────────────────────────────────────────────────────────────────────
// SECTION 7: KANBAN COLUMN
// ─────────────────────────────────────────────────────────────────────────────

function KanbanColumn({ col, alerts, onAcknowledge, onResolve, onConflict }) {
  return (
    <div style={{
      flex: 1, minWidth: 0, display: "flex", flexDirection: "column",
      background: "var(--card)", border: "1px solid var(--border)",
      borderRadius: 8, overflow: "hidden",
    }}>
      <div style={{
        padding: "12px 16px",
        borderBottom: "1px solid var(--border)",
        display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ width: 8, height: 8, borderRadius: "50%", background: col.dot, display: "inline-block", flexShrink: 0 }} />
          <span style={{ fontSize: 13, fontWeight: 700, color: "var(--foreground)" }}>{col.label}</span>
        </div>
        <span style={{
          fontSize: 11, fontWeight: 700, color: "var(--foreground)",
          background: "var(--muted)", borderRadius: 5, padding: "1px 8px",
        }}>
          {alerts.length}
        </span>
      </div>
      <div style={{
        flex: 1, overflowY: "auto", padding: "10px",
        display: "flex", flexDirection: "column", gap: 8,
        minHeight: 200,
      }}>
        {alerts.length === 0 ? (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "40px 12px", flex: 1 }}>
            <p style={{ fontSize: 12, color: "var(--muted-foreground)", textAlign: "center", margin: 0 }}>
              No {col.label.toLowerCase()} alerts
            </p>
          </div>
        ) : (
          alerts.map(alert => (
            <AlertCard
              key={alert.id}
              alert={alert}
              col={col}
              onAcknowledge={onAcknowledge}
              onResolve={onResolve}
              onConflict={onConflict}
            />
          ))
        )}
      </div>
    </div>
  );
}


// ─────────────────────────────────────────────────────────────────────────────
// SECTION 8: RESOLVED TABLE COLUMNS
// ─────────────────────────────────────────────────────────────────────────────

// ── Resolved detail modal content — full record, untruncated ─────────────────
function ResolvedDetailContent({ alert }) {
  if (!alert) return null;
 
  // Re-use the existing Field helper and ResolvedDetailContent layout,
  // but wrap them side-by-side with the breach history panel.
  const Field = ({ label, value }) => (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "8px 0", borderBottom: "1px solid var(--border)" }}>
      <span style={{ fontSize: 12, color: "var(--muted-foreground)", width: 120, flexShrink: 0 }}>{label}</span>
      <span style={{ fontSize: 13, color: "var(--foreground)", fontWeight: 500, wordBreak: "break-word" }}>
        {value || <span style={{ color: "var(--muted-foreground)", fontWeight: 400 }}>—</span>}
      </span>
    </div>
  );
 
  // Inline formatAbsolute — already available in page.jsx scope if co-located
  const ACTION_LABELS = {
    adjust_temp:     "Adjust temperature",
    adjust_humid:    "Adjust humidity",
    schedule_repair: "Scheduled for maintenance",
    others:          "Others",
  };
 
  return (
    <div style={{ display: "flex", gap: 24, alignItems: "flex-start" }}>
 
      {/* ── Left: existing detail fields ── */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <Field label="Area ID"         value={alert.areaId} />
        <Field label="Line Name"       value={alert.lineName} />
        <Field label="Temperature"     value={alert.temperature != null ? `${alert.temperature.toFixed(2)}°C (limit: ${alert.tempLL}–${alert.tempUL}°C)` : null} />
        <Field label="Humidity"        value={alert.humidity    != null ? `${alert.humidity.toFixed(2)}% (limit: ${alert.humidLL}–${alert.humidUL}%)` : null} />
        <Field label="Action Taken"    value={ACTION_LABELS[alert.actionType] ?? alert.actionType} />
        <Field label="Remarks"         value={alert.actionRemarks} />
        <Field label="Acknowledged By" value={alert.acknowledgedBy} />
        <Field label="Acknowledged At" value={formatAbsolute(alert.acknowledgedAt)} />
        <Field label="Opened By"       value={alert.openedBy} />
        <Field label="Opened At"       value={formatAbsolute(alert.openedAt)} />
        <Field label="Verified By"     value={alert.verifiedBy} />
        <Field label="Verified At"     value={formatAbsolute(alert.verifiedAt)} />
        <Field label="Resolved At"     value={formatAbsolute(alert.resolvedAt)} />
      </div>
 
      {/* ── Divider ── */}
      <div style={{ width: 1, alignSelf: "stretch", background: "var(--border)", flexShrink: 0 }} />
 
      {/* ── Right: breach history ── */}
      <div style={{ flex: 1, minWidth: 320 }}>
        <p style={{ fontSize: 11, fontWeight: 700, color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: ".06em", margin: "0 0 10px" }}>
          Breach History
        </p>
        {/* Always expanded in the modal — no toggle needed */}
        <BreachReadingsInline alertId={alert.id} />
      </div>
 
    </div>
  );
}
 
// BreachReadingsInline — always-open variant for the resolved modal
// (no toggle button, auto-fetches on mount)
function BreachReadingsInline({ alertId }) {
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);
  const [rows,    setRows]    = useState([]);
  const [meta,    setMeta]    = useState(null);
  const [page,    setPage]    = useState(1);
 
  const fetchPage = useCallback(async (targetPage) => {
    setLoading(true);
    setError(null);
    try {
      const res = await axios.get(
        `${API_BASE}/facilities/alerts/${alertId}/breach-events`,
        { params: { page: targetPage } }
      );
      setRows(res.data.data);
      setMeta(res.data.meta);
      setPage(targetPage);
    } catch (err) {
      setError(err.response?.data?.message ?? "Failed to load breach history.");
    } finally {
      setLoading(false);
    }
  }, [alertId]);
 
  // Auto-fetch on mount
  useEffect(() => { fetchPage(1); }, [fetchPage]);
 
  if (loading) return <p style={{ fontSize: 12, color: "var(--muted-foreground)" }}>Loading…</p>;
 
  if (error) return (
    <div style={{ fontSize: 11, color: "#b91c1c", padding: "6px 10px", background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: 5 }}>
      {error}
      <button onClick={() => fetchPage(page)} style={{ marginLeft: 8, fontSize: 11, color: "#b91c1c", cursor: "pointer", background: "none", border: "none", textDecoration: "underline", padding: 0 }}>
        Retry
      </button>
    </div>
  );
 
  if (rows.length === 0) return (
    <p style={{ fontSize: 12, color: "var(--muted-foreground)", fontStyle: "italic" }}>
      No breach readings recorded after this alert was acknowledged.
    </p>
  );
 
  return (
    <>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead>
            <tr style={{ borderBottom: "1px solid var(--border)" }}>
              {["Time", "Temp", "Humid", "Temp Limit", "Humid Limit", "Breached"].map(h => (
                <th key={h} style={{
                  padding: "6px 8px", textAlign: "left", fontWeight: 700,
                  color: "var(--muted-foreground)", whiteSpace: "nowrap",
                  fontSize: 10, textTransform: "uppercase", letterSpacing: ".05em",
                }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i} style={{ borderBottom: "1px solid var(--border)", background: i % 2 === 0 ? "transparent" : "var(--muted)" }}>
                <td style={{ padding: "6px 8px", whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>
                  {formatAbsolute(row.readingAt)}
                </td>
                <td style={{ padding: "6px 8px", fontWeight: row.breached.temp ? 700 : 400, color: row.breached.temp ? "#b91c1c" : "var(--foreground)", fontVariantNumeric: "tabular-nums" }}>
                  {row.temperature.toFixed(2)}°C
                </td>
                <td style={{ padding: "6px 8px", fontWeight: row.breached.humid ? 700 : 400, color: row.breached.humid ? "#b91c1c" : "var(--foreground)", fontVariantNumeric: "tabular-nums" }}>
                  {row.humidity.toFixed(2)}%
                </td>
                <td style={{ padding: "6px 8px", color: "var(--muted-foreground)", whiteSpace: "nowrap" }}>
                  {row.limits.tempLL}–{row.limits.tempUL}°C
                </td>
                <td style={{ padding: "6px 8px", color: "var(--muted-foreground)", whiteSpace: "nowrap" }}>
                  {row.limits.humidLL}–{row.limits.humidUL}%
                </td>
                <td style={{ padding: "6px 8px" }}>
                  <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                    {row.breached.temp  && <BreachBadge label="Temp"  />}
                    {row.breached.humid && <BreachBadge label="Humid" />}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
 
      {meta && meta.lastPage > 1 && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 8, paddingTop: 8, borderTop: "1px solid var(--border)" }}>
          <span style={{ fontSize: 11, color: "var(--muted-foreground)" }}>
            Page {meta.currentPage} of {meta.lastPage} · {meta.total} total
          </span>
          <div style={{ display: "flex", gap: 4 }}>
            <Button variant="outline" size="sm" style={{ fontSize: 11, height: 26, padding: "0 10px" }}
              disabled={meta.currentPage <= 1 || loading} onClick={() => fetchPage(meta.currentPage - 1)}>
              Prev
            </Button>
            <Button variant="outline" size="sm" style={{ fontSize: 11, height: 26, padding: "0 10px" }}
              disabled={!meta.hasMore || loading} onClick={() => fetchPage(meta.currentPage + 1)}>
              Next
            </Button>
          </div>
        </div>
      )}
    </>
  );
}

// buildResolvedColumns — accepts setSelectedResolved to wire up the button
function buildResolvedColumns(setSelectedResolved) {
  return [
    { accessorKey: "areaId",   header: "Area ID"   },
    { accessorKey: "lineName", header: "Line Name" },
    {
      id: "readings", header: "Readings",
      cell: ({ row }) => {
        const a = row.original;
        return <span style={{ fontSize: 12, fontVariantNumeric: "tabular-nums" }}>{a.temperature?.toFixed(1)}°C · {a.humidity?.toFixed(1)}%</span>;
      },
    },
    {
      // acknowledgedBy — hidden, surfaced in detail modal
      id: "actionType", header: "Action taken",
      cell: ({ row }) => {
        const a = row.original;
        const label = ACTION_LABELS[a.actionType] ?? a.actionType;
        if (!a.actionType) return <span style={{ fontSize: 12, color: "var(--muted-foreground)" }}>—</span>;
        return (
          <span style={{ fontSize: 12, color: "var(--foreground)" }}>
            {label}
          </span>
        );
      },
    },
    {
      // actionRemarks — truncated in table, full in modal
      id: "actionRemarks", header: "Remarks",
      cell: ({ row }) => {
        const remarks = row.original.actionRemarks;
        return (
          <span style={{
            fontSize: 12,
            color: remarks ? "var(--foreground)" : "var(--muted-foreground)",
            maxWidth: 220, display: "inline-block",
            whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
          }}>
            {remarks || "—"}
          </span>
        );
      },
    },
    {
      // resolvedAt — kept visible
      id: "resolvedAt", header: "Resolved",
      cell: ({ row }) => <span style={{ fontSize: 12 }}>{formatAbsolute(row.original.resolvedAt)}</span>,
    },
    {
      // View Details button — opens modal with full record
      id: "viewDetails", header: "",
      cell: ({ row }) => (
        <Button
          variant="outline" size="sm"
          style={{ fontSize: 11, height: 26, cursor: "pointer", whiteSpace: "nowrap" }}
          onClick={() => setSelectedResolved(row.original)}
        >
          View Details
        </Button>
      ),
    },
  ];
}


// ─────────────────────────────────────────────────────────────────────────────
// SECTION 9: MAIN PAGE
// ─────────────────────────────────────────────────────────────────────────────

export default function FacilitiesDashboard() {
  const [alerts,           setAlerts]           = useState(alertsCache || []);
  const [loading,          setLoading]          = useState(alertsCache === null);
  const [fetchError,       setFetchError]       = useState(null);
  const [selectedResolved, setSelectedResolved] = useState(null); // state for resolved detail modal

  const processVerifyingAlerts = useCallback(async (currentAlerts) => {
    const verifying = currentAlerts.filter(a => a.status === "verifying");
    if (verifying.length === 0) return false;
    try {
      const res = await axios.post(`${API_BASE}/facilities/alerts/process-verifying`);
      return Array.isArray(res.data?.data) && res.data.data.length > 0;
    } catch {
      return false;
    }
  }, []);

  const processReadings = useCallback(async () => {
    try {
      await axios.post(`${API_BASE}/facilities/alerts/process-readings`);
    } catch {
      // non-critical — breach event detection failing shouldn't block the UI
    }
  }, []);

  const fetchAlerts = useCallback(async () => {
    try {
      if (!alertsCache) setLoading(true);

      const res = await axios.get(`${API_BASE}/facilities/alerts`);
      let nextAlerts = res.data.data;

      const didUpdateVerifying = await processVerifyingAlerts(nextAlerts);
      await processReadings();
      if (didUpdateVerifying) {
        const refreshed = await axios.get(`${API_BASE}/facilities/alerts`);
        nextAlerts = refreshed.data.data;
      }

      const downtimeRes = await axios
        .get(`${API_BASE}/downtime/active`)
        .then(res => res.data.data)
        .catch(() => []);

      const downtimeByArea = {};
      downtimeRes.forEach(r => {
        downtimeByArea[r.area_id] = r;
      });

      const enrichedAlerts = nextAlerts.map(alert => ({
        ...alert,
        maintenanceOngoing: !!downtimeByArea[alert.areaId],
        maintenanceStartedAt: downtimeByArea[alert.areaId]?.processed_at ?? null,
      }));

      setAlerts(enrichedAlerts);
      alertsCache = enrichedAlerts;
      setFetchError(null);
    } catch {
      setFetchError("Failed to load alerts. Please refresh.");
    } finally {
      setLoading(false);
    }
  }, [processVerifyingAlerts]);

  useEffect(() => {
    if (alertsCache !== null) setLoading(false);
    else setLoading(true);
    fetchAlerts();
  }, [fetchAlerts]);

  useEffect(() => {
    const interval = setInterval(fetchAlerts, 30_000);
    return () => clearInterval(interval);
  }, [fetchAlerts]);

  useEffect(() => {
    const handleStorage = (e) => {
      if (e.key === "facilitiesAlertSent") { alertsCache = null; fetchAlerts(); }
    };
    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        try {
          const sent = localStorage.getItem("facilitiesAlertSent");
          if (sent && (!alertsCache || Number(sent) > (parseUTC(alertsCache[alertsCache.length - 1]?.acknowledgedAt)?.getTime() ?? 0))) {
            fetchAlerts();
          }
        } catch {}
      }
    };
    window.addEventListener("storage", handleStorage);
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      window.removeEventListener("storage", handleStorage);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [fetchAlerts]);

  const acknowledgedAlerts = alerts.filter(a => a.status === "acknowledged")
    .sort((a, b) => parseUTC(a.acknowledgedAt) - parseUTC(b.acknowledgedAt));
  const openAlerts = alerts.filter(a => a.status === "open" || a.status === "verifying")
    .sort((a, b) => parseUTC(a.acknowledgedAt) - parseUTC(b.acknowledgedAt));
  const resolvedAlerts = alerts.filter(a => a.status === "resolved")
    .sort((a, b) => parseUTC(b.resolvedAt) - parseUTC(a.resolvedAt));

  const escalatedCount = acknowledgedAlerts.filter(a => minutesSince(a.acknowledgedAt) >= ESCALATION_THRESHOLD_MINS).length;

  const handleAcknowledge = useCallback(() => fetchAlerts(), [fetchAlerts]);
  const handleResolve = useCallback((updatedAlert) => {
    setAlerts(prev => {
      const next = prev.map(a => a.id === updatedAlert.id ? {
        ...a,
        ...updatedAlert,
        maintenanceOngoing: a.maintenanceOngoing,
        maintenanceStartedAt: a.maintenanceStartedAt,
      } : a);
      alertsCache = next;
      return next;
    });

    fetchAlerts();
  }, [fetchAlerts]);
  const handleConflict = useCallback(() => fetchAlerts(), [fetchAlerts]);

  const alertsByCol = { acknowledged: acknowledgedAlerts, open: openAlerts };

  // Build resolved columns with modal trigger — memoized to avoid re-render churn
  const RESOLVED_COLUMNS = React.useMemo(() => buildResolvedColumns(setSelectedResolved), []);

  const firedThresholds = useRef({});
  const isMounted       = useRef(false);

  const playAlarm = useCallback(() => {
    try {
      const ctx  = new (window.AudioContext || window.webkitAudioContext)();
      const beep = (startTime, freq, dur) => {
        const osc  = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain); gain.connect(ctx.destination);
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.4, startTime);
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + dur);
        osc.start(startTime); osc.stop(startTime + dur);
      };
      beep(ctx.currentTime,        880,  0.18);
      beep(ctx.currentTime + 0.22, 880,  0.18);
      beep(ctx.currentTime + 0.44, 1100, 0.28);
    } catch {}
  }, []);

  useEffect(() => {
    const checkEscalations = () => {
      let shouldAlarm = false;
      acknowledgedAlerts.forEach(alert => {
        const mins      = minutesSince(alert.acknowledgedAt);
        const threshold = Math.floor(mins / ESCALATION_THRESHOLD_MINS);
        if (threshold >= 1) {
          const prev = firedThresholds.current[alert.id] ?? 0;
          if (threshold > prev) {
            firedThresholds.current[alert.id] = threshold;
            if (isMounted.current) {
              shouldAlarm = true;
              axios.patch(`${API_BASE}/facilities/alerts/${alert.id}/escalate`, {
                escalationCount: threshold,
              }).then(res => {
                const updated = res.data.data;
                setAlerts(prev => { const n = prev.map(a => a.id === updated.id ? updated : a); alertsCache = n; return n; });
              }).catch(() => {
                firedThresholds.current[alert.id] = prev;
              });
            }
          }
        }
      });
      // if (shouldAlarm) playAlarm();
    };

    checkEscalations();
    isMounted.current = true;
    const interval = setInterval(checkEscalations, 60_000);
    return () => { clearInterval(interval); isMounted.current = false; };
  }, [acknowledgedAlerts, playAlarm]);

  useEffect(() => {
    const activeIds = new Set(acknowledgedAlerts.map(a => a.id));
    Object.keys(firedThresholds.current).forEach(id => {
      if (!activeIds.has(Number(id))) delete firedThresholds.current[id];
    });
  }, [acknowledgedAlerts]);

  return (
    <>
      <style>{SPINNER_STYLE}</style>
      {loading && <LoadingOverlay />}

      <div className="flex flex-col h-full overflow-hidden" style={{ minHeight: 0 }}>

        <div style={{ marginTop: 10, padding: "14px 24px", flexShrink: 0 }} className="bg-background">
          <h1 className="text-2xl font-bold">Manage Sensor Breach Alerts</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {acknowledgedAlerts.length} Acknowledged · {openAlerts.length} Open · {resolvedAlerts.length} Resolved
            {escalatedCount > 0 && (
              <span style={{ marginLeft: 10, fontWeight: 700, color: "#b45309" }}>
                · {escalatedCount} Delayed
              </span>
            )}
          </p>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "0 24px 24px" }}>

          {fetchError && (
            <div style={{
              marginBottom: 16, padding: "10px 14px", borderRadius: 8,
              background: "#fef2f2", border: "1px solid #fca5a5",
              fontSize: 13, color: "#b91c1c", display: "flex", alignItems: "center", gap: 8,
            }}>
              <TriangleAlert size={14} style={{ flexShrink: 0 }} />
              {fetchError}
            </div>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <DashboardCard value={String(resolvedAlerts.length)}     label="Resolved"      icon={CheckCheck}    variant="success"       />
              <DashboardCard value={String(openAlerts.length)}         label="Open"          icon={Clock}         variant="warning"       />
              <DashboardCard value={String(escalatedCount)}            label="Delayed"       icon={TriangleAlert} variant="secondary"     /> 
              <DashboardCard value={String(acknowledgedAlerts.length)} label="Acknowledged"  icon={BellRing}      variant="destructive"   />             
            </div>
          
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              {ACTIVE_COLUMNS.map(col => (
                <KanbanColumn
                  key={col.key}
                  col={col}
                  alerts={alertsByCol[col.key]}
                  onAcknowledge={handleAcknowledge}
                  onResolve={handleResolve}
                  onConflict={handleConflict}
                />
              ))}
            </div>

            <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, overflow: "hidden" }}>
              <div style={{ padding: "14px 20px", background: "var(--card)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span
                    style={{
                      width: 7,
                      height: 7,
                      borderRadius: "50%",
                      flexShrink: 0,
                      background: "var(--success)",
                      display: "inline-block",
                    }}
                  />
                  <p
                    style={{
                      fontWeight: 700,
                      fontSize: 14,
                      color: "var(--foreground)",
                      marginLeft: 3, 
                    }}
                  >
                    Resolved
                  </p>
                </div>
              </div>
              <div style={{ padding: "16px 20px" }}>
                {resolvedAlerts.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center" style={{ padding: "16px 0" }}>
                    No resolved alerts yet.
                  </p>
                ) : (
                  <DataTable columns={RESOLVED_COLUMNS} data={resolvedAlerts} />
                )}
              </div>
            </div>

          </div>
        </div>
      </div>

      {/* ── RESOLVED DETAIL MODAL ── */}
      <CustomModal
        open={!!selectedResolved}
        onOpenChange={open => { if (!open) setSelectedResolved(null); }}
        title="Alert Details"
        description={selectedResolved ? `${selectedResolved.lineName} · ${selectedResolved.areaId}` : ""}
        size="xl"
      >
        <ResolvedDetailContent alert={selectedResolved} />
      </CustomModal>
    </>
  );
}