import { useState } from "react";

import {
  FacilitiesBreachReadingsContent,
  FacilitiesResolvedDetailFields,
  buildFacilitiesResolvedColumns,
} from "@/features/temphumid/facilities-alerts/components/FacilitiesBreachReadingsParts";
import { useFacilitiesBreachReadings } from "@/features/temphumid/facilities-alerts/hooks/use-facilities-breach-readings";

// Copied from the current temp/humid facilities route page as an additive scaffold.

export function FacilitiesBreachReadingsPanel({ alertId, compact = false }) {
  const [open, setOpen] = useState(false);
  const { error, fetchPage, loading, meta, page, rows } = useFacilitiesBreachReadings(alertId);

  return (
    <div style={{ marginTop: compact ? 10 : 0 }}>
      <button
        onClick={() => setOpen((value) => !value)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          background: "none",
          border: "none",
          cursor: "pointer",
          padding: 0,
          color: "var(--foreground)",
          width: "100%",
        }}
      >
        <span
          style={{
            fontSize: compact ? 11 : 12,
            fontWeight: 700,
            color: "var(--muted-foreground)",
            textTransform: "uppercase",
            letterSpacing: ".06em",
          }}
        >
          Incident Log
          {meta?.total != null && meta.total > 0 && (
            <span
              style={{
                marginLeft: 6,
                fontSize: 10,
                fontWeight: 700,
                padding: "1px 6px",
                borderRadius: 10,
                background: "#fee2e2",
                color: "#b91c1c",
              }}
            >
              {meta.total}
            </span>
          )}
        </span>
      </button>

      {open && (
        <div style={{ marginTop: 8 }}>
          <FacilitiesBreachReadingsContent
            compact={compact}
            emptyMessage="No breach readings recorded after this alert was acknowledged."
            error={error}
            loading={loading}
            meta={meta}
            onNext={fetchPage}
            onPrev={fetchPage}
            onRetry={fetchPage}
            page={page}
            rows={rows}
          />
        </div>
      )}
    </div>
  );
}

export function FacilitiesResolvedDetailContent({ alert }) {
  if (!alert) return null;

  return (
    <div style={{ display: "flex", gap: 24, alignItems: "flex-start" }}>
      <FacilitiesResolvedDetailFields alert={alert} />

      <div style={{ width: 1, alignSelf: "stretch", background: "var(--border)", flexShrink: 0 }} />

      <div style={{ flex: 1, minWidth: 320 }}>
        <p
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: "var(--muted-foreground)",
            textTransform: "uppercase",
            letterSpacing: ".06em",
            margin: "0 0 10px",
          }}
        >
          Breach History
        </p>
        <FacilitiesBreachReadingsInline alertId={alert.id} />
      </div>
    </div>
  );
}

function FacilitiesBreachReadingsInline({ alertId }) {
  const { error, fetchPage, loading, meta, page, rows } = useFacilitiesBreachReadings(alertId);

  return (
    <FacilitiesBreachReadingsContent
      compact={false}
      emptyMessage="No breach readings recorded after this alert was acknowledged."
      error={error}
      loading={loading}
      meta={meta}
      onNext={fetchPage}
      onPrev={fetchPage}
      onRetry={fetchPage}
      page={page}
      rows={rows}
    />
  );
}



