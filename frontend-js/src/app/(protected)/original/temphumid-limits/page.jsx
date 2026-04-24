"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import axios from "@/lib/axios";

const API_BASE = '/api/temphumid';

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 1: DATA LAYER
// ─────────────────────────────────────────────────────────────────────────────

// All floors in display order — slug maps to the backend ?floor= param.
// label is shown in the accordion header; subLabel is the short tag.
const FLOORS = [
  { slug: "p1f1",  label: "Plant 1 · Floor 1",     subLabel: "P1F1"   },
  { slug: "p1f2",  label: "Plant 1 · Floor 2",     subLabel: "P1F2"   },
  { slug: "p2f1",  label: "Plant 2 · Floor 1",     subLabel: "P2F1"   },
  { slug: "p2f2",  label: "Plant 2 · Floor 2",     subLabel: "P2F2"   },
  { slug: "p12f2", label: "Plant 1 & 2 · Floor 2", subLabel: "Bridge" },
  { slug: "wh",    label: "Warehouse",              subLabel: "WH"    },
];

// All sensor registry entries across all floors.
// Each entry carries enough info to resolve areaId for API calls and group for display.
// NOTE: P1F1 has two groups — "Sensors" and "Dessicators" — matching the map page.
//       All other floors use "Sensors" only.
const ALL_SENSORS = [
  // ── Plant 1 Floor 1 ──
  { id: "aoi",         areaId: "P1F1-04", lineName: "AOI",                  floorSlug: "p1f1", group: "Sensors"     },
  { id: "dipping2",    areaId: "P1F1-06", lineName: "Dipping2",             floorSlug: "p1f1", group: "Sensors"     },
  { id: "dipping",     areaId: "P1F1-01", lineName: "Dipping",              floorSlug: "p1f1", group: "Sensors"     },
  { id: "server-room", areaId: "P1F1-03", lineName: "Server Room",          floorSlug: "p1f1", group: "Sensors"     },
  { id: "smt",         areaId: "P1F1-02", lineName: "SMT",                  floorSlug: "p1f1", group: "Sensors"     },
  { id: "smt-cs",      areaId: "P1F1-10", lineName: "SMT - Cold Storage",   floorSlug: "p1f1", group: "Sensors"     },
  { id: "smt-mh",      areaId: "P1F1-05", lineName: "SMT MH",               floorSlug: "p1f1", group: "Sensors"     },
  { id: "smt-mh-rcv",  areaId: "P1F1-14", lineName: "SMT MH Receiving",     floorSlug: "p1f1", group: "Sensors"     },
  { id: "bga-r",       areaId: "P1F1-15", lineName: "BGA Rework",           floorSlug: "p1f1", group: "Sensors"     },
  { id: "coating",     areaId: "P1F1-17", lineName: "Coating Area",         floorSlug: "p1f1", group: "Sensors"     },
  { id: "dess-1",      areaId: "P1F1-09", lineName: "SMT MH Dessicator 1",  floorSlug: "p1f1", group: "Dessicators" },
  { id: "dess-2",      areaId: "P1F1-07", lineName: "SMT MH Dessicator 2",  floorSlug: "p1f1", group: "Dessicators" },
  { id: "dess-3",      areaId: "P1F1-11", lineName: "SMT MH Dessicator 3",  floorSlug: "p1f1", group: "Dessicators" },
  { id: "dess-4",      areaId: "P1F1-12", lineName: "SMT MH Dessicator 4",  floorSlug: "p1f1", group: "Dessicators" },
  { id: "dess-5",      areaId: "P1F1-13", lineName: "SMT MH Dessicator 5",  floorSlug: "p1f1", group: "Dessicators" },
  // ── Plant 1 Floor 2 ──
  { id: "brother-assy-1", areaId: "P1F2-03", lineName: "Brother Assy 1",       floorSlug: "p1f2", group: "Sensors" },
  { id: "brother-assy-2", areaId: "P1F2-02", lineName: "Brother Assy 2",       floorSlug: "p1f2", group: "Sensors" },
  { id: "jcm-pcba",       areaId: "P1F2-01", lineName: "JCM PCBA",             floorSlug: "p1f2", group: "Sensors" },
  { id: "mh-brother-pkg", areaId: "P1F2-05", lineName: "MH Brother Packaging", floorSlug: "p1f2", group: "Sensors" },
  // ── Plant 2 Floor 1 ──
  { id: "fg",            areaId: "P2F1-03", lineName: "FG",                      floorSlug: "p2f1", group: "Sensors" },
  { id: "wh-office",     areaId: "P2F1-01", lineName: "Warehouse Office",        floorSlug: "p2f1", group: "Sensors" },
  { id: "wh-cs",         areaId: "P2F1-16", lineName: "WH-Cold Storage",         floorSlug: "p2f1", group: "Sensors" },
  { id: "wh-cs2",        areaId: "P2F1-17", lineName: "WH-Cold Storage 2",       floorSlug: "p2f1", group: "Sensors" },
  { id: "wo-north",      areaId: "P2F1-18", lineName: "WO-North",                floorSlug: "p2f1", group: "Sensors" },
  { id: "wo-south-ha",   areaId: "P2F1-07", lineName: "WO-South - Holding Area", floorSlug: "p2f1", group: "Sensors" },
  { id: "wo-sw-iqc",     areaId: "P2F1-04", lineName: "WO-S-West-IQC",           floorSlug: "p2f1", group: "Sensors" },
  { id: "wo-w-south-qa", areaId: "P2F1-05", lineName: "WO-W South-QA",           floorSlug: "p2f1", group: "Sensors" },
  { id: "facility",      areaId: "P2F1-06", lineName: "Facilities",              floorSlug: "p2f1", group: "Sensors" },
  // ── Plant 2 Floor 2 ──
  { id: "calibration-room", areaId: "P2F2-04", lineName: "Calibration Room",     floorSlug: "p2f2", group: "Sensors" },
  { id: "jcm-assy",         areaId: "P2F2-01", lineName: "JCM Assy",             floorSlug: "p2f2", group: "Sensors" },
  { id: "wh-brother-pkg",   areaId: "P2F2-02", lineName: "WH Brother Packaging", floorSlug: "p2f2", group: "Sensors" },
  { id: "wh-mh-jcm-assy",   areaId: "P2F2-03", lineName: "WH-MH JCM Assy",       floorSlug: "p2f2", group: "Sensors" },
  { id: "cis",              areaId: "P1F1-16", lineName: "CIS",                  floorSlug: "p2f2", group: "Sensors" },
  // ── Bridge ──
  { id: "p1p2-bridge", areaId: "P1F2-06", lineName: "P1P2_Bridge", floorSlug: "p12f2", group: "Sensors" },
  // ── Warehouse ──
  { id: "wh-a", areaId: "P2F1-08", lineName: "WH - A", floorSlug: "wh", group: "Sensors" },
  { id: "wh-b", areaId: "P2F1-09", lineName: "WH - B", floorSlug: "wh", group: "Sensors" },
  { id: "wh-c", areaId: "P2F1-10", lineName: "WH - C", floorSlug: "wh", group: "Sensors" },
  { id: "wh-d", areaId: "P2F1-11", lineName: "WH - D", floorSlug: "wh", group: "Sensors" },
  { id: "wh-e", areaId: "P2F1-12", lineName: "WH - E", floorSlug: "wh", group: "Sensors" },
  { id: "wh-f", areaId: "P2F1-13", lineName: "WH - F", floorSlug: "wh", group: "Sensors" },
  { id: "wh-g", areaId: "P2F1-14", lineName: "WH - G", floorSlug: "wh", group: "Sensors" },
  { id: "wh-h", areaId: "P2F1-15", lineName: "WH - H", floorSlug: "wh", group: "Sensors" },
];

// Default limits applied as fallback when no DB entry exists for a sensor.
// Mirrors the fallback used in each map page's limits fetch.
const DEFAULT_LIMITS = { tempUL: 28, tempLL: 13, humidUL: 80, humidLL: 40 };

// Module-level cache — persists across navigations so the page restores
// instantly on revisit without a loading flash.
// Shape: { [sensorId]: { tempUL, tempLL, humidUL, humidLL } }
let limitsCache = {};


// ─────────────────────────────────────────────────────────────────────────────
// SECTION 2: UTILITY
// ─────────────────────────────────────────────────────────────────────────────

const SPINNER_STYLE = `@keyframes spinLoader { to { transform: rotate(360deg); } }`;
const CHEVRON_STYLE = `
  .floor-chevron { transition: transform 0.2s ease; }
  [data-state="open"] .floor-chevron { transform: rotate(180deg); }
  [data-state="closed"] .floor-chevron { transform: rotate(0deg); }
`;

// Full-screen loading overlay — shown only on the very first data fetch.
// Subsequent visits restore from cache instantly.
function LoadingOverlay() {
  return (
    <>
      <style>{SPINNER_STYLE}</style>
      <div style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(0,0,0,.55)", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ background: "var(--card)", borderRadius: 10, padding: "36px 48px", display: "flex", flexDirection: "column", alignItems: "center", gap: 20, boxShadow: "0 8px 40px rgba(0,0,0,.18)", minWidth: 260 }}>
          <div style={{ width: 44, height: 44, borderRadius: "50%", border: "4px solid var(--border)", borderTop: "4px solid #435ebe", animation: "spinLoader 0.8s linear infinite" }} />
          <div style={{ textAlign: "center" }}>
            <p style={{ fontWeight: 700, fontSize: 15, color: "var(--foreground)", margin: 0 }}>Loading sensor limits</p>
            <p style={{ fontSize: 12, color: "var(--muted-foreground)", marginTop: 6 }}>Fetching all floors…</p>
          </div>
        </div>
      </div>
    </>
  );
}

// Reusable numeric input field — shows validation error styling and inline unit label.
// Identical to NumField in each map page modal.
const NumField = ({ sensorId, fieldKey, label, unit, draft, errors, onSetField, saving }) => {
  const err = errors[`${sensorId}.${fieldKey}`];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4, flex: 1 }}>
      <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</label>
      <div style={{ position: "relative" }}>
        <input
          type="number"
          value={draft[sensorId]?.[fieldKey] ?? ""}
          onChange={e => onSetField(sensorId, fieldKey, e.target.value)}
          disabled={saving}
          style={{
            width: "100%", padding: "8px 30px 8px 12px", borderRadius: 7, fontSize: 14,
            border: `1.5px solid ${err ? "#dc3545" : "var(--border)"}`,
            background: err ? "#fff5f5" : saving ? "var(--muted)" : "var(--background)",
            color: "var(--foreground)",
            outline: "none", boxSizing: "border-box", opacity: saving ? 0.7 : 1,
            transition: "border-color .15s",
          }}
          onFocus={e => { if (!err) e.target.style.borderColor = "#435ebe"; }}
          onBlur={e  => { if (!err) e.target.style.borderColor = "var(--border)"; }}
        />
        <span style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", fontSize: 11, color: "var(--muted-foreground)", pointerEvents: "none", fontWeight: 500 }}>{unit}</span>
      </div>
      {err && <span className="text-xs text-destructive">{err}</span>}
    </div>
  );
};


// ─────────────────────────────────────────────────────────────────────────────
// SECTION 3: ACCORDION FLOOR GROUP
// ─────────────────────────────────────────────────────────────────────────────

// One AccordionItem per floor — blue trigger header, vertical sensor rows inside.
// Clicking a sensor row selects it and populates the edit panel on the right.
// type="single" on the root means opening one floor closes the others.
// sensorStatuses: { [areaId]: 'Active' | 'Inactive' } — from sharedStatusCache
function FloorAccordionItem({ floor, groups, activeId, saving, isChanged, hasRowError, onSelect, sensorStatuses }) {

  const floorSensors = groups.flatMap(g => g.sensors);
  const changedCount = floorSensors.filter(s => isChanged(s.id)).length;
  const errorCount   = floorSensors.filter(s => hasRowError(s.id)).length;

  return (
    <>
      <style>{CHEVRON_STYLE}</style>
      <AccordionItem value={floor.slug} className="border-0">

        <AccordionTrigger
          className="hover:no-underline px-0 py-0 pr-0 rounded-none [&>svg]:hidden"
          style={{ background: "none" }}
        >
          <div style={{
            width: "100%", padding: "11px 16px",
            borderBottom: "1px solid var(--border)", borderTop: "1px solid var(--border)", background: "var(--card)",
            display: "flex", alignItems: "center", justifyContent: "space-between",
          }}>
            <div>
              <p style={{ margin: 0 }}>{floor.label}</p>
              <p style={{ fontSize: 10, color: "var(--muted-foreground)", margin: 0, letterSpacing: ".05em", textTransform: "uppercase" }}>
                {floor.subLabel} · {floorSensors.length} sensor{floorSensors.length !== 1 ? "s" : ""}
              </p>
            </div>
            {/* Summary badges + chevron */}
            <div style={{ display: "flex", gap: 6, alignItems: "center", marginRight: 8 }}>
              {errorCount > 0 && (
                <span style={{ fontSize: 10, fontWeight: 700, color: "#fff", background: "#dc3545", borderRadius: 5, padding: "2px 7px" }}>
                  {errorCount} error{errorCount !== 1 ? "s" : ""}
                </span>
              )}
              {changedCount > 0 && !errorCount && (
                <span style={{ fontSize: 10, fontWeight: 700, color: "#fff", background: "rgba(255,255,255,.2)", borderRadius: 5, padding: "2px 7px" }}>
                  {changedCount} changed
                </span>
              )}
              <svg
                className="floor-chevron"
                width="14" height="14" viewBox="0 0 24 24"
                fill="none" stroke="var(--foreground)" strokeWidth="2.5"
                strokeLinecap="round" strokeLinejoin="round"
              >
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </div>
          </div>
        </AccordionTrigger>

        <AccordionContent className="pb-0">
          <div style={{ background: "var(--card)" }}>
            {groups.map(({ group, sensors }) => (
              <div key={group}>
                {groups.length > 1 && (
                  <div style={{ padding: "7px 16px 6px" }}
                    className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
                    {group}
                  </div>
                )}
                {sensors.map(sensor => {
                  const selected = sensor.id === activeId;
                  const changed  = isChanged(sensor.id);
                  const rowError = hasRowError(sensor.id);
                  const isActive = sensorStatuses[sensor.areaId] === "Active";
                  return (
                    <div
                      key={sensor.id}
                      onClick={() => !saving && onSelect(sensor.id)}
                      style={{
                        padding: "9px 16px",
                        cursor: saving ? "default" : "pointer",
                        background: selected ? "rgba(67,94,190,.10)" : "transparent",
                        borderLeft: `3px solid ${selected ? "#435ebe" : "transparent"}`,
                        display: "flex", alignItems: "center", justifyContent: "space-between",
                        transition: "background .1s",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 8, overflow: "hidden" }}>
                        <div style={{
                          width: 7, height: 7, borderRadius: "50%", flexShrink: 0,
                          background: isActive ? "#00c9a7" : "#adb5bd",
                        }} />
                        <span style={{
                          fontSize: 13,
                          fontWeight: selected ? 700 : 400,
                          color: rowError ? "#dc3545" : changed ? "#fd7e14" : "var(--foreground)",
                          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                        }}>
                          {sensor.lineName}
                        </span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
                        {!rowError && changed && (
                          <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#fd7e14", display: "block" }} title="Unsaved change" />
                        )}
                        {rowError && (
                          <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#dc3545", display: "block" }} title="Validation error" />
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </AccordionContent>

      </AccordionItem>
    </>
  );
}


// ─────────────────────────────────────────────────────────────────────────────
// SECTION 4: EDIT PANEL
// ─────────────────────────────────────────────────────────────────────────────

// Right-hand content area — renders temperature and humidity fields for the
// currently selected sensor plus the "Apply to all" action for its group.
// Discard and Save buttons are inline with the actions row at the bottom of the card.
function EditPanel({ activeSensor, draft, errors, saving, onSetField, onApplyToGroup, hasChanges, changedCount, errorCount, onSave, onDiscard }) {
  if (!activeSensor) {
    return (
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8, color: "var(--muted-foreground)", padding: 32 }}>
        <div style={{ fontSize: 36 }}>⚙</div>
        <p style={{ fontSize: 13, margin: 0, textAlign: "center" }}>Select a sensor from the left to edit its limits</p>
      </div>
    );
  }

  const floor        = FLOORS.find(f => f.slug === activeSensor.floorSlug);
  const groupSensors = ALL_SENSORS.filter(
    s => s.floorSlug === activeSensor.floorSlug && s.group === activeSensor.group
  );

  return (
    <div style={{ flex: 1, overflowY: "auto", padding: "16px" }}>

      {/* Sensor card — same card style as SensorStatusPage floor sections */}
      <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, overflow: "hidden" }}>

        {/* Blue breadcrumb header — consistent with floor headers and SensorStatusPage */}
        <div style={{ padding: "14px 20px", background: "#435ebe", borderBottom: "1px solid #3550a8" }}>
          <p style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,.6)", letterSpacing: ".06em", textTransform: "uppercase", margin: 0 }}>
            {floor?.label} · {activeSensor.group}
          </p>
          <p style={{ fontSize: 18, fontWeight: 700, color: "#fff", margin: "2px 0 0" }}>
            {activeSensor.lineName}
          </p>
        </div>

        {/* Fields */}
        <div style={{ padding: "24px 20px", display: "flex", flexDirection: "column", gap: 24 }}>

          {/* Temperature */}
          <div>
            <p style={{ fontSize: 13, fontWeight: 600, color: "var(--foreground)", marginBottom: 12 }}>Temperature</p>
            <div style={{ display: "flex", gap: 16 }}>
              <NumField sensorId={activeSensor.id} fieldKey="tempLL" label="Lower Limit" unit="°C" draft={draft} errors={errors} onSetField={onSetField} saving={saving} />
              <NumField sensorId={activeSensor.id} fieldKey="tempUL" label="Upper Limit" unit="°C" draft={draft} errors={errors} onSetField={onSetField} saving={saving} />
            </div>
          </div>

          {/* Humidity */}
          <div>
            <p style={{ fontSize: 13, fontWeight: 600, color: "var(--foreground)", marginBottom: 12 }}>Humidity</p>
            <div style={{ display: "flex", gap: 16 }}>
              <NumField sensorId={activeSensor.id} fieldKey="humidLL" label="Lower Limit" unit="%" draft={draft} errors={errors} onSetField={onSetField} saving={saving} />
              <NumField sensorId={activeSensor.id} fieldKey="humidUL" label="Upper Limit" unit="%" draft={draft} errors={errors} onSetField={onSetField} saving={saving} />
            </div>
          </div>

          {/* Actions row — Apply to all (left) + status indicators + Discard + Save (right) */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>

            {/* Apply to all — only shown when group has multiple sensors */}
            {groupSensors.length > 1 && (
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Button
                  type="button"
                  size="default"
                  variant="default"
                  className="cursor-pointer"
                  disabled={saving}
                  onClick={() => onApplyToGroup(activeSensor, groupSensors)}
                >
                  Apply to all {activeSensor.group.toLowerCase()} in {floor?.subLabel}
                </Button>
                <span style={{ fontSize: 11, color: "var(--muted-foreground)" }}>
                  Copies current values to all {groupSensors.length} sensors in this group
                </span>
              </div>
            )}

            {/* Spacer — pushes Discard + Save to the right */}
            <div style={{ flex: 1 }} />

            {/* Status indicators */}
            {errorCount > 0 && (
              <span style={{ fontSize: 12, color: "#dc3545", fontWeight: 600 }}>
                {errorCount} validation error{errorCount !== 1 ? "s" : ""}
              </span>
            )}
            {hasChanges && !saving && (
              <span style={{ fontSize: 12, fontWeight: 700, color: "#435ebe" }}>
                {changedCount} unsaved change{changedCount !== 1 ? "s" : ""}
              </span>
            )}
            {saving && <span className="text-sm text-muted-foreground">Saving…</span>}

            {/* Discard + Save */}
            <Button
              type="button"
              variant="outline"
              size="default"
              className="cursor-pointer"
              disabled={saving || !hasChanges}
              onClick={onDiscard}
            >
              Discard
            </Button>
            <Button
              type="button"
              variant="default"
              size="default"
              className="cursor-pointer"
              disabled={saving || !hasChanges}
              onClick={onSave}
            >
              {saving ? "Saving…" : `Save${hasChanges ? ` (${changedCount})` : ""}`}
            </Button>

          </div>

        </div>
      </div>
    </div>
  );
}


// ─────────────────────────────────────────────────────────────────────────────
// SECTION 5: MAIN PAGE
// ─────────────────────────────────────────────────────────────────────────────

export default function SensorLimitsPage() {
  // draft: { [sensorId]: { tempUL, tempLL, humidUL, humidLL } }
  // Initialized from limitsCache on mount.
  const [draft,    setDraft]    = useState({});
  // original: { [sensorId]: { tempUL, tempLL, humidUL, humidLL } }
  // Committed once when API data arrives — advances forward only after a successful save.
  // Prevents false-CHANGED indicators, same pattern as SensorStatusPage.
  const [original, setOriginal] = useState({});
  // errors: { ['sensorId.fieldKey']: string } — validation errors keyed by composite key
  const [errors,   setErrors]   = useState({});
  // activeId: the currently selected sensor id shown in the edit panel
  const [activeId, setActiveId] = useState(null);
  // saving: true while the batch API call is in flight
  const [saving,   setSaving]   = useState(false);
  // apiError: top-level error string from the save call, shown below the header
  const [apiError, setApiError] = useState(null);
  // loading is true only on the very first fetch before any data is available
  const [loading,  setLoading]  = useState(Object.keys(limitsCache).length === 0);

  // sensorStatuses: { [areaId]: 'Active' | 'Inactive' } — loaded from sharedStatusCache
  // on mount so we can show status dots without a separate API call.
  // Falls back to a live fetch via the status endpoint if the shared cache is empty.
  const [sensorStatuses, setSensorStatuses] = useState({});

  // openFloor: which accordion item is currently expanded — p1f1 open by default.
  // type="single" on the Accordion root means opening one floor closes all others.
  const [openFloor, setOpenFloor] = useState("p1f1");

  // Sync copy of original used inside handleSave — kept in a ref to avoid
  // stale closure issues without causing the effect to re-run.
  const originalRef = useRef({});

  useEffect(() => {
    const fetchAll = async () => {
      // Cache hit — restore draft and original from cache instantly
      if (Object.keys(limitsCache).length > 0) {
        const restored = JSON.parse(JSON.stringify(limitsCache));
        originalRef.current = JSON.parse(JSON.stringify(limitsCache));
        setOriginal(restored);
        setDraft(JSON.parse(JSON.stringify(limitsCache)));
        setActiveId(prev => prev ?? ALL_SENSORS[0]?.id ?? null);
        setLoading(false);
        return;
      }

      try {
        // Single batch request for all sensors across all floors — mirrors the
        // batch-show fetch pattern used inside each individual map page's useEffect.
        const areaIds = ALL_SENSORS.map(s => s.areaId);
        const res     = await axios.get(`${API_BASE}/sensors/limits/batch-show`, {
          params: { areaIds },
          paramsSerializer: (p) =>
            p.areaIds.map(id => `areaIds[]=${encodeURIComponent(id)}`).join('&'),
        });

        const byAreaId = res.data.data;
        const fetched  = Object.fromEntries(
          ALL_SENSORS.map(s => [s.id, byAreaId[s.areaId] ?? { ...DEFAULT_LIMITS }])
        );

        limitsCache         = JSON.parse(JSON.stringify(fetched));
        originalRef.current = JSON.parse(JSON.stringify(fetched));
        setOriginal(JSON.parse(JSON.stringify(fetched)));
        setDraft(JSON.parse(JSON.stringify(fetched)));
        setActiveId(ALL_SENSORS[0]?.id ?? null);

      } catch (err) {
        // Fallback to defaults for every sensor so the page is still usable
        const fallback = Object.fromEntries(
          ALL_SENSORS.map(s => [s.id, { ...DEFAULT_LIMITS }])
        );
        limitsCache         = JSON.parse(JSON.stringify(fallback));
        originalRef.current = JSON.parse(JSON.stringify(fallback));
        setOriginal(JSON.parse(JSON.stringify(fallback)));
        setDraft(JSON.parse(JSON.stringify(fallback)));
        setActiveId(ALL_SENSORS[0]?.id ?? null);
        console.error("SensorLimitsPage: failed to fetch limits", err);
      } finally {
        setLoading(false);
      }
    };

    fetchAll();
  }, []);

  // Fetch sensor statuses independently — same parallel pattern as SensorStatusPage.
  // Runs once on mount; no dependency on sharedStatusCache or SensorStatusPage.
  useEffect(() => {
    Promise.allSettled(
      FLOORS.map(floor =>
        axios
          .get(`${API_BASE}/sensors/status`, { params: { floor: floor.slug } })
          .then(res => res.data.data)
      )
    ).then(results => {
      const byAreaId = {};
      results.forEach(r => {
        if (r.status === "fulfilled") {
          r.value.forEach(s => { byAreaId[s.areaId] = s.status; });
        }
      });
      setSensorStatuses(byAreaId);
    }).catch(err => {
      console.error("SensorLimitsPage: failed to fetch statuses", err);
    });
  }, []);

  // Update a single field in the draft for a given sensor.
  // Clears the validation error for that field on change.
  const handleSetField = (sensorId, key, val) => {
    setDraft(prev  => ({ ...prev, [sensorId]: { ...prev[sensorId], [key]: val } }));
    setErrors(prev => { const n = { ...prev }; delete n[`${sensorId}.${key}`]; return n; });
    setApiError(null);
  };

  // Copy the active sensor's current draft values to all sensors in the same
  // floor + group. Identical to "Apply to all" in the map page modal.
  const handleApplyToGroup = (activeSensor, groupSensors) => {
    const src = draft[activeSensor.id];
    setDraft(prev => {
      const next = { ...prev };
      groupSensors.forEach(({ id }) => { next[id] = { ...src }; });
      return next;
    });
    // Clear validation errors for all affected sensors
    setErrors(prev => {
      const next = { ...prev };
      groupSensors.forEach(({ id }) => {
        ["tempUL", "tempLL", "humidUL", "humidLL"].forEach(k => delete next[`${id}.${k}`]);
      });
      return next;
    });
  };

  // Validates all sensors in the draft. Returns parsed numeric values and any errors.
  // Identical validation logic to validate() in each map page modal.
  const validate = () => {
    const e = {}; const parsed = {};
    for (const { id } of ALL_SENSORS) {
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

  // Returns sensor ids whose parsed values differ from originalRef.
  // Same diff algorithm as getChangedIds() in each map page modal.
  const getChangedIds = (parsed) =>
    Object.keys(parsed).filter(id => {
      const orig = originalRef.current[id];
      const curr = parsed[id];
      if (!orig || !curr) return false;
      return ["tempUL", "tempLL", "humidUL", "humidLL"].some(
        k => parseFloat(orig[k]) !== parseFloat(curr[k])
      );
    });

  // Returns true if the draft for a given sensor differs from original state
  const isChanged = (id) => {
    const orig = original[id];
    const curr = draft[id];
    if (!orig || !curr) return false;
    return ["tempUL", "tempLL", "humidUL", "humidLL"].some(
      k => parseFloat(orig[k]) !== parseFloat(curr[k])
    );
  };

  // Returns true if any field for a given sensor has a validation error
  const hasRowError = (id) =>
    ["tempUL", "tempLL", "humidUL", "humidLL"].some(k => errors[`${id}.${k}`]);

  // Save all sensors with changed limits in a single batch request.
  // Identical POST payload structure to handleSaveLimits() in each map page modal.
  const handleSave = async () => {
    const { errors: e, parsed } = validate();
    if (Object.keys(e).length) { setErrors(e); return; }

    const changed = getChangedIds(parsed);
    if (changed.length === 0) return;

    setSaving(true); setApiError(null);

    try {
      const payload = {
        sensors: changed.map(id => {
          const sensor = ALL_SENSORS.find(s => s.id === id);
          return { areaId: sensor.areaId, ...parsed[id] };
        }),
      };

      await axios.post(`${API_BASE}/sensors/limits/batch`, payload);

      // Advance original and originalRef to the saved values so CHANGED
      // indicators clear — same pattern as SensorStatusPage::handleSave
      const updatedOriginal = { ...originalRef.current };
      changed.forEach(id => { updatedOriginal[id] = { ...parsed[id] }; });
      originalRef.current = updatedOriginal;
      setOriginal(JSON.parse(JSON.stringify(updatedOriginal)));

      // Update module-level cache with saved values
      changed.forEach(id => { limitsCache[id] = { ...parsed[id] }; });

    } catch (err) {
      setApiError(err.message ?? "Something went wrong. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  // Aggregate counts for the page header and edit panel
  const changedCount = ALL_SENSORS.filter(s => isChanged(s.id)).length;
  const errorCount   = ALL_SENSORS.filter(s => hasRowError(s.id)).length;
  const hasChanges   = changedCount > 0;

  // Build accordion structure: floors → groups → sensors
  const sensorsByFloor = FLOORS.map(floor => ({
    floor,
    groups: (() => {
      const floorSensors = ALL_SENSORS.filter(s => s.floorSlug === floor.slug);
      const groupNames   = [...new Set(floorSensors.map(s => s.group))];
      return groupNames.map(group => ({
        group,
        sensors: floorSensors.filter(s => s.group === group),
      }));
    })(),
  })).filter(({ groups }) => groups.some(g => g.sensors.length > 0));

  const activeSensor = ALL_SENSORS.find(s => s.id === activeId) ?? null;

  return (
    <div className="flex flex-col h-full overflow-hidden" style={{ minHeight: 0 }}>

      {loading && <LoadingOverlay />}

      {/* ── Page header ── */}
      <div style={{ marginTop: 10, padding: "14px 24px 0", flexShrink: 0 }} className="bg-background">
        <h1 className="text-2xl font-bold">Manage Sensor Limits</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {ALL_SENSORS.length} Sensors across {FLOORS.length} floors · Each sensor has its own threshold
        </p>

        {/* API error banner — shown when a save fails */}
        {apiError && !saving && (
          <div style={{ marginTop: 10, background: "#ffe8e8", border: "1.5px solid #dc3545", borderRadius: 8, padding: "8px 14px" }}
            className="text-sm text-destructive">
            {apiError}
          </div>
        )}
      </div>

      {/* ── Body: accordion list (left) + edit panel (right) ── */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden", minHeight: 0 }}>

        {/* ── Left: accordion floor list — wrapped in a card with border radius ── */}
        <div style={{
          width: 340, flexShrink: 0,
          overflowY: "auto",
          background: "var(--background)",
          padding: "12px",
        }}>
          {/* Card wrapper gives the accordion rounded corners and a contained look */}
          <div style={{
            border: "1px solid var(--border)",
            borderRadius: 10,
            overflow: "hidden",
            background: "var(--card)",
          }}>
            <Accordion
              type="single"
              value={openFloor}
              onValueChange={setOpenFloor}
              collapsible
              className="w-full"
            >
              {sensorsByFloor.map(({ floor, groups }) => (
                <FloorAccordionItem
                  key={floor.slug}
                  floor={floor}
                  groups={groups}
                  activeId={activeId}
                  saving={saving}
                  isChanged={isChanged}
                  hasRowError={hasRowError}
                  sensorStatuses={sensorStatuses}
                  onSelect={(id) => {
                    setActiveId(id);
                    // Auto-expand the floor that owns this sensor if it's currently closed
                    const sensor = ALL_SENSORS.find(s => s.id === id);
                    if (sensor && openFloor !== sensor.floorSlug) {
                      setOpenFloor(sensor.floorSlug);
                    }
                  }}
                />
              ))}
            </Accordion>
          </div>
        </div>

        {/* ── Right: edit panel for the selected sensor ── */}
        <div style={{
          flex: 1, overflow: "hidden",
          background: "var(--background)",
          display: "flex", flexDirection: "column",
        }}>
          <EditPanel
            activeSensor={activeSensor}
            draft={draft}
            errors={errors}
            saving={saving}
            onSetField={handleSetField}
            onApplyToGroup={handleApplyToGroup}
            hasChanges={hasChanges}
            changedCount={changedCount}
            errorCount={errorCount}
            onSave={handleSave}
            onDiscard={() => {
              // Reset draft back to original — discards all unsaved changes
              setDraft(JSON.parse(JSON.stringify(original)));
              setErrors({});
              setApiError(null);
            }}
          />
        </div>

      </div>
    </div>
  );
}