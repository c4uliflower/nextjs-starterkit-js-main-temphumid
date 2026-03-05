"use client";

// ─────────────────────────────────────────────────────────────────────────────
// IMPORTS
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useRef, useCallback } from "react";
import jsQR from "jsqr";
import { Button } from "@/components/ui/button";
import { CustomModal } from "@/components/custom/CustomModal";
import { Combobox } from "@/components/custom/Combobox";
import { DataTable } from "@/components/custom/DataTable";

// ─────────────────────────────────────────────────────────────────────────────
// BACKEND TRANSFER REFERENCE
// ─────────────────────────────────────────────────────────────────────────────
//
// ┌─ TRANSFER TO BACKEND ──────────────────────────────────────────────────────
// │  #1  DOWNTIME_REASONS      → GET /api/downtime/reasons
// │  #2  QR SCAN Sensor        → POST /api/downtime/validate-qr { context: "sensor" }
// │  #3  QR SCAN Technician    → POST /api/downtime/validate-qr { context: "technician" }
// │  #4  handleQueue()         → POST /api/downtime/start
// │  #5  STOP LINE LIST        → GET /api/downtime/active  (poll every 30s)
// │  #6  handleMarkDone()      → POST /api/downtime/resolve/:id
// │  #7  handleUpload()        → POST /api/downtime/upload
// │  #8  MAINTENANCE HISTORY   → GET /api/downtime/history
// │  #9  ESCALATION ALERT      → POST /api/downtime/escalate/:id
// │         Triggered when a record has been ongoing for >= 2 hours.
// │         Body: { id, sensorName, floor, technicianId, elapsedSeconds }
// │         Backend should notify the responsible supervisor/engineer via
// │         email, SMS, or internal messaging (Teams/Slack/etc.).
// │         The frontend fires this once per record using a ref-tracked set
// │         so it never double-fires across re-renders.
// └────────────────────────────────────────────────────────────────────────────


// ─────────────────────────────────────────────────────────────────────────────
// SECTION 1: CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

const ESCALATION_THRESHOLD_SECONDS = 2 * 60 * 60; // 2 hours

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 2: SAMPLE DATA
// ─────────────────────────────────────────────────────────────────────────────

const DOWNTIME_REASONS = [
  { id: "",            label: "Select reason…"             },
  { id: "offline",     label: "Sensor Offline / No Data"   },
  { id: "loose-conn",  label: "Loose Connection"           },
  { id: "hw-damage",   label: "Hardware Damage"            },
  { id: "calibration", label: "Calibration Drift"          },
  { id: "power",       label: "Power Issue"                },
  { id: "firmware",    label: "Firmware / Software Error"  },
  { id: "env",         label: "Environmental Interference" },
  { id: "other",       label: "Other"                      },
];

const REASON_OPTIONS = DOWNTIME_REASONS.filter(r => r.id !== "").map(r => ({ value: r.id, label: r.label }));
const REASON_SELECT_OPTIONS = [{ value: "", label: "Select reason…" }, ...REASON_OPTIONS];

const SYMPTOM_LABELS = {
  breach:  "Breach",
  no_data: "No Data",
};

const SAMPLE_STOP_LINE = [
  {
    id: "dt-003", sensorName: "SMT MH", floor: "P1F1", location: "SMT MH Zone",
    technicianName: "", technicianId: "12160",
    reason1: "Breach", reason2: "",
    startedAt: new Date(Date.now() - 1000 * 60 * 34),
    status: "ongoing", outcome: null, resolvedAt: null,
  },
];

const SAMPLE_HISTORY = [
  {
    id: "dth-001", sensorName: "SMT MH Dessicator 6", floor: "P1F1",
    technicianName: "", technicianId: "10017",
    reason1: "No Data", reason2: "Hardware Damage",
    startedAt: new Date(Date.now() - 1000 * 60 * 75),
    resolvedAt: new Date(Date.now() - 1000 * 60 * 8),
    outcome: "success",
  },
  {
    id: "dth-002", sensorName: "Dipping", floor: "P1F1",
    technicianName: "", technicianId: "10029",
    reason1: "Breach", reason2: "Firmware / Software Error",
    startedAt: new Date(Date.now() - 1000 * 60 * 60 * 5),
    resolvedAt: new Date(Date.now() - 1000 * 60 * 60 * 4),
    outcome: "failed",
  },
];

const OUTCOME_CONFIG = {
  success: { label: "Success", solid: "#198754", text: "#fff" },
  failed:  { label: "Failed",  solid: "#dc3545", text: "#fff" },
};


// ─────────────────────────────────────────────────────────────────────────────
// SECTION 2B: SENSOR & TECHNICIAN SAMPLE DATABASES
// ─────────────────────────────────────────────────────────────────────────────

const SENSOR_DB = [
  { chipId: "CHIP-001", lineName: "SMT MH",              plant: "P1", floor: "F1", location: "SMT MH Zone",  status: "breach"  },
  { chipId: "CHIP-002", lineName: "SMT MH Dessicator 3", plant: "P1", floor: "F1", location: "SMT MH Zone",  status: "no_data" },
  { chipId: "CHIP-003", lineName: "SMT MH Dessicator 6", plant: "P1", floor: "F1", location: "SMT MH Zone",  status: "active"  },
  { chipId: "CHIP-004", lineName: "Dipping",              plant: "P1", floor: "F1", location: "Dipping Area", status: "breach"  },
  { chipId: "CHIP-005", lineName: "Server Room",          plant: "P1", floor: "F2", location: "Server Room",  status: "no_data" },
];


// ─────────────────────────────────────────────────────────────────────────────
// SECTION 2C: QR VALIDATION FUNCTIONS
// ─────────────────────────────────────────────────────────────────────────────

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
    const res  = await fetch("/api/downtime/validate-sensor", {
      method:  "POST",
      headers: { "Content-Type": "application/json", "Accept": "application/json" },
      body:    JSON.stringify({ line_name: decoded }),
    });
    const json = await res.json();
    if (!res.ok || !json.valid) {
      return { ok: false, error: json.error ?? `Line "${decoded}" could not be validated.` };
    }
    return { ok: true, sensor: json.sensor };
  } catch {
    console.warn("[parseSensorQr] Backend unreachable — using local SENSOR_DB fallback");
    const sensor = SENSOR_DB.find(s => s.lineName.toLowerCase() === decoded.toLowerCase());
    if (!sensor) return { ok: false, error: `Line "${decoded}" was not found. (offline fallback)` };
    if (sensor.status !== "breach" && sensor.status !== "no_data") {
      return { ok: false, error: `${sensor.lineName} is active with no alert. (offline fallback)` };
    }
    return { ok: true, sensor };
  }
}

function parseTechnicianQr(rawValue) {
  const id = rawValue.trim();
  if (!id) return { ok: false, error: "QR code is empty. Please scan your employee ID QR." };
  if (!/^[a-zA-Z0-9\-]+$/.test(id)) {
    return { ok: false, error: "Unrecognized QR format. Please scan your employee ID QR code." };
  }
  return { ok: true, technicianId: id };
}

function validateMarkDoneTechnician(rawValue, expectedId) {
  const result = parseTechnicianQr(rawValue);
  if (!result.ok) return result;
  if (result.technicianId !== expectedId) {
    return {
      ok: false,
      error: `ID "${result.technicianId}" does not match the operator who started this record (${expectedId}). The same person must close it.`,
    };
  }
  return result;
}


// ─────────────────────────────────────────────────────────────────────────────
// SECTION 3: ESCALATION HOOK
// ─────────────────────────────────────────────────────────────────────────────

function useEscalation(records) {
  const firedRef = useRef(new Set());
  const [escalatedIds, setEscalatedIds] = useState(new Set());

  useEffect(() => {
    if (records.length === 0) return;

    const interval = setInterval(() => {
      const now = Date.now();
      const activeIds = new Set(records.map(r => r.id));
      firedRef.current.forEach(id => {
        if (!activeIds.has(id)) firedRef.current.delete(id);
      });

      records.forEach(record => {
        if (record.resolvedAt) return;
        const elapsedSeconds = Math.floor((now - record.startedAt.getTime()) / 1000);
        if (elapsedSeconds >= ESCALATION_THRESHOLD_SECONDS && !firedRef.current.has(record.id)) {
          firedRef.current.add(record.id);
          setEscalatedIds(prev => new Set([...prev, record.id]));
          triggerEscalationAlert(record, elapsedSeconds);
        }
      });
    }, 10000);

    return () => clearInterval(interval);
  }, [records]);

  const dismissEscalation = (id) => {
    setEscalatedIds(prev => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  };

  return { escalatedIds, dismissEscalation };
}

async function triggerEscalationAlert(record, elapsedSeconds) {
  console.warn(
    `[ESCALATION] Record "${record.id}" (${record.sensorName} · ${record.floor}) ` +
    `has been ongoing for ${Math.floor(elapsedSeconds / 3600)}h ${Math.floor((elapsedSeconds % 3600) / 60)}m. ` +
    `Technician ID: ${record.technicianId}. ` +
    `[BACKEND #9] Notify responsible supervisor — implement POST /api/downtime/escalate/:id`
  );

  // ── [BACKEND #9] Uncomment once the endpoint is live ──────────────────────
  // try {
  //   await fetch(`/api/downtime/escalate/${record.id}`, {
  //     method:  "POST",
  //     headers: { "Content-Type": "application/json", "Accept": "application/json" },
  //     body: JSON.stringify({
  //       sensorName:     record.sensorName,
  //       floor:          record.floor,
  //       technicianId:   record.technicianId,
  //       elapsedSeconds,
  //     }),
  //   });
  // } catch (err) {
  //   console.error("[ESCALATION] Failed to notify backend:", err);
  // }
  // ──────────────────────────────────────────────────────────────────────────
}


// ─────────────────────────────────────────────────────────────────────────────
// SECTION 4: UTILITY
// ─────────────────────────────────────────────────────────────────────────────

function formatTimer(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return [h, m, s].map(v => String(v).padStart(2, "0")).join(":");
}

function useElapsed(startedAt, resolvedAt) {
  const getSnapshot = () => Math.floor(((resolvedAt ?? new Date()).getTime() - startedAt.getTime()) / 1000);
  const [elapsed, setElapsed] = useState(getSnapshot);
  useEffect(() => {
    if (resolvedAt) return;
    const id = setInterval(() => setElapsed(getSnapshot()), 1000);
    return () => clearInterval(id);
  }, [startedAt, resolvedAt]);
  return elapsed;
}

function formatDate(date) {
  return date.toLocaleString("en-PH", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
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
    streamRef.current = null; rafRef.current = null;
  }, []);

  const tick = useCallback(() => {
    const video = videoRef.current; const canvas = canvasRef.current;
    if (!video || !canvas || doneRef.current) return;
    if (video.readyState === video.HAVE_ENOUGH_DATA) {
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      canvas.width = video.videoWidth; canvas.height = video.videoHeight;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      if (jsQR) {
        const code = jsQR(imageData.data, imageData.width, imageData.height, { inversionAttempts: "dontInvert" });
        if (code?.data) { doneRef.current = true; stopCamera(); onScan(code.data); return; }
      }
    }
    rafRef.current = requestAnimationFrame(tick);
  }, [onScan, stopCamera]);

  useEffect(() => {
    doneRef.current = false;
    let cancelled = false;
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

function FormField({ label, value }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 12 }}>
      <div style={{ width: 140, flexShrink: 0, fontSize: 13, color: "#495057" }}>{label}</div>
      <div style={{ flex: 1, padding: "7px 12px", background: "#f1f3f5", borderRadius: 5, fontSize: 13, color: value ? "#212529" : "#adb5bd", minHeight: 34 }}>{value || ""}</div>
    </div>
  );
}

function ConfirmedChip({ label, color, bg, onClear }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 14px", borderRadius: 5, background: bg }}>
      <span style={{ flex: 1, fontSize: 13, fontWeight: 700, color, letterSpacing: ".01em" }}>{label}</span>
      {onClear && (
        <button onClick={onClear}
          style={{ background: "rgba(255,255,255,0.25)", border: "none", borderRadius: 5, padding: "2px 8px", fontSize: 11, color, fontWeight: 600, cursor: "pointer", flexShrink: 0 }}>
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
        <div key={i} style={{ flex: 1, height: 3, borderRadius: 5, background: i < step ? "#435ebe" : "#e9ecef", transition: "background .2s" }} />
      ))}
    </div>
  );
}

function EscalationBanner({ record, onDismiss }) {
  return (
    <div style={{
      display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10,
      padding: "10px 14px", borderRadius: 5,
      background: "#fff3cd", border: "1.5px solid #ffc107",
      animation: "escalationPulse 2s ease-in-out infinite",
    }}>
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
          <span style={{ fontSize: 13 }}>⚠️</span>
          <span style={{ fontWeight: 700, fontSize: 12, color: "#856404" }}>ESCALATION — 2+ HOURS</span>
        </div>
        <div style={{ fontSize: 11, color: "#856404" }}>
          <strong>{record.sensorName}</strong> · {record.floor} · Operator: {record.technicianId}
        </div>
        <div style={{ fontSize: 10, color: "#856404", marginTop: 3, fontStyle: "italic" }}>
          Supervisor notification pending — awaiting backend integration
        </div>
      </div>
      <button
        onClick={() => onDismiss(record.id)}
        style={{ background: "none", border: "none", fontSize: 16, cursor: "pointer", color: "#856404", lineHeight: 1, flexShrink: 0, padding: "0 2px" }}
      >
        ×
      </button>
    </div>
  );
}


// ─────────────────────────────────────────────────────────────────────────────
// SECTION 7: MODAL CONTENT COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────

// ── 7A: START DOWNTIME ───────────────────────────────────────────────────────

function StartDowntimeContent({ onQueued, onClose }) {
  const [step,       setStep]       = useState(1);
  const [saving,     setSaving]     = useState(false);
  const [apiError,   setApiError]   = useState(null);
  const [scanError1, setScanError1] = useState(null);
  const [scanError2, setScanError2] = useState(null);
  const [sensorInfo, setSensorInfo] = useState(null);
  const [techInfo,   setTechInfo]   = useState(null);

  const reset = () => {
    setStep(1); setSaving(false); setApiError(null);
    setScanError1(null); setScanError2(null);
    setSensorInfo(null); setTechInfo(null);
  };

  const handleQueue = async () => {
    setSaving(true); setApiError(null);
    try {
      await new Promise(r => setTimeout(r, 500));
      onQueued({ sensorInfo, techInfo, symptom: sensorInfo.status });
      reset(); onClose();
    } catch (err) {
      setApiError(err.message ?? "Something went wrong. Please try again.");
    } finally { setSaving(false); }
  };

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

  const handleTechScan = rawValue => {
    setScanError2(null);
    const result = parseTechnicianQr(rawValue);
    if (!result.ok) { setScanError2(result.error); return; }
    setTechInfo({ technicianId: result.technicianId });
    setStep(3);
  };

  const floorLabel = sensorInfo ? `P${sensorInfo.plant}F${sensorInfo.floor.replace("F","")}` : "";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <StepBar step={step} />

      {step === 1 && (
        <>
          <QrScanner
            label="Point camera at the QR code on the sensor or its location label."
            onScan={handleSensorScan}
            onError={msg => setScanError1(msg)}
          />
          {scanError1 && <p className="text-sm text-destructive" style={{ marginTop: 4 }}>{scanError1}</p>}
          <div style={{ display: "flex", gap: 8, flexDirection: "column" }}>
            <Button type="button" size="sm" variant="outline" style={{ cursor: "pointer" }}
              onClick={() => handleSensorScan("http://192.168.1.16:4001/index1.php?line_name=SMT+MH")}>
              Test: SMT MH (Breach)
            </Button>
            <Button type="button" size="sm" variant="outline" style={{ cursor: "pointer" }}
              onClick={() => handleSensorScan("http://192.168.1.16:4001/index1.php?line_name=SMT+MH+Dessicator+3")}>
              Test: SMT MH Dessicator 3 (No Data)
            </Button>
            <Button type="button" size="sm" variant="outline" style={{ cursor: "pointer" }}
              onClick={() => handleSensorScan("http://192.168.1.16:4001/index1.php?line_name=SMT+MH+Dessicator+6")}>
              Test: SMT MH Dessicator 6 (Active — should fail)
            </Button>
          </div>
        </>
      )}

      {step === 2 && sensorInfo && (
        <>
          <ConfirmedChip
            label={`${sensorInfo.lineName}  ·  ${floorLabel}  ·  ${sensorInfo.location}`}
            color="#fff" bg="#435ebe"
            onClear={() => { setSensorInfo(null); setScanError1(null); setStep(1); }}
          />
          <QrScanner
            label="Scan the QR on your employee ID. Operator details fill in automatically."
            onScan={handleTechScan}
            onError={msg => setScanError2(msg)}
          />
          {scanError2 && <p className="text-sm text-destructive">{scanError2}</p>}
          <div style={{ display: "flex", gap: 8, flexDirection: "column" }}>
            <Button type="button" size="sm" variant="outline" style={{ cursor: "pointer" }} onClick={() => handleTechScan("12160")}>
              Test: Scan ID 12160
            </Button>
            <Button type="button" size="sm" variant="outline" style={{ cursor: "pointer" }} onClick={() => handleTechScan("00000")}>
              Test: Scan ID 00000
            </Button>
          </div>
          <Button type="button" size="default" variant="outline" className="w-full" style={{ cursor: "pointer" }} onClick={() => setStep(1)}>Back</Button>
        </>
      )}

      {step === 3 && sensorInfo && techInfo && (
        <>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <ConfirmedChip
              label={`${sensorInfo.lineName}  ·  ${floorLabel}`}
              color="#fff" bg="#435ebe"
              onClear={() => { setSensorInfo(null); setScanError1(null); setStep(1); }}
            />
            <ConfirmedChip
              label={`Operator ID: ${techInfo.technicianId}`}
              color="#fff" bg="#435ebe"
              onClear={() => { setTechInfo(null); setScanError2(null); setStep(2); }}
            />
            <ConfirmedChip
              label={`Symptom: ${SYMPTOM_LABELS[sensorInfo.status]}`}
              color="#fff" bg="#dc3545"
            />
          </div>
          {apiError && <p className="text-sm text-destructive">{apiError}</p>}
          <div style={{ display: "flex", gap: 8 }}>
            <Button type="button" size="default" variant="outline" className="flex-1" style={{ cursor: "pointer" }} onClick={() => setStep(2)} disabled={saving}>Back</Button>
            <Button type="button" size="default" variant="default" className="flex-1" style={{ cursor: "pointer" }} onClick={handleQueue} disabled={saving}>
              {saving ? "Starting…" : "Queue for Downtime"}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}


// ── 7B: MARK DONE ────────────────────────────────────────────────────────────

function MarkDoneContent({ record, onDone, onClose }) {
  const [step,          setStep]          = useState(1);
  const [outcome,       setOutcome]       = useState("");
  const [reason,        setReason]        = useState("");
  const [saving,        setSaving]        = useState(false);
  const [apiError,      setApiError]      = useState(null);
  const [scanError,     setScanError]     = useState(null);
  const [confirmedTech, setConfirmedTech] = useState(null);

  const reset = () => {
    setStep(1); setOutcome(""); setReason("");
    setSaving(false); setApiError(null); setScanError(null);
    setConfirmedTech(null);
  };

  const handleConfirm = async () => {
    if (!outcome || !reason) return;
    setSaving(true); setApiError(null);
    try {
      await new Promise(r => setTimeout(r, 400));
      onDone(record.id, outcome, reason);
      reset(); onClose();
    } catch (err) {
      setApiError(err.message ?? "Something went wrong.");
    } finally { setSaving(false); }
  };

  const handleReScan = rawValue => {
    setScanError(null);
    const result = validateMarkDoneTechnician(rawValue, record.technicianId);
    if (!result.ok) { setScanError(result.error); return; }
    setConfirmedTech({ technicianId: result.technicianId });
    setStep(2);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <StepBar step={step} total={3} />

      {step === 1 && (
        <>
          <div style={{ padding: "10px 14px", borderRadius: 5, background: "#f1f3f5", fontSize: 13, color: "#495057" }}>
            <span style={{ fontWeight: 600 }}>Expected operator ID: </span>{record.technicianId}
          </div>
          <QrScanner
            label="Re-scan your employee ID QR. Must match the technician who started this record."
            onScan={handleReScan}
            onError={msg => setScanError(msg)}
          />
          {scanError && <p className="text-sm text-destructive">{scanError}</p>}
          <Button type="button" size="sm" variant="outline" className="w-full" style={{ cursor: "pointer" }}
            onClick={() => handleReScan(record.technicianId)}>
            Test: Scan correct ID ({record.technicianId})
          </Button>
          <Button type="button" size="sm" variant="outline" className="w-full" style={{ cursor: "pointer" }}
            onClick={() => handleReScan("99999")}>
            Test: Scan wrong ID (should fail)
          </Button>
        </>
      )}

      {step === 2 && confirmedTech && (
        <>
          <ConfirmedChip label={`Operator ID: ${confirmedTech.technicianId}`} color="#fff" bg="#435ebe" />
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Select Outcome <span style={{ color: "#dc3545" }}>*</span>
          </label>
          <div style={{ display: "flex", gap: 8 }}>
            {Object.entries(OUTCOME_CONFIG).map(([key, cfg]) => (
              <button key={key} onClick={() => { setOutcome(key); setStep(3); }} disabled={saving}
                style={{ flex: 1, padding: "8px 15px", border: "none", borderRadius: 5, cursor: "pointer",
                  background: cfg.solid, color: cfg.text, fontWeight: 700, fontSize: 13,
                  transition: "all .15s", opacity: saving ? 0.6 : 1 }}>
                {cfg.label}
              </button>
            ))}
          </div>
          <Button type="button" size="default" variant="outline" className="w-full" style={{ cursor: "pointer" }} onClick={() => setStep(1)} disabled={saving}>Back</Button>
        </>
      )}

      {step === 3 && (
        <>
          <ConfirmedChip
            label={`Outcome: ${OUTCOME_CONFIG[outcome].label}`}
            color={OUTCOME_CONFIG[outcome].text} bg={OUTCOME_CONFIG[outcome].solid}
          />
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Reason for Maintenance <span style={{ color: "#dc3545" }}>*</span>
            </label>
            <Combobox options={REASON_SELECT_OPTIONS} value={reason} onValueChange={setReason} placeholder="Select reason…" disabled={saving} className="w-full mt-2" />
          </div>
          {apiError && <p className="text-sm text-destructive">{apiError}</p>}
          <div style={{ display: "flex", gap: 8 }}>
            <Button type="button" size="default" variant="outline" className="flex-1" style={{ cursor: "pointer" }} onClick={() => setStep(2)} disabled={saving}>Back</Button>
            <Button type="button" size="default" variant="default" className="flex-1" style={{ cursor: "pointer" }} onClick={handleConfirm} disabled={!outcome || !reason || saving}>
              {saving ? "Saving…" : "Confirm & Mark Done"}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}


// ── 7C: UPLOAD DOWNTIME ──────────────────────────────────────────────────────

function UploadDowntimeContent({ pendingDone, onUpload, onClose }) {
  const [saving,   setSaving]   = useState(false);
  const [apiError, setApiError] = useState(null);

  const handleUpload = async () => {
    setSaving(true); setApiError(null);
    try {
      await new Promise(r => setTimeout(r, 600));
      onUpload(); onClose();
    } catch (err) {
      setApiError(err.message ?? "Something went wrong.");
    } finally { setSaving(false); }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <p className="text-sm text-muted-foreground">{pendingDone.length} resolved record{pendingDone.length !== 1 ? "s" : ""} will be finalized and submitted.</p>
      {pendingDone.length === 0
        ? <p className="text-sm text-muted-foreground text-center" style={{ padding: "16px 0" }}>No resolved records yet. Mark records as done first.</p>
        : pendingDone.map(r => {
            const oc = OUTCOME_CONFIG[r.outcome] ?? OUTCOME_CONFIG.success;
            return (
              <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", border: "1px solid #e9ecef", borderRadius: 5 }}>
                <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 5, background: oc.solid, color: oc.text, textTransform: "uppercase", letterSpacing: ".04em", flexShrink: 0 }}>{oc.label}</span>
                <span className="text-sm font-semibold">{r.sensorName}</span>
                <span className="text-muted-foreground" style={{ fontSize: 11 }}>{r.floor}</span>
                <span className="text-muted-foreground" style={{ fontSize: 11, marginLeft: "auto" }}>{r.reason1}</span>
              </div>
            );
          })
      }
      {apiError && <p className="text-sm text-destructive">{apiError}</p>}
      <div style={{ display: "flex", gap: 8 }}>
        <Button type="button" size="default" variant="outline" className="flex-1" style={{ cursor: "pointer" }} onClick={onClose} disabled={saving}>Cancel</Button>
        <Button type="button" size="default" variant="default" className="flex-1" style={{ cursor: "pointer" }} onClick={handleUpload} disabled={pendingDone.length === 0 || saving}>
          {saving ? "Uploading…" : "Upload Downtime"}
        </Button>
      </div>
    </div>
  );
}


// ─────────────────────────────────────────────────────────────────────────────
// SECTION 8: STOP LINE ROW
// ─────────────────────────────────────────────────────────────────────────────

function StopLineRow({ record, onClick }) {
  const elapsed = useElapsed(record.startedAt, record.resolvedAt);
  const isOverdue = elapsed >= ESCALATION_THRESHOLD_SECONDS;

  return (
    <div onClick={() => onClick(record)}
      style={{
        display: "grid", gridTemplateColumns: "1fr auto", alignItems: "center",
        gap: 10, padding: "10px 14px", borderRadius: 5, border: "none",
        background: isOverdue ? "#e65c00" : "#f59e0b",
        cursor: "pointer", transition: "opacity .15s",
      }}
      onMouseEnter={e => { e.currentTarget.style.opacity = ".8"; }}
      onMouseLeave={e => { e.currentTarget.style.opacity = "1"; }}
    >
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
          <span style={{ fontWeight: 700, fontSize: 13, color: "#000" }}>{record.sensorName}</span>
          <span style={{ fontSize: 10, fontWeight: 700, padding: "1px 7px", borderRadius: 5, background: "rgba(0,0,0,0.15)", color: "#000" }}>
            {isOverdue ? "ESCALATED" : "ONGOING"}
          </span>
        </div>
        <div style={{ fontSize: 11, color: "#000" }}>{record.floor} · {record.technicianId}</div>
        <div style={{ fontSize: 11, color: "#000" }}>{record.reason1}{record.reason2 ? ` · ${record.reason2}` : ""}</div>
      </div>
      <div style={{ textAlign: "right", flexShrink: 0 }}>
        <div style={{ fontFamily: "monospace", fontSize: 15, fontWeight: 700, color: "#000" }}>{formatTimer(elapsed)}</div>
        <div style={{ fontSize: 10, color: "#000", marginTop: 2 }}>Tap to Mark Done</div>
      </div>
    </div>
  );
}


// ─────────────────────────────────────────────────────────────────────────────
// SECTION 9: STOP LINE LIST PANEL
// ─────────────────────────────────────────────────────────────────────────────

function StopLineListPanel({ records, onRowClick, onStartDowntime, escalatedIds, onDismissEscalation }) {
  return (
    <div style={{ width: 360, flexShrink: 0, background: "#fff", border: "1px solid #e9ecef", borderRadius: 5, padding: "20px", display: "flex", flexDirection: "column" }}>
      <p className="font-bold text-center">Stop Line List</p>
      <p className="text-sm text-muted-foreground text-center mt-1 mb-4">Sensors that are still on downtime are shown here</p>

      <div style={{ display: "grid", gridTemplateColumns: "1fr auto", padding: "6px 14px", fontSize: 11, fontWeight: 700, color: "#6c757d", textTransform: "uppercase", letterSpacing: ".06em", borderBottom: "1.5px solid #e9ecef", marginBottom: 8 }}>
        <span>LINE AND SENSOR</span><span>ELAPSED</span>
      </div>

      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8, marginBottom: 16, minHeight: 80 }}>
        {records.length === 0
          ? <p className="text-sm text-muted-foreground text-center" style={{ padding: "24px 0" }}>No active downtime records.</p>
          : records.map(r => (
              <div key={r.id} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <StopLineRow record={r} onClick={onRowClick} isEscalated={escalatedIds.has(r.id)} />
                {escalatedIds.has(r.id) && (
                  <EscalationBanner record={r} onDismiss={onDismissEscalation} />
                )}
              </div>
            ))
        }
      </div>

      <Button type="button" size="default" variant="default" className="w-full" style={{ cursor: "pointer" }} onClick={onStartDowntime}>
        Start Downtime
      </Button>
    </div>
  );
}


// ─────────────────────────────────────────────────────────────────────────────
// SECTION 10: DOWNTIME FORM PANEL
// ─────────────────────────────────────────────────────────────────────────────

function DowntimeFormPanel({ formData, symptom }) {
  return (
    <div style={{ flex: 1, background: "#fff", border: "1px solid #e9ecef", borderRadius: 5, padding: "20px 24px" }}>
      <p className="font-bold text-center mb-5">Downtime Form</p>
      <FormField label="Symptom:"          value={symptom}                />
      <FormField label="Sensor / Line QR:" value={formData.sensorId}      />
      <FormField label="Sensor Name:"      value={formData.sensorName}    />
      <FormField label="Floor:"            value={formData.floor}         />
      <FormField label="Location:"         value={formData.location}      />
      <FormField label="Operator QR:"      value={formData.technicianId}  />
      <FormField label="Operator Name:"    value={formData.technicianName}/>
    </div>
  );
}


// ─────────────────────────────────────────────────────────────────────────────
// SECTION 11: MAINTENANCE HISTORY PANEL
// ─────────────────────────────────────────────────────────────────────────────

const historyColumns = [
  { accessorKey: "sensorName",     header: "Sensor"     },
  { accessorKey: "floor",          header: "Floor"      },
  { accessorKey: "technicianName", header: "Technician" },
  { accessorKey: "reason1",        header: "Symptom"    },
  { accessorKey: "reason2",        header: "Reason"     },
  {
    header: "Duration",
    cell: ({ row }) => formatTimer(Math.floor((row.original.resolvedAt.getTime() - row.original.startedAt.getTime()) / 1000)),
  },
  {
    accessorKey: "resolvedAt",
    header: "Resolved",
    cell: ({ row }) => formatDate(row.original.resolvedAt),
  },
  {
    header: "Outcome",
    cell: ({ row }) => {
      const oc = OUTCOME_CONFIG[row.original.outcome] ?? OUTCOME_CONFIG.success;
      return <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 5, background: oc.solid, color: oc.text, textTransform: "uppercase", letterSpacing: ".04em" }}>{oc.label}</span>;
    },
  },
];

function MaintenanceHistoryPanel({ history }) {
  return (
    <div style={{ flex: 1, background: "#fff", border: "1px solid #e9ecef", borderRadius: 5, padding: "20px 24px" }}>
      <p className="font-bold mb-4">Maintenance History</p>
      {history.length === 0
        ? <p className="text-sm text-muted-foreground text-center" style={{ padding: "24px 0" }}>No resolved records yet.</p>
        : <DataTable columns={historyColumns} data={history} />
      }
    </div>
  );
}


// ─────────────────────────────────────────────────────────────────────────────
// SECTION 12: GLOBAL STYLES
// ─────────────────────────────────────────────────────────────────────────────

const ESCALATION_STYLES = `
  @keyframes escalationPulse {
    0%, 100% { border-color: #ffc107; }
    50%       { border-color: #e65c00; }
  }
`;


// ─────────────────────────────────────────────────────────────────────────────
// SECTION 13: MAIN PAGE
// ─────────────────────────────────────────────────────────────────────────────

export default function DowntimePage() {
  const [stopLineList,       setStopLineList]       = useState(SAMPLE_STOP_LINE);
  const [maintenanceHistory, setMaintenanceHistory] = useState(SAMPLE_HISTORY);
  const [pendingDone,        setPendingDone]        = useState([]);

  const [startOpen,    setStartOpen]    = useState(false);
  const [markDoneOpen, setMarkDoneOpen] = useState(false);
  const [uploadOpen,   setUploadOpen]   = useState(false);
  const [activeRecord, setActiveRecord] = useState(null);

  const [formData, setFormData] = useState({ sensorId: "", sensorName: "", floor: "", location: "", technicianId: "", technicianName: "" });
  const [symptom,  setSymptom]  = useState("");

  const { escalatedIds, dismissEscalation } = useEscalation(stopLineList);

  const handleQueued = ({ sensorInfo, techInfo, symptom: rawSymptom }) => {
    const symptomLabel = SYMPTOM_LABELS[rawSymptom] ?? rawSymptom;
    const floorLabel = `P${sensorInfo.plant}F${sensorInfo.floor.replace("F","")}`;
    setStopLineList(prev => [{
      id:             `dt-${Date.now()}`,
      sensorName:     sensorInfo.lineName,
      floor:          floorLabel,
      location:       sensorInfo.location,
      technicianName: techInfo.technicianName,
      technicianId:   techInfo.technicianId,
      reason1:        symptomLabel,
      reason2:        "",
      startedAt:      new Date(),
      status:         "ongoing",
      outcome:        null,
      resolvedAt:     null,
    }, ...prev]);
    setFormData({
      sensorId:       sensorInfo.chipId,
      sensorName:     sensorInfo.lineName,
      floor:          floorLabel,
      location:       sensorInfo.location,
      technicianId:   techInfo.technicianId,
      technicianName: "",
    });
    setSymptom(symptomLabel);
  };

  const handleDone = (id, outcome, reason) => {
    const resolved = stopLineList.find(r => r.id === id);
    if (!resolved) return;
    const resolvedAt  = new Date();
    const reasonLabel = DOWNTIME_REASONS.find(r => r.id === reason)?.label ?? reason;
    setStopLineList(prev => prev.filter(r => r.id !== id));
    setPendingDone(prev => [{ ...resolved, status: "done", outcome, reason2: reasonLabel, resolvedAt }, ...prev]);
  };

  const handleUpload = () => {
    setMaintenanceHistory(prev => [...pendingDone, ...prev]);
    setPendingDone([]);
    setFormData({ sensorId: "", sensorName: "", floor: "", location: "", technicianId: "", technicianName: "" });
    setSymptom("");
  };

  const pendingCount = pendingDone.length;

  return (
    <>
      <style>{ESCALATION_STYLES}</style>

      <div style={{ minHeight: "100vh", overflowX: "hidden" }}>

        {/* ── Page header ── */}
        <div style={{ padding: "25px 30px 16px", display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
          <div className="bg-background">
            <h1 className="text-2xl font-bold">Sensor Downtime & Maintenance Recording</h1>
            <p className="text-muted-foreground mt-1">For sensor maintenance only</p>
          </div>
          <Button type="button" size="default" variant="default" style={{ cursor: "pointer" }} disabled={pendingCount === 0} onClick={() => setUploadOpen(true)}>
            Upload Downtime{pendingCount > 0 ? ` (${pendingCount})` : ""}
          </Button>
        </div>

        {/* ── Two-panel layout ── */}
        <div style={{ padding: "0 30px 20px", display: "flex", gap: 20, alignItems: "flex-start" }}>
          <StopLineListPanel
            records={stopLineList}
            onRowClick={r => { setActiveRecord(r); setMarkDoneOpen(true); }}
            onStartDowntime={() => setStartOpen(true)}
            escalatedIds={escalatedIds}
            onDismissEscalation={dismissEscalation}
          />
          <DowntimeFormPanel formData={formData} symptom={symptom} />
        </div>

        {/* ── Maintenance History ── */}
        <div style={{ padding: "0 30px 30px" }}>
          <MaintenanceHistoryPanel history={maintenanceHistory} />
        </div>
      </div>

      {/* ── START DOWNTIME MODAL ── */}
      <CustomModal open={startOpen} onOpenChange={open => { if (!open) setStartOpen(false); }} title="Start Downtime" description="Scan 1: Sensor QR  →  Scan 2: Operator QR  →  Confirm" size="sm">
        <StartDowntimeContent onQueued={handleQueued} onClose={() => setStartOpen(false)} />
      </CustomModal>

      {/* ── MARK DONE MODAL ── */}
      <CustomModal open={markDoneOpen} onOpenChange={open => { if (!open) { setMarkDoneOpen(false); setActiveRecord(null); } }} title="Mark as Done" description={activeRecord ? `${activeRecord.sensorName} · ${activeRecord.floor}` : ""} size="sm">
        {activeRecord && <MarkDoneContent record={activeRecord} onDone={handleDone} onClose={() => { setMarkDoneOpen(false); setActiveRecord(null); }} />}
      </CustomModal>

      {/* ── UPLOAD DOWNTIME MODAL ── */}
      <CustomModal open={uploadOpen} onOpenChange={open => { if (!open) setUploadOpen(false); }} title="Upload Downtime" description="Review resolved records before submitting to the database." size="sm">
        <UploadDowntimeContent pendingDone={pendingDone} onUpload={handleUpload} onClose={() => setUploadOpen(false)} />
      </CustomModal>
    </>
  );
}