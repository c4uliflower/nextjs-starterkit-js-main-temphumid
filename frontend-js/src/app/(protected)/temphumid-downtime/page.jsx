"use client";

// ─────────────────────────────────────────────────────────────────────────────
// IMPORTS
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import jsQR from "jsqr";
import { Button } from "@/components/ui/button";
import { CustomModal } from "@/components/custom/CustomModal";
import { Combobox } from "@/components/custom/Combobox";
import { DataTable } from "@/components/custom/DataTable";
import { TriangleAlert } from "lucide-react";
import { DashboardCard } from "@/components/custom/DashboardCard";
import { Wrench, Upload, CheckCheck, ActivitySquare } from "lucide-react";
import axios from "@/lib/axios";

// ─────────────────────────────────────────────────────────────────────────────
// BACKEND ROUTES
// ─────────────────────────────────────────────────────────────────────────────
//
//  POST /api/temphumid/downtime/validate-sensor  { line_name }
//  POST /api/temphumid/downtime/start            { area_id, line_name, processed_by, symptom }
//  POST /api/temphumid/downtime/mark-done/:id    { maintenance_reason, remarks }
//  POST /api/temphumid/downtime/upload           { ids: [int] }
//  GET  /api/temphumid/downtime/active           → polled every 30s
//  GET  /api/temphumid/downtime/history          → on mount + after upload

const API_BASE = '/api/temphumid/downtime';

// Module-level cache — persists across navigations
let downtimeCache = {
  active: null,
  history: null,
  pendingDone: [],
  formData: {
    lineName: "", areaId: "", technicianId: "",
    reason: "", remarks: "", duration: "", markedDone: "",
  },
  symptom: "",
};


// ─────────────────────────────────────────────────────────────────────────────
// SECTION 1: CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

// (none)


// ─────────────────────────────────────────────────────────────────────────────
// SECTION 2: STATIC DATA
// ─────────────────────────────────────────────────────────────────────────────

const DOWNTIME_REASONS = [
  { id: "offline",     label: "Sensor Offline / No Data"   },
  { id: "loose-conn",  label: "Loose Connection"           },
  { id: "hw-damage",   label: "Hardware Damage"            },
  { id: "calibration", label: "Calibration Drift"          },
  { id: "power",       label: "Power Issue"                },
  { id: "firmware",    label: "Firmware / Software Error"  },
  { id: "env",         label: "Environmental Interference" },
  { id: "other",       label: "Other"                      },
];

const REASON_SELECT_OPTIONS = [
  { value: "", label: "Select reason…" },
  ...DOWNTIME_REASONS.map(r => ({ value: r.id, label: r.label })),
];

const SYMPTOM_LABELS = {
  breach:  "Breach",
  no_data: "No Data",
};

// Symptom dot colors — mirrors SensorPane status dot palette
const SYMPTOM_DOT = {
  "Breach":  "#dc3545",
  "No Data": "#adb5bd",
};


// ─────────────────────────────────────────────────────────────────────────────
// SECTION 3: QR VALIDATION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Validate a sensor QR against the backend.
 * Extracts line_name from a URL QR (e.g. ?line_name=SMT+MH) or uses the
 * raw value directly if it is not a URL.
 *
 * Returns: { ok: true, sensor: { areaId, lineName, plant, floor, status } }
 *        | { ok: false, error: string }
 */
async function parseSensorQr(rawValue) {
  let lineName = null;
  try {
    const url = new URL(rawValue);
    lineName = url.searchParams.get("line_name");
  } catch {
    lineName = rawValue;
  }

  if (!lineName?.trim()) {
    return { ok: false, error: "QR code does not contain a valid line name." };
  }

  const decoded = lineName.trim();

  try {
    const res  = await axios.post(`${API_BASE}/validate-sensor`, { line_name: decoded });
    const json = res.data;

    if (!json.valid) {
      return { ok: false, error: json.message ?? `"${decoded}" could not be validated.` };
    }

    return { ok: true, sensor: json.sensor };
  } catch (err) {
    const msg = err.response?.data?.message;
    return {
      ok:    false,
      error: msg ?? `Could not reach the server. Please check your connection and try again.`,
    };
  }
}

/**
 * Validate a technician QR — plain employee ID string.
 * Format validation only; no backend call.
 */
function parseTechnicianQr(rawValue) {
  const id = rawValue.trim();
  if (!id) return { ok: false, error: "QR code is empty. Please scan your employee ID QR." };
  if (!/^[a-zA-Z0-9\-]+$/.test(id)) {
    return { ok: false, error: "Unrecognized QR format. Please scan your employee ID QR code." };
  }
  return { ok: true, technicianId: id };
}


// ─────────────────────────────────────────────────────────────────────────────
// SECTION 4: UTILITY
// ─────────────────────────────────────────────────────────────────────────────

// FIX #1: use Math.abs to guard against negative duration_seconds from DB
function formatTimer(seconds) {
  const abs = Math.abs(Math.round(seconds ?? 0));
  const h   = Math.floor(abs / 3600);
  const m   = Math.floor((abs % 3600) / 60);
  const s   = abs % 60;
  return [h, m, s].map(v => String(v).padStart(2, "0")).join(":");
}

function useElapsed(processedAt, markedDoneAt) {
  const getSnapshot = () => {
    const start = parseUTC(processedAt);
    const end   = markedDoneAt ? parseUTC(markedDoneAt) : new Date();

    if (!start || Number.isNaN(start.getTime())) return 0;
    if (!end   || Number.isNaN(end.getTime()))   return 0;

    return Math.max(0, Math.floor((end.getTime() - start.getTime()) / 1000));
  };

  const [elapsed, setElapsed] = useState(getSnapshot);

  useEffect(() => {
    setElapsed(getSnapshot());

    if (markedDoneAt) return;
    const id = setInterval(() => setElapsed(getSnapshot()), 1000);
    return () => clearInterval(id);
  }, [processedAt, markedDoneAt]);

  return elapsed;
}

function formatDate(date) {
  return formatDatePH(date);
}

function parseUTC(dateString) {
  if (!dateString) return null;
  if (dateString.includes("Z") || dateString.includes("+")) return new Date(dateString);
  return new Date(dateString.replace(" ", "T") + "+08:00"); // ← PHT offset
}

function formatDatePH(dateString) {
  const d = parseUTC(dateString);
  if (!d) return "—";
  return d.toLocaleString("en-PH", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
    timeZone: "Asia/Manila",
  });
}


// ─────────────────────────────────────────────────────────────────────────────
// SECTION 5: QR SCANNER
// ─────────────────────────────────────────────────────────────────────────────

function QrScanner({ onScan, label, onError }) {
  const videoRef  = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const rafRef    = useRef(null);
  const doneRef   = useRef(false);

  const stopCamera = useCallback(() => {
    if (rafRef.current)    cancelAnimationFrame(rafRef.current);
    if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    rafRef.current    = null;
  }, []);

  const tick = useCallback(() => {
    const video  = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || doneRef.current) return;
    if (video.readyState === video.HAVE_ENOUGH_DATA) {
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      canvas.width  = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      if (jsQR) {
        const code = jsQR(imageData.data, imageData.width, imageData.height, { inversionAttempts: "dontInvert" });
        if (code?.data) { doneRef.current = true; stopCamera(); onScan(code.data); return; }
      }
    }
    setTimeout(() => requestAnimationFrame(tick), 150);
  }, [onScan, stopCamera]);

  useEffect(() => {
    doneRef.current = false;
    let cancelled   = false;
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false })
      .then(stream => {
        if (cancelled) { stream.getTracks().forEach(t => t.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.setAttribute("playsinline", true);
          videoRef.current.play();
          rafRef.current = requestAnimationFrame(tick);
        }
      })
      .catch(err => {
        if (cancelled) return;
        if (err.name === "AbortError" || err.name === "NotReadableError") return;
        onError?.(err.name === "NotAllowedError"
          ? "Camera access denied. Please allow camera permissions and try again."
          : `Camera error: ${err.message}`);
      });
    return () => { cancelled = true; stopCamera(); };
  }, [tick, stopCamera, onError]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ position: "relative", width: "100%", borderRadius: 5, overflow: "hidden", background: "#000", aspectRatio: "4/3" }}>
        <video ref={videoRef} muted playsInline style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
        <svg viewBox="0 0 100 100" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }}>
          <path d="M10 25 L10 10 L25 10" stroke="#fff" strokeWidth="2.5" fill="none" strokeLinecap="round" />
          <path d="M75 10 L90 10 L90 25" stroke="#fff" strokeWidth="2.5" fill="none" strokeLinecap="round" />
          <path d="M90 75 L90 90 L75 90" stroke="#fff" strokeWidth="2.5" fill="none" strokeLinecap="round" />
          <path d="M25 90 L10 90 L10 75" stroke="#fff" strokeWidth="2.5" fill="none" strokeLinecap="round" />
          <line x1="12" y1="50" x2="88" y2="50" stroke="#435ebe" strokeWidth="1.5" opacity="0.7">
            <animateTransform attributeName="transform" type="translate" from="0 -30" to="0 30" dur="1.6s" repeatCount="indefinite" additive="sum" />
          </line>
        </svg>
      </div>
      <canvas ref={canvasRef} style={{ display: "none" }} />
      <p className="text-sm text-muted-foreground text-center">{label}</p>
    </div>
  );
}


// ─────────────────────────────────────────────────────────────────────────────
// SECTION 6: SHARED UI ATOMS
// ─────────────────────────────────────────────────────────────────────────────

function ConfirmedChip({ label, sub, color, bg, onClear }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 14px", borderRadius: 5, background: bg }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color, letterSpacing: ".01em" }}>{label}</div>
        {sub && <div style={{ fontSize: 11, color, opacity: 0.75, marginTop: 1 }}>{sub}</div>}
      </div>
      {onClear && (
        <button
          onClick={onClear}
          style={{ background: "rgba(255,255,255,0.25)", border: "none", borderRadius: 5, padding: "2px 8px", fontSize: 11, color, fontWeight: 600, cursor: "pointer", flexShrink: 0 }}
        >
          change
        </button>
      )}
    </div>
  );
}

function StepBar({ step, total = 3 }) {
  return (
    <div style={{ display: "flex", gap: 4, marginBottom: 4 }}>
      {Array.from({ length: total }).map((_, i) => (
        <div key={i} style={{ flex: 1, height: 3, borderRadius: 5, background: i < step ? "#435ebe" : "var(--border)", transition: "background .2s" }} />
      ))}
    </div>
  );
}

// ── Pane-style read-only field row — mirrors SensorPane detail layout ─────────
function PaneField({ label, value, valueStyle }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: "1px solid var(--border)" }}>
      <span style={{ fontSize: 12, color: "var(--muted-foreground)", width: 100, flexShrink: 0 }}>{label}</span>
      <span style={{ fontSize: 13, color: "var(--foreground)", fontWeight: 500, ...valueStyle }}>
        {value || <span style={{ color: "var(--muted-foreground)", fontWeight: 400 }}>—</span>}
      </span>
    </div>
  );
}

// ── Loading overlay — mirrors MonitoringPage pattern ─────────────────────────
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
          <p style={{ fontWeight: 700, fontSize: 15, color: "var(--foreground)", margin: 0 }}>Loading maintenance history</p>
          <p style={{ fontSize: 12, color: "var(--muted-foreground)", marginTop: 6 }}>Fetching active and history records…</p>
        </div>
      </div>
    </div>
  );
}


// ─────────────────────────────────────────────────────────────────────────────
// SECTION 7: MODAL CONTENT COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────

// ── 7A: START DOWNTIME ───────────────────────────────────────────────────────
//
// Flow:
//   Step 1 — Scan sensor QR  → POST /validate-sensor
//   Step 2 — Scan operator QR → capture operator ID (format-only)
//   Step 3 — Confirm → POST /start { area_id, line_name, processed_by, symptom }

function StartDowntimeContent({ onQueued, onClose }) {
  const [step,       setStep]       = useState(1);
  const [saving,     setSaving]     = useState(false);
  const [apiError,   setApiError]   = useState(null);
  const [scanError1, setScanError1] = useState(null);
  const [scanError2, setScanError2] = useState(null);
  // sensor: { areaId, lineName, plant, floor, status }
  const [sensorInfo, setSensorInfo] = useState(null);
  // tech: { technicianId }
  const [techInfo,   setTechInfo]   = useState(null);

  const reset = () => {
    setStep(1); setSaving(false); setApiError(null);
    setScanError1(null); setScanError2(null);
    setSensorInfo(null); setTechInfo(null);
  };

  // ── Step 3 confirm: POST /start ──────────────────────────────────────────
  const handleQueue = async () => {
    setSaving(true); setApiError(null);
    try {
      const symptomLabel = SYMPTOM_LABELS[sensorInfo.status] ?? sensorInfo.status;

      const res = await axios.post(`${API_BASE}/start`, {
        area_id:      sensorInfo.areaId,
        line_name:    sensorInfo.lineName,
        processed_by: techInfo.technicianId,
        source_alert_id:  sensorInfo.sourceAlertId ?? null,
        symptom:      symptomLabel,
      });

      const record = res.data.data;

      onQueued({
        id:          record.id,
        sensorInfo,
        techInfo,
        processedAt: record.processed_at,
        symptomLabel,
      });

      reset();
      onClose();
    } catch (err) {
      setApiError(err.response?.data?.message ?? "Something went wrong. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  // ── Step 1: validate sensor QR ───────────────────────────────────────────
  const handleSensorScan = async rawValue => {
    setScanError1(null);
    setSaving(true);
    try {
      const result = await parseSensorQr(rawValue);
      if (!result.ok) { setScanError1(result.error); return; }
      setSensorInfo(result.sensor);
      setStep(2);
    } finally {
      setSaving(false);
    }
  };

  // ── Step 2: capture operator ID ──────────────────────────────────────────
  const handleTechScan = rawValue => {
    setScanError2(null);
    const result = parseTechnicianQr(rawValue);
    if (!result.ok) { setScanError2(result.error); return; }
    setTechInfo({ technicianId: result.technicianId });
    setStep(3);
  };

  const symptomLabel = sensorInfo ? (SYMPTOM_LABELS[sensorInfo.status] ?? sensorInfo.status) : "";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <StepBar step={step} total={3} />

      {/* ── Step 1: Scan sensor QR ── */}
      {step === 1 && (
        <>
          <QrScanner
            label="Point camera at the QR code on the sensor or its location label."
            onScan={handleSensorScan}
            onError={msg => setScanError1(msg)}
          />
          {saving && <p className="text-sm text-muted-foreground text-center">Validating sensor…</p>}
          {scanError1 && <p className="text-sm text-destructive" style={{ marginTop: 4 }}>{scanError1}</p>}

          {/* Test buttons — remove before production */}
          <div style={{ display: "flex", gap: 8, flexDirection: "column" }}>
          </div>
        </>
      )}

      {/* ── Step 2: Scan operator QR ── */}
      {step === 2 && sensorInfo && (
        <>
          <ConfirmedChip
            label={sensorInfo.lineName}
            sub={`${sensorInfo.areaId} · ${sensorInfo.plant}${sensorInfo.floor}`}
            color="#fff" bg="#435ebe"
            onClear={() => { setSensorInfo(null); setScanError1(null); setStep(1); }}
          />
          <QrScanner
            label="Scan the QR on your employee ID."
            onScan={handleTechScan}
            onError={msg => setScanError2(msg)}
          />
          {scanError2 && <p className="text-sm text-destructive">{scanError2}</p>}
          <div style={{ display: "flex", gap: 8, flexDirection: "column" }}>
          </div>
          <Button type="button" size="default" variant="outline" className="w-full" style={{ cursor: "pointer" }} onClick={() => setStep(1)}>Back</Button>
        </>
      )}

      {/* ── Step 3: Confirm → Queue ── */}
      {step === 3 && sensorInfo && techInfo && (
        <>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <ConfirmedChip
              label={sensorInfo.lineName}
              sub={`${sensorInfo.areaId} · ${sensorInfo.plant}${sensorInfo.floor}`}
              color="#fff" bg="#435ebe"
              onClear={() => { setSensorInfo(null); setScanError1(null); setStep(1); }}
            />
            <ConfirmedChip
              label={`Operator ID: ${techInfo.technicianId}`}
              color="#fff" bg="#435ebe"
              onClear={() => { setTechInfo(null); setScanError2(null); setStep(2); }}
            />
            <ConfirmedChip
              label={`Symptom: ${symptomLabel}`}
              color="#fff" bg="#dc3545"
            />
          </div>
          {apiError && <p className="text-sm text-destructive">{apiError}</p>}
          <div style={{ display: "flex", gap: 8 }}>
            <Button type="button" size="default" variant="outline" className="flex-1" style={{ cursor: "pointer" }} onClick={() => setStep(2)} disabled={saving}>Back</Button>
            <Button type="button" size="default" variant="default" className="flex-1" style={{ cursor: "pointer" }} onClick={handleQueue} disabled={saving}>
              {saving ? "Starting…" : "Queue for Maintenance"}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}


// ── 7B: MARK DONE ────────────────────────────────────────────────────────────
//
// Flow:
//   Step 1 — Select maintenance reason + enter remarks → POST /mark-done/:id
//             { maintenance_reason, remarks }
//
// marked_done_by is derived server-side from the authenticated user —
// same pattern as changed_by in SensorLimitController.
//

function MarkDoneContent({ record, onDone, onClose }) {
  const [reason,   setReason]   = useState("");
  const [remarks,  setRemarks]  = useState("");
  const [saving,   setSaving]   = useState(false);
  const [apiError, setApiError] = useState(null);

  const reset = () => {
    setReason(""); setRemarks("");
    setSaving(false); setApiError(null);
  };

  const handleConfirm = async () => {
    if (!reason || !remarks.trim()) return;
    setSaving(true); setApiError(null);
    try {
      const reasonLabel = DOWNTIME_REASONS.find(r => r.id === reason)?.label ?? reason;

      // ── POST /mark-done — sets marked_done_at, marked_done_by (server-side), reason, remarks ──
      const res  = await axios.post(`${API_BASE}/mark-done/${record.id}`, {
        maintenance_reason: reasonLabel,
        remarks:            remarks.trim(),
      });
      const data = res.data.data;

      // ── Record moves to pendingDone; upload finalizes it ──
      onDone(record.id, reason, {
        markedDoneAt:    data.marked_done_at,
        durationSeconds: data.duration_seconds,
        reasonLabel,
        remarks:         data.remarks,
      });

      reset();
      onClose();
    } catch (err) {
      setApiError(err.response?.data?.message ?? "Something went wrong.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div>
        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          Reason for Maintenance <span style={{ color: "#dc3545" }}>*</span>
        </label>
        <Combobox
          options={REASON_SELECT_OPTIONS}
          value={reason}
          onValueChange={setReason}
          placeholder="Select reason…"
          disabled={saving}
          className="w-full mt-2"
        />
      </div>

      <div>
        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          Remarks <span style={{ color: "#dc3545" }}>*</span>
        </label>
        <textarea
          value={remarks}
          onChange={e => setRemarks(e.target.value)}
          placeholder="Additional details..."
          rows={3}
          disabled={saving}
          style={{
            width: "100%", marginTop: 8, padding: "8px 10px", borderRadius: 5, fontSize: 13,
            resize: "vertical", boxSizing: "border-box", fontFamily: "inherit", outline: "none",
            border: "1.5px solid var(--border)",
            background: saving ? "var(--muted)" : "var(--background)",
            color: "var(--foreground)",
            transition: "border-color .15s",
          }}
          onFocus={e => { e.target.style.borderColor = "#435ebe"; }}
          onBlur={e  => { e.target.style.borderColor = "var(--border)"; }}
        />
      </div>

      {apiError && <p className="text-sm text-destructive">{apiError}</p>}

      <div style={{ display: "flex", gap: 8 }}>
        <Button
          type="button"
          size="default"
          variant="outline"
          className="flex-1"
          style={{ cursor: "pointer" }}
          onClick={onClose}
          disabled={saving}
        >
          Cancel
        </Button>
        <Button
          type="button"
          size="default"
          variant="default"
          className="flex-1"
          style={{ cursor: "pointer" }}
          onClick={handleConfirm}
          disabled={!reason || !remarks.trim() || saving}
        >
          {saving ? "Saving…" : "Confirm & Mark Done"}
        </Button>
      </div>
    </div>
  );
}


// ── 7C: UPLOAD ──────────────────────────────────────────────────────
//
// FIX #2: POST /upload sets status = 'uploaded' and uploaded_at on the DB.
//         uploaded_by is derived server-side from the authenticated user.
//         History is refreshed after successful upload.

function UploadDowntimeContent({ pendingDone, onUpload, onClose }) {
  const [saving,   setSaving]   = useState(false);
  const [apiError, setApiError] = useState(null);

  const handleUpload = async () => {
    setSaving(true); setApiError(null);
    try {
          const ids = pendingDone.map(r => Number(r.id)); // FIX #1

      if (ids.length > 0) {
        // uploaded_by is derived server-side from the authenticated user —
        // same pattern as changed_by in SensorLimitController.
        await axios.post(`${API_BASE}/upload`, { ids });
      }
      onUpload();
      onClose();
    } catch (err) {
      setApiError(err.response?.data?.message ?? "Something went wrong.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <p className="text-sm text-muted-foreground">
        {pendingDone.length} record{pendingDone.length !== 1 ? "s" : ""} will be finalized and submitted.
      </p>
      {pendingDone.length === 0
        ? <p className="text-sm text-muted-foreground text-center" style={{ padding: "16px 0" }}>No records pending upload. Mark records as done first.</p>
        : pendingDone.map(r => {
          const label = SYMPTOM_LABELS[r.symptom] || r.symptom || "Unknown";
          const color = SYMPTOM_DOT[label] || "#adb5bd";
            return (
              <div key={r.id} style={{
                display: "flex", alignItems: "center", gap: 10, padding: "10px 14px",
                border: "1px solid var(--border)", borderRadius: 5,
                background: "var(--card)",
              }}>
                <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 5, background: color, color: "#fff", textTransform: "uppercase", letterSpacing: ".04em", flexShrink: 0 }}>{label}</span>
                <div style={{ flex: 1, overflow: "hidden" }}>
                  <div className="text-sm font-semibold" style={{ color: "var(--foreground)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.lineName}</div>
                  <div style={{ fontSize: 11, color: "var(--muted-foreground)" }}>{r.areaId}</div>
                </div>
                <span className="text-muted-foreground" style={{ fontSize: 11, flexShrink: 0 }}>{r.symptom}</span>
              </div>
            );
          })
      }
      {apiError && <p className="text-sm text-destructive">{apiError}</p>}
      <div style={{ display: "flex", gap: 8 }}>
        <Button type="button" size="default" variant="outline" className="flex-1" style={{ cursor: "pointer" }} onClick={onClose} disabled={saving}>Cancel</Button>
        <Button type="button" size="default" variant="default" className="flex-1" style={{ cursor: "pointer" }} onClick={handleUpload} disabled={pendingDone.length === 0 || saving}>
          {saving ? "Uploading…" : "Upload"}
        </Button>
      </div>
    </div>
  );
}


// ─────────────────────────────────────────────────────────────────────────────
// SECTION 8: STOP LINE CARD  (pane-style, mirrors SensorPane design language)
// ─────────────────────────────────────────────────────────────────────────────

function StopLineCard({ record, onClick }) {
  const elapsed    = useElapsed(record.processedAt, record.markedDoneAt);
  const symptomDot = SYMPTOM_DOT[record.symptom] ?? "#adb5bd";
  const isDisabled = !!record.markedDoneAt;

  return (
    <div
      onClick={() => { if (!isDisabled) onClick(record); }}
      style={{
        background: "var(--card)",
        border: `1.5px solid #dc3545`,
        borderLeft: `4px solid #dc3545`,
        borderRadius: 6,
        overflow: "hidden",
        cursor: isDisabled ? "default" : "pointer",
        transition: "box-shadow .15s",
        boxShadow: "0 1px 4px rgba(0,0,0,.06)",
        opacity: 1,
      }}
      onMouseEnter={e => { if (!isDisabled) e.currentTarget.style.boxShadow = "0 3px 10px rgba(220,53,69,.2)"; }}
      onMouseLeave={e => { e.currentTarget.style.boxShadow = "0 1px 4px rgba(0,0,0,.06)"; }}
    >
      {/* ── Card header — red/orange accent based on pending upload status ── */}
      <div style={{
        padding: "9px 14px",
        background: "#dc3545",
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 7, minWidth: 0 }}>
          <span style={{
            width: 7, height: 7, borderRadius: "50%", flexShrink: 0,
            background: "rgba(255,255,255,0.7)",
            animation: "dotPulse 1.4s ease-in-out infinite",
          }} />
          <span style={{ fontWeight: 700, fontSize: 13, color: "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {record.lineName}
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
          <span style={{ fontFamily: "monospace", fontSize: 13, fontWeight: 700, color: "#fff" }}>
            {formatTimer(elapsed)}
          </span>
        </div>
      </div>

      {/* ── Card body — detail rows, same density as SensorPane data block ── */}
      <div style={{ padding: "10px 14px", display: "flex", flexDirection: "column", gap: 5 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontSize: 11, color: "var(--muted-foreground)" }}>{record.areaId}</span>
          <span style={{ fontSize: 11, color: "var(--muted-foreground)" }}>
            Operator: <strong style={{ color: "var(--foreground)" }}>{record.technicianId}</strong>
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: symptomDot, flexShrink: 0 }} />
          <span style={{ fontSize: 12, color: "var(--foreground)", fontWeight: 500 }}>{record.symptom}</span>
        </div>
        <div style={{ fontSize: 10, color: "var(--muted-foreground)", marginTop: 1 }}>
          Started: {formatDate(record.processedAt)}
          {" · "}
          <span style={{ color: "#dc3545", fontWeight: 600 }}>Tap to Mark Done</span>
        </div>
      </div>
    </div>
  );
}


// ─────────────────────────────────────────────────────────────────────────────
// SECTION 9: STOP LINE LIST PANEL
// ─────────────────────────────────────────────────────────────────────────────

function StopLineListPanel({ records, onRowClick, onStartDowntime }) {
  return (
    <div style={{
      width: 340, flexShrink: 0,
      background: "var(--card)",
      border: "1px solid var(--border)",
      borderRadius: 8,
      overflow: "hidden",
      display: "flex", flexDirection: "column",
    }}>
      {/* ── Blue header — consistent with team's card header pattern ── */}
      <div style={{
        padding: "14px 20px",
      }}>
        <p style={{ fontSize: 10, fontWeight: 700, color: "var(--muted-foreground)", letterSpacing: ".06em", textTransform: "uppercase", margin: 0 }}>
          Active Maintenance
        </p>
        <p style={{ fontSize: 16, fontWeight: 700, color: "var(--foreground)", margin: "2px 0 0" }}>
          Stop Line List
        </p>
      </div>

      {/* ── Column hint row ── */}
      <div style={{
        display: "grid", gridTemplateColumns: "1fr auto",
        padding: "6px 14px", fontSize: 10, fontWeight: 700,
        color: "var(--muted-foreground)", textTransform: "uppercase",
        letterSpacing: ".06em", borderBottom: "1px solid var(--border)",
        background: "var(--muted)",
      }}>
        <span>Sensor / Area</span><span>Elapsed</span>
      </div>

      {/* ── Card list ── */}
      <div style={{ flex: 1, overflowY: "auto", padding: "12px", display: "flex", flexDirection: "column", gap: 10, minHeight: 80 }}>
        {records.length === 0
          ? (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", flex: 1, padding: "28px 0" }}>
              <p className="text-sm text-muted-foreground text-center">No active records</p>
            </div>
          )
          : records.map(r => (
              <StopLineCard key={r.id} record={r} onClick={onRowClick} />
            ))
        }
      </div>

      {/* ── Footer action ── */}
      <div style={{ padding: "12px", borderTop: "1px solid var(--border)" }}>
        <Button type="button" size="default" variant="default" className="w-full" style={{ cursor: "pointer" }} onClick={onStartDowntime}>
          Start Maintenance
        </Button>
      </div>
    </div>
  );
}


// ─────────────────────────────────────────────────────────────────────────────
// SECTION 10: DOWNTIME FORM PANEL  (pane-style fields + blue header)
// ─────────────────────────────────────────────────────────────────────────────

function DowntimeFormPanel({ formData, symptom }) {
  const hasData = !!(formData.lineName || symptom);

  return (
    <div style={{
      background: "var(--card)",
      border: "1px solid var(--border)",
      borderRadius: 8,
      overflow: "hidden",
    }}>
      {/* ── Blue breadcrumb header — mirrors SensorLimitsPage edit panel ── */}
      <div style={{
        padding: "14px 20px",
        background: "#435ebe",
        borderBottom: "1px solid #3550a8",
      }}>
        <p style={{ fontSize: 16, fontWeight: 700, color: "#fff", margin: "2px 0 0" }}>
          {hasData ? formData.lineName : "Maintenance Form"}
        </p>
      </div>

      {/* ── Pane-style field rows ── */}
      <div style={{ padding: "14px 20px" }}>
        {!hasData ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8, padding: "28px 0", color: "var(--muted-foreground)" }}>
            <p style={{ fontSize: 13, margin: 0, textAlign: "center" }}>Start a maintenance or mark a record as done to see details here</p>
          </div>
        ) : (
          <>
            <PaneField label="Symptom"     value={symptom}               valueStyle={symptom ? { color: "#dc3545", fontWeight: 700 } : {}} />
            <PaneField label="Line Name"   value={formData.lineName}     />
            <PaneField label="Area ID"     value={formData.areaId}       />
            <PaneField label="Operator"    value={formData.technicianId} />
            <PaneField label="Reason"      value={formData.reason}       />
            <PaneField label="Remarks"     value={formData.remarks}      />
            <PaneField label="Duration"    value={formData.duration}     />
            <PaneField label="Marked Done" value={formData.markedDone}   />
          </>
        )}
      </div>
    </div>
  );
}


// ─────────────────────────────────────────────────────────────────────────────
// SECTION 11: MAINTENANCE HISTORY PANEL
// ─────────────────────────────────────────────────────────────────────────────
//
// FIX #2: Only fetches status = 'uploaded' records (all columns fully populated).
// History refreshes only after upload action.

// ── History detail modal content — full record, untruncated ──────────────────
function HistoryDetailContent({ record }) {
  if (!record) return null;
  const Field = ({ label, value }) => (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "8px 0", borderBottom: "1px solid var(--border)" }}>
      <span style={{ fontSize: 12, color: "var(--muted-foreground)", width: 120, flexShrink: 0 }}>{label}</span>
      <span style={{ fontSize: 13, color: "var(--foreground)", fontWeight: 500, wordBreak: "break-word" }}>
        {value || <span style={{ color: "var(--muted-foreground)", fontWeight: 400 }}>—</span>}
      </span>
    </div>
  );
  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      <Field label="Line Name"     value={record.lineName} />
      <Field label="Area ID"       value={record.areaId} />
      <Field label="Operator"  value={record.technicianId} />
      <Field label="Symptom"       value={record.symptom} />
      <Field label="Reason"        value={record.reason} />
      <Field label="Remarks"       value={record.remarks} />
      <Field label="Duration"      value={record.durationSeconds != null ? formatTimer(record.durationSeconds) : null} />
      <Field label="Marked Done By" value={record.markedDoneBy} />
      <Field label="Marked Done At" value={record.markedDoneAt ? formatDate(record.markedDoneAt) : null} />
      <Field label="Uploaded By"   value={record.uploadedBy} />
      <Field label="Uploaded At"   value={record.uploadedAt ? formatDate(record.uploadedAt) : null} />
    </div>
  );
}

// buildHistoryColumns — accepts setSelectedHistory to wire up the button
function buildHistoryColumns(setSelectedHistory) {
  return [
    {
      header: "Line Name",
      cell: ({ row }) => (
        <div>
          <div style={{ fontWeight: 600, fontSize: 13 }}>{row.original.lineName}</div>
          <div style={{ fontSize: 11, color: "var(--muted-foreground)" }}>{row.original.areaId}</div>
        </div>
      ),
    },
    { accessorKey: "technicianId", header: "Operator"    },
    { accessorKey: "symptom",      header: "Symptom"       },
    { accessorKey: "reason",       header: "Reason"        },
    {
      // remarks — truncated in table, full in modal
      id: "remarks", header: "Remarks",
      cell: ({ row }) => (
        <span style={{
          fontSize: 13,
          color: row.original.remarks ? "var(--foreground)" : "var(--muted-foreground)",
          maxWidth: 200, display: "inline-block",
          whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
        }}>
          {row.original.remarks || "—"}
        </span>
      ),
    },
    {
      header: "Duration",
      cell: ({ row }) => formatTimer(row.original.durationSeconds ?? 0),
    },
    {
      // uploadedAt — kept visible
      header: "Uploaded",
      cell: ({ row }) => row.original.uploadedAt ? formatDate(row.original.uploadedAt) : "—",
    },
    {
      // markedDoneBy, markedDoneAt, uploadedBy — hidden, surfaced in detail modal
      // View Details button — opens modal with full record
      id: "viewDetails", header: "",
      cell: ({ row }) => (
        <Button
          variant="outline" size="sm"
          style={{ fontSize: 11, height: 26, cursor: "pointer", whiteSpace: "nowrap" }}
          onClick={() => setSelectedHistory(row.original)}
        >
          View Details
        </Button>
      ),
    },
  ];
}

function MaintenanceHistoryPanel({ history, loading, onViewDetails }) {

  const sortedHistory = useMemo(() => {
    return [...history].reverse();
  }, [history]);

  // Build columns with modal trigger — memoized to avoid re-render churn
  const historyColumns = useMemo(() => buildHistoryColumns(onViewDetails), [onViewDetails]);

  return (
    <div style={{
      background: "var(--card)",
      border: "1px solid var(--border)",
      borderRadius: 8,
      overflow: "hidden",
    }}>
      {/* ── Blue header ── */}
      <div style={{
        padding: "14px 20px",
      }}>
        <p style={{ fontSize: 16, fontWeight: 700, color: "var(--foreground)", margin: "2px 0 0", marginTop: 10 }}>
          Maintenance History
        </p>
      </div>
      <div style={{ padding: "16px 20px" }}>
        {loading ? (
          <p className="text-sm text-muted-foreground text-center" style={{ padding: "24px 0" }}>Loading history…</p>
        ) : history.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center" style={{ padding: "24px 0" }}>No uploaded records yet.</p>
        ) : (
          <DataTable columns={historyColumns} data={sortedHistory} />
        )}
      </div>
    </div>
  );
}


// ─────────────────────────────────────────────────────────────────────────────
// SECTION 12: GLOBAL STYLES
// ─────────────────────────────────────────────────────────────────────────────

const GLOBAL_STYLES = `
  @keyframes dotPulse {
    0%, 100% { opacity: 1;   }
    50%       { opacity: 0.3; }
  }
  @keyframes spinLoader {
    to { transform: rotate(360deg); }
  }
`;


// ─────────────────────────────────────────────────────────────────────────────
// SECTION 13: MAIN PAGE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Local record shape:
 *   id:              TempHumid_Maintenance_Downtime_Log.ID
 *   areaId:          [Area ID] column  (e.g. "P1F1-05")
 *   lineName:        [Line Name] column (e.g. "SMT MH")
 *   technicianId:    processed_by (employee ID who started the downtime)
 *   symptom:         "Breach" | "No Data"
 *   reason:          maintenance_reason label — set after mark done
 *   remarks:         technician remarks — set after mark done
 *   processedAt:     ISO string  (DB: processed_at — when downtime was started)
 *   markedDoneAt:    ISO string | null  (DB: marked_done_at — set when mark done)
 *   markedDoneBy:    string | null      (DB: marked_done_by — derived server-side at mark-done time)
 *   uploadedAt:      ISO string | null  (set on upload)
 *   uploadedBy:      string | null      (derived server-side at upload time)
 *   status:          "ongoing" | "uploaded"
 *   durationSeconds: null | number
 *
 * Status flow (FIX #1):
 *   ongoing → after mark done remains in stop line list
 *          → after upload → removed from stop line list, appears in history
 *
 * History (FIX #2): only fetched after upload; only status = 'uploaded' rows.
 *
 * Layout: flex column with overflow hidden — mirrors FacilitiesDashboard
 *         so the page fits any screen size without stretching outside viewport.
 *         History panel now sits below the two-column layout and spans full width.
 *
 * Caching: pageLoading is true only when BOTH active and history are uncached
 *          (downtimeCache.active === null && downtimeCache.history === null).
 *          When cache exists, the page renders immediately and fetches in background —
 *          same pattern as FacilitiesDashboard's alertsCache.
 *
 * Error handling: fetch errors show an inline banner without collapsing any panel —
 *          same pattern as FacilitiesDashboard's fetchError inline banner.
 */

export default function DowntimePage() {
  const [stopLineList,       setStopLineList]       = useState(downtimeCache.active  ?? []);
  const [maintenanceHistory, setMaintenanceHistory] = useState(downtimeCache.history ?? []);
  const [pendingDone,        setPendingDone]        = useState(downtimeCache.pendingDone ?? []);

  // pageLoading: show overlay only when NEITHER cache exists — mirrors facilities' `alertsCache === null`
  const [pageLoading,    setPageLoading]    = useState(downtimeCache.active === null && downtimeCache.history === null);
  const [historyLoading, setHistoryLoading] = useState(downtimeCache.history === null);

  // Inline error banners — shown without collapsing any panel, mirrors FacilitiesDashboard
  const [activeError,  setActiveError]  = useState(null);
  const [historyError, setHistoryError] = useState(null);

  const [startOpen,    setStartOpen]    = useState(false);
  const [markDoneOpen, setMarkDoneOpen] = useState(false);
  const [uploadOpen,   setUploadOpen]   = useState(false);
  const [activeRecord, setActiveRecord] = useState(null);

  const [selectedHistory, setSelectedHistory] = useState(null); // state for history detail modal

  const [formData, setFormData] = useState(downtimeCache.formData ?? {
    lineName: "", areaId: "", technicianId: "",
    reason: "", remarks: "", duration: "", markedDone: "",
  });
  const [symptom, setSymptom] = useState(downtimeCache.symptom ?? "");

  // ── Map backend active record → local shape ──────────────────────────────
  const mapActiveRecord = (r) => ({
    id:              Number(r.id),
    areaId:          r.area_id,
    lineName:        r.line_name,
    technicianId:    r.processed_by,
    symptom:         r.symptom,
    processedAt:     r.processed_at,
    markedDoneAt:    r.marked_done_at ?? null,
    uploadedAt:      r.uploaded_at ?? null,
    status:          r.status ?? "ongoing",
    durationSeconds: r.duration_seconds ?? null,
    reason:          r.maintenance_reason ?? "",
    remarks:         r.remarks ?? "",
  });

  // ── Map backend history record → local shape ─────────────────────────────
  const mapHistoryRecord = (r) => ({
    id:              Number(r.id),
    areaId:          r.area_id,
    lineName:        r.line_name,
    technicianId:    r.processed_by,
    symptom:         r.symptom,
    reason:          r.maintenance_reason,
    remarks:         r.remarks,
    processedAt:     r.processed_at,
    markedDoneAt:    r.marked_done_at,
    markedDoneBy:    r.marked_done_by,
    uploadedAt:      r.uploaded_at,
    uploadedBy:      r.uploaded_by,
    durationSeconds: r.duration_seconds,
    status:          r.status,
  });

  function isSameHistory(a = [], b = []) {
  if (a === b) return true;
  if (a.length !== b.length) return false;

  for (let i = 0; i < a.length; i++) {
    const x = a[i];
    const y = b[i];

    if (
      x.id !== y.id ||
      x.areaId !== y.areaId ||
      x.lineName !== y.lineName ||
      x.technicianId !== y.technicianId ||
      x.symptom !== y.symptom ||
      x.reason !== y.reason ||
      x.remarks !== y.remarks ||
      x.processedAt !== y.processedAt ||
      x.markedDoneAt !== y.markedDoneAt ||
      x.markedDoneBy !== y.markedDoneBy ||
      x.uploadedAt !== y.uploadedAt ||
      x.uploadedBy !== y.uploadedBy ||
      x.durationSeconds !== y.durationSeconds ||
      x.status !== y.status
    ) {
      return false;
    }
  }

  return true;
}

  // ── Sync local state to module cache ─────────────────────────────────────
  useEffect(() => {
    if (downtimeCache.active !== null || stopLineList.length > 0) {
      downtimeCache.active = stopLineList;
    }
  }, [stopLineList]);

  useEffect(() => {
    if (downtimeCache.history !== null || maintenanceHistory.length > 0) {
      downtimeCache.history = maintenanceHistory;
    }
  }, [maintenanceHistory]);

  useEffect(() => {
    downtimeCache.pendingDone = pendingDone;
  }, [pendingDone]);

  useEffect(() => {
    downtimeCache.formData = formData;
  }, [formData]);

  useEffect(() => {
    downtimeCache.symptom = symptom;
  }, [symptom]);

  // FIX #2: refreshHistory called only after upload action
   const refreshHistory = async () => {
    const hasExistingHistory =
      (downtimeCache.history && downtimeCache.history.length > 0) ||
      maintenanceHistory.length > 0;

    if (!hasExistingHistory) setHistoryLoading(true);

    setHistoryError(null);
    try {
      const res = await axios.get(`${API_BASE}/history`);
      const mapped = res.data.data.map(mapHistoryRecord);

      setMaintenanceHistory(prev => {
        if (isSameHistory(prev, mapped)) return prev;
        downtimeCache.history = mapped;
        return mapped;
      });
    } catch (err) {
      if (err.response?.status !== 404) {
        console.error("Failed to fetch downtime history:", err);
        setHistoryError("Failed to load history. Please refresh.");
      }
    } finally {
      if (!hasExistingHistory) setHistoryLoading(false);
    }
  };

  // ── On mount: fetch active + history in parallel ──────────────────────────
  // If cache exists, render immediately (no overlay) and refresh in background —
  // same pattern as FacilitiesDashboard where loading = alertsCache === null.
  useEffect(() => {
    let activeResolved  = downtimeCache.active  !== null;
    let historyResolved = downtimeCache.history !== null;

    const checkBothResolved = () => {
      if (activeResolved && historyResolved) setPageLoading(false);
    };

    const fetchActive = async () => {
      try {
        const res = await axios.get(`${API_BASE}/active`);
        const filtered = res.data.data.filter(r => !r.uploaded_at && r.status !== "uploaded");
        const mapped   = filtered.map(mapActiveRecord);

        setStopLineList(prev => {
          const existingMap = new Map(prev.map(p => [p.id, p]));
          const merged = mapped.map(newRec => existingMap.get(newRec.id) ?? newRec);

          prev.forEach(localRecord => {
            if (localRecord.markedDoneAt && !localRecord.uploadedAt && !merged.some(r => r.id === localRecord.id)) {
              merged.push(localRecord);
            }
          });

          const unique = Array.from(
            new Map(merged.map(r => [r.id, r])).values()
          );

          downtimeCache.active = unique;
          return unique;
        });

        setActiveError(null);
      } catch (err) {
        if (err.response?.status !== 404) {
          console.error("Failed to fetch active downtime records:", err);
          // On error: keep existing list visible, show inline banner
          setActiveError("Failed to load active records. Showing cached data.");
        }
      } finally {
        activeResolved = true;
        checkBothResolved();
      }
    };

    const fetchHistory = async () => {
      const hasCachedHistory = downtimeCache.history !== null;
      if (!hasCachedHistory) setHistoryLoading(true);

      try {
        const res = await axios.get(`${API_BASE}/history`);
        const mapped = res.data.data.map(mapHistoryRecord);

        setMaintenanceHistory(prev => {
          if (isSameHistory(prev, mapped)) return prev;
          downtimeCache.history = mapped;
          return mapped;
        });

        setHistoryError(null);
      } catch (err) {
        if (err.response?.status !== 404) {
          console.error("Failed to fetch downtime history:", err);
          setHistoryError("Failed to load history. Showing cached data.");
        }
      } finally {
        if (!hasCachedHistory) setHistoryLoading(false);
        historyResolved = true;
        checkBothResolved();
      }
    };

    // If cache already exists, render immediately without blocking overlay —
    // same pattern as facilities: loading = alertsCache === null
    if (downtimeCache.active !== null) {
      setStopLineList(downtimeCache.active);
      activeResolved = true;
    }

    if (downtimeCache.history !== null) {
      setMaintenanceHistory(downtimeCache.history);
      setHistoryLoading(false);
      historyResolved = true;
    }

    checkBothResolved();

    // Always refresh in background so cached data stays fresh
    fetchActive();
    fetchHistory();

    const poll = setInterval(async () => {
      try {
        const res = await axios.get(`${API_BASE}/active`);
        const newRecords = res.data.data.filter(r => !r.uploaded_at && r.status !== "uploaded");
        setStopLineList(prev => {
          const existingMap = new Map(prev.map(p => [p.id, p]));
          for (const newRec of newRecords) {
            if (!existingMap.has(newRec.id)) {
              existingMap.set(newRec.id, mapActiveRecord(newRec));
            }
          }
          const merged = Array.from(existingMap.values());
          const unique = Array.from(
            new Map(merged.map(r => [Number(r.id), { ...r, id: Number(r.id) }])).values()
          );
          downtimeCache.active = unique;
          return unique;
        });
        setActiveError(null);
      } catch (err) {
        if (err.response?.status !== 404) {
          console.error("Poll failed:", err);
          // Silently fail on poll errors — don't show banner for background polls
        }
      }
    }, 30_000);

    return () => clearInterval(poll);
  }, []);

  // ── Called after StartDowntimeContent confirms successfully ──────────────
  const handleQueued = ({ id, sensorInfo, techInfo, symptomLabel, processedAt }) => {
    const normalizedId = Number(id);
    const newRecord = {
      id:              normalizedId,
      areaId:          sensorInfo.areaId,
      lineName:        sensorInfo.lineName,
      technicianId:    techInfo.technicianId,
      symptom:         symptomLabel,
      processedAt,
      markedDoneAt:    null,
      uploadedAt:      null,
      status:          "ongoing",
      durationSeconds: null,
      reason:          "",
      remarks:         "",
    };
    setStopLineList(prev => {
      const next = [newRecord, ...prev.filter(r => r.id !== newRecord.id)];
      downtimeCache.active = next;
      return next;
    });

    const nextFormData = {
      lineName:     sensorInfo.lineName,
      areaId:       sensorInfo.areaId,
      technicianId: techInfo.technicianId,
      reason: "", remarks: "", duration: "", markedDone: "",
    };

    setFormData(nextFormData);
    setSymptom(symptomLabel);

    downtimeCache.formData = nextFormData;
    downtimeCache.symptom  = symptomLabel;
  };

  // ── Called after MarkDoneContent resolves successfully ───────────────────
  // FIX #1: record remains in stop line list after mark done, only moves to history after upload.
  // 
  //
  const handleDone = (id, reason, { markedDoneAt, durationSeconds, reasonLabel, remarks }) => {
    let updatedRecord = null;
    const normalizedId = Number(id);
    setStopLineList(prev => {
      const next = prev.map(r => {
        if (r.id !== normalizedId) return r;

        updatedRecord = {
          ...r,
          reason: reasonLabel,
          remarks,
          markedDoneAt,
          durationSeconds,
        };

        return updatedRecord;
      });

      downtimeCache.active = next;
      return next;
    });

    if (updatedRecord) {
      setPendingDone(prev => {
        const next = [{
          ...updatedRecord,
        }, ...prev.filter(r => r.id !== updatedRecord.id)];
        downtimeCache.pendingDone = next;
        return next;
      });

      const nextFormData = {
        lineName:     updatedRecord.lineName || "",
        areaId:       updatedRecord.areaId || "",
        technicianId: updatedRecord.technicianId || "",
        reason:       reasonLabel,
        remarks,
        duration:     formatTimer(durationSeconds ?? 0),
        markedDone:   formatDate(markedDoneAt),
      };

      setFormData(nextFormData);
      setSymptom(updatedRecord.symptom || "");

      downtimeCache.formData = nextFormData;
      downtimeCache.symptom  = updatedRecord.symptom || "";
    }
  };

  // ── Called after UploadDowntimeContent succeeds ──────────────────────────
  // FIX #2: History refreshes here only — after upload.
  // Also remove uploaded records from stopLineList immediately.
  const handleUpload = async () => {
    const uploadedIds = new Set(pendingDone.map(r => Number(r.id)));
    setStopLineList(prev => {
      const next = prev.filter(r => !uploadedIds.has(r.id));
      downtimeCache.active = next;
      return next;
    });

    setPendingDone([]);
    downtimeCache.pendingDone = [];

    const clearedForm = { lineName: "", areaId: "", technicianId: "", reason: "", remarks: "", duration: "", markedDone: "" };

    setFormData(clearedForm);
    setSymptom("");

    downtimeCache.formData = clearedForm;
    downtimeCache.symptom  = "";

    await refreshHistory();
  };

  const pendingCount = pendingDone.length;

  return (
    <>
      <style>{GLOBAL_STYLES}</style>

      {pageLoading && <LoadingOverlay />}

      {/* ── Outer wrapper — flex column with overflow hidden, mirrors FacilitiesDashboard ── */}
      <div className="flex flex-col h-full overflow-hidden" style={{ minHeight: 0 }}>

        {/* ── Page header ── */}
        <div style={{ marginTop: 10, padding: "12px 24px", display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexShrink: 0 }} className="bg-background">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Manage Sensor IOT Maintenance</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {stopLineList.length} Active · {pendingDone.length} Pending Upload · {maintenanceHistory.length} Uploaded
              {pendingDone.length > 0 && (
                <span style={{ marginLeft: 10, fontWeight: 700, color: "#b45309" }}>
                  · {pendingDone.length} Awaiting Upload
                </span>
              )}
            </p>
          </div>
          <Button
            type="button" size="default" variant="default"
            style={{ cursor: "pointer" }}
            disabled={pendingCount === 0}
            onClick={() => setUploadOpen(true)}
          >
            Upload Maintenance{pendingCount > 0 ? ` (${pendingCount})` : ""}
          </Button>
        </div>

        {/* ── Dashboard Cards ── */}
        <div style={{ padding: "0 24px 16px", flexShrink: 0 }}>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <DashboardCard
              value={String(maintenanceHistory.length)}
              label="Uploaded"
              icon={CheckCheck}
              variant="success"
            />
            <DashboardCard
              value={String(stopLineList.length)}
              label="Active Maintenance"
              icon={Wrench}
              variant="warning"
            />
            <DashboardCard
              value={String(maintenanceHistory.filter(r => r.symptom === "No Data").length)}
              label="No Data"
              icon={ActivitySquare}
              variant="secondary" 
            />
            <DashboardCard
              value={String(maintenanceHistory.filter(r => r.symptom === "Breach").length)}
              label="Breach"
              icon={TriangleAlert}
              variant="destructive"
            />
          </div>
        </div>

        {/* ── Scrollable body — two-panel layout: stop line list (left) + form (right) ── */}
        <div style={{ flex: 1, overflowY: "auto", padding: "4px 24px 24px" }}>

          {/* ── Inline error banner for active records fetch — same pattern as FacilitiesDashboard ── */}
          {activeError && (
            <div style={{
              marginBottom: 12, padding: "10px 14px", borderRadius: 8,
              background: "#fef2f2", border: "1px solid #fca5a5",
              fontSize: 13, color: "#b91c1c", display: "flex", alignItems: "center", gap: 8,
            }}>
              <TriangleAlert size={14} style={{ flexShrink: 0 }} />
              {activeError}
            </div>
          )}

          <div style={{ display: "flex", gap: 20, alignItems: "flex-start" }}>

            {/* ── Left: stop line list panel — always rendered, empty on error ── */}
            <StopLineListPanel
              records={stopLineList}
              onRowClick={r => {
                if (r.markedDoneAt) return;
                setActiveRecord(r);
                setFormData({
                  lineName: r.lineName,
                  areaId: r.areaId,
                  technicianId: r.technicianId,
                  reason: r.reason || "",
                  remarks: r.remarks || "",
                  duration: r.durationSeconds ? formatTimer(r.durationSeconds) : "",
                  markedDone: r.markedDoneAt ? formatDate(r.markedDoneAt) : "",
                });
                setSymptom(r.symptom ?? "");
                setMarkDoneOpen(true);
              }}
              onStartDowntime={() => setStartOpen(true)}
            />

            {/* ── Right: maintenance form only (history moved below) — always rendered ── */}
            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 16 }}>
              <DowntimeFormPanel formData={formData} symptom={symptom} />
            </div>

          </div>

          {/* ── Inline error banner for history fetch — mirrors active error banner above ── */}
          {historyError && (
            <div style={{
              marginTop: 12, padding: "10px 14px", borderRadius: 8,
              background: "#fef2f2", border: "1px solid #fca5a5",
              fontSize: 13, color: "#b91c1c", display: "flex", alignItems: "center", gap: 8,
            }}>
              <TriangleAlert size={14} style={{ flexShrink: 0 }} />
              {historyError}
            </div>
          )}

          {/* ── History panel — now below the two columns, full width — always rendered ── */}
          <div style={{ marginTop: 20 }}>
            <MaintenanceHistoryPanel
              history={maintenanceHistory}
              loading={historyLoading}
              onViewDetails={setSelectedHistory}
            />
          </div>

        </div>

      </div>

      {/* ── START DOWNTIME MODAL ── */}
      <CustomModal
        open={startOpen}
        onOpenChange={open => { if (!open) setStartOpen(false); }}
        title="Start Maintenance"
        description="Scan 1: Sensor QR  →  Scan 2: Operator QR  →  Confirm"
        size="sm"
      >
        <StartDowntimeContent
          onQueued={handleQueued}
          onClose={() => setStartOpen(false)}
        />
      </CustomModal>

      {/* ── MARK DONE MODAL ── */}
      <CustomModal
        open={markDoneOpen}
        onOpenChange={open => { if (!open) { setMarkDoneOpen(false); setActiveRecord(null); } }}
        title="Mark as Done"
        description={activeRecord ? `${activeRecord.lineName} · ${activeRecord.areaId}` : ""}
        size="sm"
      >
        {activeRecord && (
          <MarkDoneContent
            record={activeRecord}
            onDone={handleDone}
            onClose={() => { setMarkDoneOpen(false); setActiveRecord(null); }}
          />
        )}
      </CustomModal>

      {/* ── UPLOAD DOWNTIME MODAL ── */}
      <CustomModal
        open={uploadOpen}
        onOpenChange={open => { if (!open) setUploadOpen(false); }}
        title="Upload"
        description="Review records before submitting to the database."
        size="sm"
      >
        <UploadDowntimeContent
          pendingDone={pendingDone}
          onUpload={handleUpload}
          onClose={() => setUploadOpen(false)}
        />
      </CustomModal>

      {/* ── HISTORY DETAIL MODAL ── */}
      <CustomModal
        open={!!selectedHistory}
        onOpenChange={open => { if (!open) setSelectedHistory(null); }}
        title="Maintenance Record"
        description={selectedHistory ? `${selectedHistory.lineName} · ${selectedHistory.areaId}` : ""}
        size="sm"
      >
        <HistoryDetailContent record={selectedHistory} />
      </CustomModal>
    </>
  );
}
