"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";


// ─────────────────────────────────────────────────────────────────────────────
// STANDARD CUSTOM MODAL
// General-purpose modal wrapper used across the app.
// ─────────────────────────────────────────────────────────────────────────────

const sizeClasses = {
  sm:   "sm:max-w-sm",
  md:   "sm:max-w-lg",
  lg:   "sm:max-w-2xl",
  xl:   "sm:max-w-4xl",
  full: "!max-w-none !w-screen !h-screen !rounded-none !top-0 !left-0 !translate-x-0 !translate-y-0",
};

export function CustomModal({
  open,
  onOpenChange,
  trigger,
  title,
  description,
  size = "md",
  footer,
  children,
  className,
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent
        className={cn(sizeClasses[size], size === "full" && "flex flex-col", className)}
      >
        <VisuallyHidden>
          <DialogTitle>Adjust SensorLimits</DialogTitle>
        </VisuallyHidden>
        <DialogHeader>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <div className={cn("py-2", size === "full" && "flex-1 overflow-y-auto")}>{children}</div>
        {footer && <DialogFooter>{footer}</DialogFooter>}
      </DialogContent>
    </Dialog>
  );
}


// ─────────────────────────────────────────────────────────────────────────────
// SENSOR LIMITS MODAL
// Per-sensor limit adjustment modal — uses its own Dialog directly instead of
// CustomModal, because it needs a fixed-height flex column layout (flush
// two-panel body + pinned header/footer) that CustomModal's wrapper divs
// would fight against.
//
// Props:
//   open         — boolean, controls visibility
//   onOpenChange — (bool) => void, called on backdrop click / Esc
//   allLimits    — { [sensorId]: { tempUL, tempLL, humidUL, humidLL } }
//   onSave       — (newLimits) => void, called ONLY after confirmed backend save
//   sensors      — { id, name, group: "Sensors"|"Dessicators" }[]
//                  passed in from the page so this modal stays data-agnostic
// ─────────────────────────────────────────────────────────────────────────────

export function SensorLimitsModal({ open, onOpenChange, allLimits, onSave, sensors }) {

  // Draft holds in-progress edits for ALL sensors before the user saves.
  // Seeded from allLimits (which is itself seeded from the backend on page load).
  const [draft,    setDraft]    = useState(() =>
    Object.fromEntries(
      sensors.map(({ id }) => [id, { ...(allLimits[id] ?? { tempUL: 28, tempLL: 13, humidUL: 80, humidLL: 40 }) }])
    )
  );
  const [errors,   setErrors]   = useState({});
  const [activeId, setActiveId] = useState(sensors[0]?.id);

  // ── BACKEND INTEGRATION MARKERS ──────────────────────────────────────────
  // [BACKEND] saving: tracks the POST request lifecycle (true while awaiting response)
  // [BACKEND] apiError: surfaces any server-side error message to the user
  const [saving,   setSaving]   = useState(false);
  const [apiError, setApiError] = useState(null);

  const setField = (sensorId, key, val) => {
    setDraft((prev) => ({ ...prev, [sensorId]: { ...prev[sensorId], [key]: val } }));
    setErrors((prev) => { const n = { ...prev }; delete n[`${sensorId}.${key}`]; return n; });
    setApiError(null);
  };

  // ── CLIENT-SIDE VALIDATION ────────────────────────────────────────────────
  // Kept on the frontend for instant feedback (empty fields, LL >= UL).
  // The backend should ALSO validate and reject bad values as the source of truth.
  const validate = () => {
    const e = {}; const parsed = {};
    for (const { id } of sensors) {
      const row = draft[id]; parsed[id] = {};
      for (const key of ["tempUL","tempLL","humidUL","humidLL"]) {
        const num = parseFloat(row?.[key]);
        if (isNaN(num)) { e[`${id}.${key}`] = "Required"; continue; }
        parsed[id][key] = num;
      }
      if (!e[`${id}.tempLL`]  && !e[`${id}.tempUL`]  && parsed[id].tempLL  >= parsed[id].tempUL)  e[`${id}.tempLL`]  = "LL must be < UL";
      if (!e[`${id}.humidLL`] && !e[`${id}.humidUL`] && parsed[id].humidLL >= parsed[id].humidUL) e[`${id}.humidLL`] = "LL must be < UL";
    }
    return { errors: e, parsed };
  };

  // [BACKEND #4] → POST /api/limits/p1f1/per-sensor
  // Flow: validate locally → POST → backend writes to DB
  //       → success: update React state via onSave() → close modal
  //       → failure: show server error, keep modal open
  //
  // When backend is ready, uncomment the fetch block and remove the setTimeout.
  const handleSave = async () => {
    const { errors: e, parsed } = validate();
    if (Object.keys(e).length) { setErrors(e); return; }

    setSaving(true);
    setApiError(null);

    try {
      // ── [BACKEND] Replace this block with your real fetch call ────────────
      // const res  = await fetch("/api/limits/p1f1/per-sensor", {
      //   method:  "POST",
      //   headers: { "Content-Type": "application/json" },
      //   body:    JSON.stringify({ limits: parsed }),
      // });
      // const json = await res.json();
      // if (!res.ok || !json.ok) throw new Error(json.message ?? "Save failed");
      // ── END [BACKEND] block ───────────────────────────────────────────────

      // ── TEMPORARY: simulate a network round-trip while backend is absent ──
      await new Promise((r) => setTimeout(r, 600));
      // ─────────────────────────────────────────────────────────────────────

      onSave(parsed);        // update UI state with the confirmed new limits
      onOpenChange(false);   // close modal
    } catch (err) {
      setApiError(err.message ?? "Something went wrong. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const hasRowError = (id) =>
    ["tempUL","tempLL","humidUL","humidLL"].some((k) => errors[`${id}.${k}`]);

  const NumField = ({ sensorId, fieldKey, label, unit }) => {
    const err = errors[`${sensorId}.${fieldKey}`];
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 3, flex: 1 }}>
        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</label>
        <div style={{ position: "relative" }}>
          <input
            type="number"
            value={draft[sensorId]?.[fieldKey] ?? ""}
            onChange={(e) => setField(sensorId, fieldKey, e.target.value)}
            disabled={saving}
            style={{
              width: "100%", padding: "7px 26px 7px 9px", borderRadius: 6, fontSize: 13,
              border: `1.5px solid ${err ? "#dc3545" : "#dee2e6"}`,
              background: err ? "#fff5f5" : saving ? "#f8f9fa" : "#fff",
              outline: "none", boxSizing: "border-box",
              opacity: saving ? .7 : 1,
            }}
          />
          <span style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", fontSize: 10, color: "#adb5bd", pointerEvents: "none" }}>{unit}</span>
        </div>
        {err && <span className="text-xs text-destructive">{err}</span>}
      </div>
    );
  };

  const activeSensor = sensors.find((s) => s.id === activeId);
  const groups = [...new Set(sensors.map((s) => s.group))];

  return (
    
    <Dialog open={open} onOpenChange={saving ? undefined : onOpenChange}>
      <VisuallyHidden>
        <DialogTitle>Adjust SensorLimits</DialogTitle>
      </VisuallyHidden>
      <DialogContent
        // p-0 gap-0: remove all default Dialog padding/gap so we control every px
        // overflow-hidden: clips content to the rounded border
        // flex flex-col + fixed height: the critical combo that keeps header/footer
        // pinned and body scrollable — minHeight:0 on body does the rest
        className="p-0 gap-0 overflow-hidden sm:max-w-4xl flex flex-col"
        style={{ height: "80vh" }}
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        {/* ── Header ── */}
        <div style={{
          padding: "16px 20px 14px",
          borderBottom: "1px solid #e9ecef",
          display: "flex", alignItems: "flex-start", justifyContent: "space-between",
          flexShrink: 0,
        }}>
          <div>
            <p className="text-base font-semibold">Adjust Sensor Limits</p>
            <p className="text-sm text-muted-foreground mt-0.5">
              Plant 1 Floor 1 · Each sensor has its own threshold
            </p>
          </div>
        </div>

        {/* ── Body: two-panel row ── */}
        {/* minHeight:0 is essential — without it flex children default to        */}
        {/* min-height:auto and push the footer out of the modal box              */}
        <div style={{ display: "flex", flex: 1, minHeight: 0 }}>

          {/* Left — sensor list */}
          <div style={{
            width: 210, flexShrink: 0,
            borderRight: "1px solid #e9ecef",
            overflowY: "auto",
            padding: "8px 0",
          }}>
            {groups.map((group) => {
              const list = sensors.filter((s) => s.group === group);
              return (
                <div key={group}>
                  <div
                    className="text-xs font-semibold text-muted-foreground uppercase tracking-widest"
                    style={{ padding: "10px 16px 4px" }}
                  >
                    {group}
                  </div>
                  {list.map(({ id, name }) => (
                    <div
                      key={id}
                      onClick={() => !saving && setActiveId(id)}
                      style={{
                        padding: "9px 16px",
                        cursor: saving ? "default" : "pointer",
                        background: id === activeId ? "rgba(67,94,190,.08)" : "transparent",
                        borderLeft: `3px solid ${id === activeId ? "#435ebe" : "transparent"}`,
                        display: "flex", alignItems: "center", justifyContent: "space-between",
                        transition: "background .1s",
                      }}
                      className={`text-sm ${id === activeId ? "font-semibold" : ""}`}
                    >
                      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {name}
                      </span>
                      {hasRowError(id) && (
                        <span className="text-destructive" style={{ fontSize: 16, marginLeft: 4, lineHeight: 1 }}>•</span>
                      )}
                    </div>
                  ))}
                </div>
              );
            })}
          </div>

          {/* Right — edit panel; explicit white bg so it never inherits page bg  */}
          <div style={{
            flex: 1, minWidth: 0,
            overflowY: "auto",
            padding: "24px 28px",
            display: "flex", flexDirection: "column", gap: 24,
            background: "#ffffff",
          }}>
            <p className="text-base font-semibold">{activeSensor?.name}</p>

            {/* Temperature */}
            <div>
              <p className="text-sm font-medium mb-3">Temperature</p>
              <div style={{ display: "flex", gap: 16 }}>
                <NumField sensorId={activeId} fieldKey="tempLL" label="Lower Limit" unit="°C" />
                <NumField sensorId={activeId} fieldKey="tempUL" label="Upper Limit" unit="°C" />
              </div>
            </div>

            {/* Humidity */}
            <div>
              <p className="text-sm font-medium mb-3">Humidity</p>
              <div style={{ display: "flex", gap: 16 }}>
                <NumField sensorId={activeId} fieldKey="humidLL" label="Lower Limit" unit="%" />
                <NumField sensorId={activeId} fieldKey="humidUL" label="Upper Limit" unit="%" />
              </div>
            </div>

            {/* Quick apply — copies active sensor's limits to all in its group */}
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: "auto" }}>
              {groups.map((group) => {
                const list = sensors.filter((s) => s.group === group);
                if (!list.find((s) => s.id === activeId)) return null;
                return (
                  <Button
                    key={group}
                    type="button"
                    variant="default"
                    size="default"
                    className="cursor-pointer"
                    disabled={saving}
                    onClick={() => {
                      const src = draft[activeId];
                      setDraft((prev) => {
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

            {/* [BACKEND] API error banner — shown when the POST request fails */}
            {apiError && (
              <div
                style={{ background: "#ffe8e8", border: "1.5px solid #dc3545", borderRadius: 8, padding: "10px 14px" }}
                className="text-sm text-destructive"
              >
                {apiError}
              </div>
            )}
          </div>
        </div>

        {/* ── Footer — pinned at bottom, never pushed outside ── */}
        <div style={{
          padding: "12px 20px 14px",
          borderTop: "1px solid #e9ecef",
          display: "flex", gap: 8, alignItems: "center", justifyContent: "flex-end",
          flexShrink: 0,
          background: "#fff",
        }}>
          {/* [BACKEND] Saving indicator — visible while POST request is in flight */}
          {saving && (
            <span className="text-sm text-muted-foreground" style={{ marginRight: "auto" }}>
              Saving to database…
            </span>
          )}
          <Button variant="outline" size="default" className="cursor-pointer" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button variant="default" size="default" className="cursor-pointer" onClick={handleSave} disabled={saving}>
            {saving ? "Saving…" : "Save All"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}