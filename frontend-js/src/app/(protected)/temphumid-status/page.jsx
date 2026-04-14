"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import axios from "@/lib/axios";
import { Switch } from "@/components/ui/switch";

const API_BASE = '/api/temphumid';

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 1: DATA LAYER
// ─────────────────────────────────────────────────────────────────────────────

const FLOORS = [
  { slug: "p1f1",  label: "Plant 1 · Floor 1",     subLabel: "P1F1"   },
  { slug: "p1f2",  label: "Plant 1 · Floor 2",     subLabel: "P1F2"   },
  { slug: "p2f1",  label: "Plant 2 · Floor 1",     subLabel: "P2F1"   },
  { slug: "p2f2",  label: "Plant 2 · Floor 2",     subLabel: "P2F2"   },
  { slug: "p12f2", label: "Plant 1 & 2 · Floor 2", subLabel: "Bridge" },
  { slug: "wh",    label: "Warehouse",              subLabel: "WH"    },
];

const WH_AREA_IDS = new Set([
  "P2F1-08", "P2F1-09", "P2F1-10", "P2F1-11",
  "P2F1-12", "P2F1-13", "P2F1-14", "P2F1-15",
]);

const P1F1_EXCLUDED_AREA_IDS = new Set(["P1F1-16"]);

let statusCacheByFloor = {};
export let sharedStatusCache = {};


// ─────────────────────────────────────────────────────────────────────────────
// SECTION 2: UTILITY
// ─────────────────────────────────────────────────────────────────────────────

const SPINNER_STYLE = `@keyframes spinLoader { to { transform: rotate(360deg); } }`;

// NEW: chevron rotation based on Radix data-state attribute
const CHEVRON_STYLE = `
  .floor-chevron { transition: transform 0.2s ease; }
  [data-state="open"] .floor-chevron { transform: rotate(180deg); }
  [data-state="closed"] .floor-chevron { transform: rotate(0deg); }
`;

function LoadingOverlay() {
  return (
    <>
      <style>{SPINNER_STYLE}</style>
      <div style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(0,0,0,.55)", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ background: "var(--card)", borderRadius: 10, padding: "36px 48px", display: "flex", flexDirection: "column", alignItems: "center", gap: 20, boxShadow: "0 8px 40px rgba(0,0,0,.18)", minWidth: 260 }}>
          <div style={{ width: 44, height: 44, borderRadius: "50%", border: "4px solid var(--border)", borderTop: "4px solid #435ebe", animation: "spinLoader 0.8s linear infinite" }} />
          <div style={{ textAlign: "center" }}>
            <p style={{ fontWeight: 700, fontSize: 15, color: "var(--foreground)", margin: 0 }}>Loading sensor statuses</p>
            <p style={{ fontSize: 12, color: "var(--muted-foreground)", marginTop: 6 }}>Fetching all floors…</p>
          </div>
        </div>
      </div>
    </>
  );
}


// ─────────────────────────────────────────────────────────────────────────────
// SECTION 3: FLOOR SECTION COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

function FloorSection({ floor, sensors, original, draft, saving, apiError, onToggle, onSave }) {
  const isChanged  = (areaId) => draft[areaId] !== original[areaId];
  const changedIds = sensors.filter(s => isChanged(s.areaId)).map(s => s.areaId);
  const hasChanges = changedIds.length > 0;

  const activeCount   = sensors.filter(s => draft[s.areaId] === "Active").length;
  const inactiveCount = sensors.filter(s => draft[s.areaId] === "Inactive").length;

  return (
    <>
      {/* NEW: inject chevron style once per FloorSection render */}
      <style>{CHEVRON_STYLE}</style>
      <AccordionItem
        value={floor.slug}
        style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, overflow: "hidden" }}
        className="border-0"
      >
        <AccordionTrigger
          className="hover:no-underline px-0 py-0 rounded-none [&>svg]:hidden"
          style={{ background: "none" }}
        >
          <div
            style={{ width: "100%", padding: "14px 20px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div>
                <p style={{ margin: 0 }}>{floor.label}</p>
                <p style={{ fontSize: 11, margin: 0, marginTop: 2, color: "var(--muted-foreground)" }}>
                  {activeCount} active · {inactiveCount} inactive · {sensors.length} total
                </p>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              {hasChanges && !saving && (
                <span style={{ fontSize: 11, fontWeight: 700, color: "#fff", background: "rgba(255,255,255,.2)", borderRadius: 5, padding: "2px 8px" }}>
                  {changedIds.length} unsaved change{changedIds.length !== 1 ? "s" : ""}
                </span>
              )}
              <span style={{ fontSize: 10, fontWeight: 700, color: "var(--muted-foreground)", letterSpacing: ".06em", textTransform: "uppercase" }}>
                {floor.subLabel}
              </span>
              {/* NEW: rotating chevron — CSS flips it via [data-state] on the AccordionTrigger */}
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
          <div>
            {/* CHANGED: [...sensors].sort() to sort alphabetically by lineName without mutating props */}
            {[...sensors].sort((a, b) => a.lineName.localeCompare(b.lineName)).map(({ areaId, lineName }) => {
              const isActive = draft[areaId] === "Active";
              const changed  = isChanged(areaId);
              return (
                <div
                  key={areaId}
                  style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    padding: "10px 20px", borderBottom: "1px solid var(--border)",
                    background: changed ? "rgba(67,94,190,.04)" : "transparent",
                    transition: "background .1s",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{
                      width: 7, height: 7, borderRadius: "50%", flexShrink: 0,
                      background: isActive ? "#00c9a7" : "#adb5bd",
                    }} />
                    <div>
                      <span style={{ fontSize: 13, fontWeight: changed ? 600 : 400, color: "var(--foreground)" }}>{lineName}</span>
                    </div>
                    {changed && (
                      <span style={{ fontSize: 10, fontWeight: 700, color: "#fd7e14", letterSpacing: ".04em" }}>
                        CHANGED
                      </span>
                    )}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{
                      fontSize: 11, fontWeight: 600,
                      color: isActive ? "#00c9a7" : "#adb5bd",
                      minWidth: 52, textAlign: "right",
                    }}>
                      {isActive ? "Active" : "Inactive"}
                    </span>
                    <Switch
                      checked={isActive}
                      disabled={saving}
                      onCheckedChange={() => onToggle(floor.slug, areaId)}
                      variant="success"
                      size="default"
                    />
                  </div>
                </div>
              );
            })}
          </div>

          <div style={{ padding: "12px 20px", borderTop: "1px solid var(--border)", display: "flex", gap: 8, alignItems: "center", justifyContent: "flex-end", background: "var(--card)" }}>
            {saving && (
              <span className="text-sm text-muted-foreground" style={{ marginRight: "auto" }}>
                Saving to database…
              </span>
            )}
            {apiError && !saving && (
              <div style={{ marginRight: "auto", background: "#ffe8e8", border: "1.5px solid #dc3545", borderRadius: 8, padding: "6px 12px" }}
                className="text-sm text-destructive">
                {apiError}
              </div>
            )}
            <Button
              type="button"
              variant="default"
              size="default"
              className="cursor-pointer"
              disabled={saving || !hasChanges}
              onClick={() => onSave(floor.slug, changedIds)}
            >
              {saving ? "Saving…" : `Save ${floor.subLabel}`}
            </Button>
          </div>
        </AccordionContent>
      </AccordionItem>
    </>
  );
}


// ─────────────────────────────────────────────────────────────────────────────
// SECTION 4: MAIN PAGE
// ─────────────────────────────────────────────────────────────────────────────

export default function SensorStatusPage() {
  // sensors: { [floorSlug]: { areaId, chipId, lineName, status }[] }
  const [sensors,  setSensors]  = useState({});
  // original: { [floorSlug]: { [areaId]: 'Active' | 'Inactive' } }
  // Committed once when the API response first arrives — never mutated by toggles.
  // Advances forward only after a successful save so CHANGED indicators clear correctly.
  const [original, setOriginal] = useState({});
  // draft: { [floorSlug]: { [areaId]: 'Active' | 'Inactive' } }
  const [draft,    setDraft]    = useState({});
  // saving: { [floorSlug]: boolean }
  const [saving,   setSaving]   = useState({});
  // apiError: { [floorSlug]: string | null }
  const [apiError, setApiError] = useState({});
  // loading is true only on the very first fetch before any data is available
  const [loading,  setLoading]  = useState(Object.keys(statusCacheByFloor).length === 0);

  // openFloors: which accordion items are currently expanded — all start open
  const [openFloors, setOpenFloors] = useState(FLOORS.map(f => f.slug));

  useEffect(() => {
    const fetchAll = async () => {
      // Cache hit — restore all state from cache instantly without a network round-trip
      if (Object.keys(statusCacheByFloor).length > 0) {
        const cachedOriginal = {};
        const cachedDraft    = {};

        for (const floor of FLOORS) {
          const floorSensors = statusCacheByFloor[floor.slug] ?? [];
          const byAreaId     = Object.fromEntries(floorSensors.map(s => [s.areaId, s.status]));
          cachedOriginal[floor.slug] = byAreaId;
          cachedDraft[floor.slug]    = { ...byAreaId };
        }

        setSensors({ ...statusCacheByFloor });
        setOriginal(cachedOriginal);
        setDraft(cachedDraft);
        setLoading(false);
        return;
      }

      try {
        // Fetch all floors in parallel — one request per floor slug.
        // Promise.allSettled ensures a single failed floor does not block the rest.
        const results = await Promise.allSettled(
          FLOORS.map(floor =>
            axios
              .get(`${API_BASE}/sensors/status`, { params: { floor: floor.slug } })
              .then(res => ({ slug: floor.slug, data: res.data.data }))
          )
        );

        const newSensors  = {};
        const newOriginal = {};
        const newDraft    = {};

        for (const result of results) {
          if (result.status !== "fulfilled") continue;

          const { slug, data } = result.value;

          // Exclude WH sensors from the P2F1 section — the backend p2f1 query has no
          // location_like filter so it returns all Plant 2 Floor 1 sensors including
          // WH ones. They are already present under the Warehouse section.
          const filtered = slug === "p2f1"
            ? data.filter(s => !WH_AREA_IDS.has(s.areaId))
            : slug === "p1f1"
              ? data.filter(s => !P1F1_EXCLUDED_AREA_IDS.has(s.areaId))
              : data;

          const byAreaId    = Object.fromEntries(filtered.map(s => [s.areaId, s.status]));
          newSensors[slug]  = filtered;
          newOriginal[slug] = byAreaId;
          newDraft[slug]    = { ...byAreaId };

          // Populate the shared flat cache so map pages can read statuses
          // on their own mount without an additional fetch
          for (const [areaId, status] of Object.entries(byAreaId)) {
            sharedStatusCache[areaId] = status;
          }
        }

        statusCacheByFloor = newSensors;
        setSensors(newSensors);
        setOriginal(newOriginal);
        setDraft(newDraft);

      } catch (err) {
        console.error("SensorStatusPage: failed to fetch statuses", err);
      } finally {
        setLoading(false);
      }
    };

    fetchAll();
  }, []);

  // Toggle a single sensor's draft status for a given floor.
  // Only mutates draft — original is never touched by user interaction.
  const handleToggle = (floorSlug, areaId) => {
    if (saving[floorSlug]) return;
    setDraft(prev => ({
      ...prev,
      [floorSlug]: {
        ...prev[floorSlug],
        [areaId]: prev[floorSlug]?.[areaId] === "Active" ? "Inactive" : "Active",
      },
    }));
    // Clear any stale floor-level error when the user interacts
    setApiError(prev => ({ ...prev, [floorSlug]: null }));
  };

  // Save changed sensors for a single floor.
  // On success: advances original to match draft, syncs sensors state,
  // updates the module-level cache, and updates sharedStatusCache so map
  // pages reflect the new statuses on their next activeSensorIds computation.
  const handleSave = async (floorSlug, changedIds) => {
    if (!changedIds.length) return;

    setSaving(prev  => ({ ...prev, [floorSlug]: true  }));
    setApiError(prev => ({ ...prev, [floorSlug]: null  }));

    try {
      const payload = {
        sensors: changedIds.map(areaId => ({
          areaId,
          status: draft[floorSlug][areaId],
        })),
      };

      await axios.post(`${API_BASE}/sensors/status/batch`, payload);

      // Advance original forward to the saved values so CHANGED badges clear
      setOriginal(prev => ({
        ...prev,
        [floorSlug]: {
          ...prev[floorSlug],
          ...Object.fromEntries(changedIds.map(id => [id, draft[floorSlug][id]])),
        },
      }));

      // Sync sensors state so active/inactive counts in the section header stay accurate
      setSensors(prev => ({
        ...prev,
        [floorSlug]: (prev[floorSlug] ?? []).map(s =>
          changedIds.includes(s.areaId)
            ? { ...s, status: draft[floorSlug][s.areaId] }
            : s
        ),
      }));

      // Update module-level cache with the saved values
      if (statusCacheByFloor[floorSlug]) {
        statusCacheByFloor[floorSlug] = statusCacheByFloor[floorSlug].map(s =>
          changedIds.includes(s.areaId)
            ? { ...s, status: draft[floorSlug][s.areaId] }
            : s
        );
      }

      // Update shared flat cache so map pages pick up the new statuses
      for (const areaId of changedIds) {
        sharedStatusCache[areaId] = draft[floorSlug][areaId];
      }

    } catch (err) {
      setApiError(prev => ({
        ...prev,
        [floorSlug]: err.message ?? "Something went wrong. Please try again.",
      }));
    } finally {
      setSaving(prev => ({ ...prev, [floorSlug]: false }));
    }
  };

  // Aggregate counts across all floors — shown in the page header subtitle
  const allDraftEntries = Object.values(draft).flatMap(byAreaId => Object.values(byAreaId));
  const totalCount      = allDraftEntries.length;
  const totalActive     = allDraftEntries.filter(s => s === "Active").length;
  const totalInactive   = totalCount - totalActive;

  const hasAnyUnsaved = FLOORS.some(floor =>
    Object.keys(draft[floor.slug] ?? {}).some(
      areaId => draft[floor.slug][areaId] !== original[floor.slug]?.[areaId]
    )
  );

  return (
    <div className="flex flex-col h-full overflow-hidden" style={{ minHeight: 0 }}>

      {loading && <LoadingOverlay />}

      {/* ── Page header ── */}
      <div style={{ marginTop: 10, padding: "14px 24px", flexShrink: 0 }} className="bg-background">
        <h1 className="text-2xl font-bold">Manage Sensor Status</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {totalCount} Sensors across {FLOORS.length} floors · {totalActive} Active · {totalInactive} Inactive
          {hasAnyUnsaved && (
            <span style={{ marginLeft: 10, fontWeight: 700, color: "#435ebe" }}>
              Unsaved Changes Present
            </span>
          )}
        </p>
      </div>

      {/* ── Floor sections — each floor is an AccordionItem ── */}
      <div style={{ flex: 1, overflowY: "auto", padding: "0 24px 24px" }}>
        <Accordion
          type="multiple"
          value={openFloors}
          onValueChange={setOpenFloors}
          className="flex flex-col gap-3"
        >
          {FLOORS.map(floor => {
            const floorSensors = sensors[floor.slug] ?? [];

            // Skip rendering a section if the floor returned no sensors
            if (!loading && floorSensors.length === 0) return null;

            return (
              <FloorSection
                key={floor.slug}
                floor={floor}
                sensors={floorSensors}
                original={original[floor.slug] ?? {}}
                draft={draft[floor.slug] ?? {}}
                saving={saving[floor.slug] ?? false}
                apiError={apiError[floor.slug] ?? null}
                onToggle={handleToggle}
                onSave={handleSave}
              />
            );
          })}
        </Accordion>
      </div>

    </div>
  );
}