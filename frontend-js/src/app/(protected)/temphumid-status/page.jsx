"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import axios from "@/lib/axios";

const API_BASE = '/api/temphumid';

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 1: DATA LAYER
// ─────────────────────────────────────────────────────────────────────────────

// All floors in display order — slug maps to the backend ?floor= param.
// label is shown as the section header; subLabel gives context for the floor.
const FLOORS = [
  { slug: "p1f1",  label: "Plant 1 · Floor 1",     subLabel: "P1F1"   },
  { slug: "p1f2",  label: "Plant 1 · Floor 2",     subLabel: "P1F2"   },
  { slug: "p2f1",  label: "Plant 2 · Floor 1",     subLabel: "P2F1"   },
  { slug: "p2f2",  label: "Plant 2 · Floor 2",     subLabel: "P2F2"   },
  { slug: "p12f2", label: "Plant 1 & 2 · Floor 2", subLabel: "Bridge" },
  { slug: "wh",    label: "Warehouse",              subLabel: "WH"    },
];

// Warehouse areaIds that belong to the WH floor slug exclusively.
// The p2f1 backend query returns all Plant 2 Floor 1 sensors (no location filter),
// which includes WH sensors. These are excluded from the P2F1 section to avoid
// duplication — they already appear under the Warehouse section.
const WH_AREA_IDS = new Set([
  "P2F1-08", "P2F1-09", "P2F1-10", "P2F1-11",
  "P2F1-12", "P2F1-13", "P2F1-14", "P2F1-15",
]);

// areaIds that belong to a different floor than what the backend query returns them under.
// CIS lives on P2F2 physically but uses a P1F1 areaId — exclude it from the P1F1 section.
const P1F1_EXCLUDED_AREA_IDS = new Set(["P1F1-16"]);

// Module-level cache — persists across navigations so the page restores
// instantly on revisit without a loading flash.
// Shape: { [floorSlug]: { areaId, chipId, lineName, status }[] }
let statusCacheByFloor = {};

// Exported shared flat cache — consumed by map pages to derive activeSensorIds
// without needing a separate fetch. Map pages import this and read on mount.
// Shape: { [areaId]: 'Active' | 'Inactive' }
export let sharedStatusCache = {};


// ─────────────────────────────────────────────────────────────────────────────
// SECTION 2: UTILITY
// ─────────────────────────────────────────────────────────────────────────────

const SPINNER_STYLE = `@keyframes spinLoader { to { transform: rotate(360deg); } }`;

// Full-screen loading overlay — shown only on the very first data fetch.
// Subsequent visits restore from cache instantly.
function LoadingOverlay() {
  return (
    <>
      <style>{SPINNER_STYLE}</style>
      <div style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(0,0,0,.55)", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ background: "#fff", borderRadius: 10, padding: "36px 48px", display: "flex", flexDirection: "column", alignItems: "center", gap: 20, boxShadow: "0 8px 40px rgba(0,0,0,.18)", minWidth: 260 }}>
          <div style={{ width: 44, height: 44, borderRadius: "50%", border: "4px solid #e9ecef", borderTop: "4px solid #435ebe", animation: "spinLoader 0.8s linear infinite" }} />
          <div style={{ textAlign: "center" }}>
            <p style={{ fontWeight: 700, fontSize: 15, color: "#212529", margin: 0 }}>Loading sensor statuses</p>
            <p style={{ fontSize: 12, color: "#6c757d", marginTop: 6 }}>Fetching all floors…</p>
          </div>
        </div>
      </div>
    </>
  );
}

// Animated toggle switch — blue when active, grey when inactive.
function StatusToggle({ active, disabled, onToggle }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={disabled}
      style={{
        position: "relative", display: "inline-flex", alignItems: "center",
        width: 40, height: 22, borderRadius: 11, border: "none",
        cursor: disabled ? "default" : "pointer",
        background: active ? "#435ebe" : "#dee2e6",
        transition: "background .2s", flexShrink: 0,
        opacity: disabled ? 0.6 : 1, padding: 0,
      }}
    >
      <span style={{
        position: "absolute", left: active ? 20 : 2, width: 18, height: 18,
        borderRadius: "50%", background: "#fff",
        boxShadow: "0 1px 3px rgba(0,0,0,.2)", transition: "left .2s",
      }} />
    </button>
  );
}


// ─────────────────────────────────────────────────────────────────────────────
// SECTION 3: FLOOR SECTION COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

// Renders one collapsible floor section with its sensor list and a Save button.
// Each floor manages its own collapsed state independently.
//
// Change detection diffs `draft` against the `original` prop passed from the parent.
// `original` is committed once when API data first arrives and only advances forward
// after a successful save — this prevents the false-CHANGED bug that occurs when
// a ref is captured before the async data has settled into state.
function FloorSection({ floor, sensors, original, draft, saving, apiError, onToggle, onSave }) {
  const [collapsed, setCollapsed] = useState(false);

  const isChanged  = (areaId) => draft[areaId] !== original[areaId];
  const changedIds = sensors.filter(s => isChanged(s.areaId)).map(s => s.areaId);
  const hasChanges = changedIds.length > 0;

  const activeCount   = sensors.filter(s => draft[s.areaId] === "Active").length;
  const inactiveCount = sensors.filter(s => draft[s.areaId] === "Inactive").length;

  return (
    <div style={{ background: "#fff", border: "1px solid #e9ecef", borderRadius: 8, overflow: "hidden" }}>

      {/* Floor header — click to collapse/expand */}
      <div
        onClick={() => setCollapsed(v => !v)}
        style={{ padding: "14px 20px", borderBottom: collapsed ? "none" : "1px solid #3550a8", display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer", userSelect: "none", background: "#435ebe" }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {/* Collapse chevron */}
          <span style={{ fontSize: 11, color: "rgba(255,255,255,.6)", transition: "transform .2s", display: "inline-block", transform: collapsed ? "rotate(-90deg)" : "rotate(0deg)" }}>▼</span>
          <div>
            <p style={{ fontWeight: 700, fontSize: 14, color: "#fff", margin: 0 }}>{floor.label}</p>
            <p style={{ fontSize: 11, color: "rgba(255,255,255,.7)", margin: 0, marginTop: 2 }}>
              {activeCount} active · {inactiveCount} inactive · {sensors.length} total
            </p>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {/* Unsaved changes badge */}
          {hasChanges && !saving && (
            <span style={{ fontSize: 11, fontWeight: 700, color: "#fff", background: "rgba(255,255,255,.2)", borderRadius: 5, padding: "2px 8px" }}>
              {changedIds.length} unsaved change{changedIds.length !== 1 ? "s" : ""}
            </span>
          )}
          {/* Floor slug badge */}
          <span style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,.55)", letterSpacing: ".06em", textTransform: "uppercase" }}>
            {floor.subLabel}
          </span>
        </div>
      </div>

      {/* Sensor list — hidden when collapsed */}
      {!collapsed && (
        <>
          <div>
            {sensors.map(({ areaId, lineName }) => {
              const isActive = draft[areaId] === "Active";
              const changed  = isChanged(areaId);
              return (
                <div
                  key={areaId}
                  style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    padding: "10px 20px", borderBottom: "1px solid #f9fafb",
                    background: changed ? "rgba(67,94,190,.04)" : "transparent",
                    transition: "background .1s",
                  }}
                >
                  {/* Left: status dot + line name + area id + changed badge */}
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{
                      width: 7, height: 7, borderRadius: "50%", flexShrink: 0,
                      background: isActive ? "#00c9a7" : "#adb5bd",
                    }} />
                    <div>
                      <span style={{ fontSize: 13, fontWeight: changed ? 600 : 400, color: "#212529" }}>{lineName}</span>

                    </div>
                    {/* Orange label — unsaved change indicator */}
                    {changed && (
                      <span style={{ fontSize: 10, fontWeight: 700, color: "#fd7e14", letterSpacing: ".04em" }}>
                        CHANGED
                      </span>
                    )}
                  </div>

                  {/* Right: status label + toggle */}
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{
                      fontSize: 11, fontWeight: 600,
                      color: isActive ? "#00c9a7" : "#adb5bd",
                      minWidth: 52, textAlign: "right",
                    }}>
                      {isActive ? "Active" : "Inactive"}
                    </span>
                    <StatusToggle
                      active={isActive}
                      disabled={saving}
                      onToggle={() => onToggle(floor.slug, areaId)}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Floor section footer — Save button + inline error */}
          <div style={{ padding: "12px 20px", borderTop: "1px solid #e9ecef", display: "flex", gap: 8, alignItems: "center", justifyContent: "flex-end", background: "#fff" }}>
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
        </>
      )}
    </div>
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
          {totalCount} sensors across {FLOORS.length} floors · {totalActive} active · {totalInactive} inactive
          {hasAnyUnsaved && (
            <span style={{ marginLeft: 10, fontWeight: 700, color: "#435ebe" }}>
              Unsaved changes present
            </span>
          )}
        </p>
      </div>

      {/* ── Floor sections ── */}
      <div style={{ flex: 1, overflowY: "auto", padding: "0 24px 24px" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 12}}>
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
        </div>
      </div>

    </div>
  );
}