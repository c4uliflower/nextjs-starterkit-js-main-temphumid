import { Button } from "@/components/ui/button";

import { ACTION_LABELS } from "@/features/temphumid/facilities-alerts/utils/facilities";
import { formatAbsolute } from "@/utils/time";

export function BreachBadge({ label }) {
  return (
    <span
      style={{
        fontSize: 10,
        fontWeight: 700,
        padding: "1px 6px",
        borderRadius: 4,
        background: "#fee2e2",
        color: "#b91c1c",
        border: "1px solid #fca5a5",
        letterSpacing: ".04em",
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </span>
  );
}

function FacilitiesBreachReadingsError({ error, onRetry }) {
  return (
    <div
      style={{
        fontSize: 11,
        color: "#b91c1c",
        padding: "6px 10px",
        background: "#fef2f2",
        border: "1px solid #fca5a5",
        borderRadius: 5,
      }}
    >
      {error}
      <button
        onClick={onRetry}
        style={{
          marginLeft: 8,
          fontSize: 11,
          color: "#b91c1c",
          cursor: "pointer",
          background: "none",
          border: "none",
          textDecoration: "underline",
          padding: 0,
        }}
      >
        Retry
      </button>
    </div>
  );
}

function FacilitiesBreachReadingsPagination({ loading, meta, onPrev, onNext }) {
  if (!meta || meta.lastPage <= 1) return null;

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        marginTop: 8,
        paddingTop: 8,
        borderTop: "1px solid var(--border)",
      }}
    >
      <span style={{ fontSize: 11, color: "var(--muted-foreground)" }}>
        Page {meta.currentPage} of {meta.lastPage} - {meta.total} total
      </span>
      <div style={{ display: "flex", gap: 4 }}>
        <Button
          variant="outline"
          size="sm"
          style={{ fontSize: 11, height: 26, padding: "0 10px" }}
          disabled={meta.currentPage <= 1 || loading}
          onClick={onPrev}
        >
          Prev
        </Button>
        <Button
          variant="outline"
          size="sm"
          style={{ fontSize: 11, height: 26, padding: "0 10px" }}
          disabled={!meta.hasMore || loading}
          onClick={onNext}
        >
          Next
        </Button>
      </div>
    </div>
  );
}

export function FacilitiesBreachReadingsTable({ rows, compact }) {
  return (
    <div style={{ overflowX: "auto" }}>
      <table
        style={{
          width: "100%",
          borderCollapse: "collapse",
          fontSize: compact ? 11 : 12,
        }}
      >
        <thead>
          <tr style={{ borderBottom: "1px solid var(--border)" }}>
            {["Time", "Temp (\u00B0C)", "Humid (%)", "Temp Limit", "Humid Limit", "Breached"].map(
              (header) => (
                <th
                  key={header}
                  style={{
                    padding: compact ? "4px 6px" : "6px 10px",
                    textAlign: "left",
                    fontWeight: 700,
                    color: "var(--muted-foreground)",
                    whiteSpace: "nowrap",
                    fontSize: 10,
                    textTransform: "uppercase",
                    letterSpacing: ".05em",
                  }}
                >
                  {header}
                </th>
              )
            )}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr
              key={index}
              style={{
                borderBottom: "1px solid var(--border)",
                background: index % 2 === 0 ? "transparent" : "var(--muted)",
              }}
            >
              <td
                style={{
                  padding: compact ? "4px 6px" : "6px 10px",
                  whiteSpace: "nowrap",
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {formatAbsolute(row.readingAt)}
              </td>
              <td
                style={{
                  padding: compact ? "4px 6px" : "6px 10px",
                  fontWeight: row.breached.temp ? 700 : 400,
                  color: row.breached.temp ? "#b91c1c" : "var(--foreground)",
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {row.temperature.toFixed(2)}
                {compact ? "" : "\u00B0C"}
              </td>
              <td
                style={{
                  padding: compact ? "4px 6px" : "6px 10px",
                  fontWeight: row.breached.humid ? 700 : 400,
                  color: row.breached.humid ? "#b91c1c" : "var(--foreground)",
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {row.humidity.toFixed(2)}
                {compact ? "" : "%"}
              </td>
              <td
                style={{
                  padding: compact ? "4px 6px" : "6px 10px",
                  color: "var(--muted-foreground)",
                  whiteSpace: "nowrap",
                }}
              >
                {row.limits.tempLL}
                {"\u2013"}
                {row.limits.tempUL}
                {compact ? "" : "\u00B0C"}
              </td>
              <td
                style={{
                  padding: compact ? "4px 6px" : "6px 10px",
                  color: "var(--muted-foreground)",
                  whiteSpace: "nowrap",
                }}
              >
                {row.limits.humidLL}
                {"\u2013"}
                {row.limits.humidUL}
                {compact ? "" : "%"}
              </td>
              <td style={{ padding: compact ? "4px 6px" : "6px 10px" }}>
                <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                  {row.breached.temp && <BreachBadge label="Temp" />}
                  {row.breached.humid && <BreachBadge label="Humid" />}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function FacilitiesBreachReadingsContent({
  compact = false,
  emptyMessage,
  error,
  loading,
  meta,
  onNext,
  onPrev,
  onRetry,
  page,
  rows,
}) {
  const isEmpty = !loading && !error && rows.length === 0 && meta !== null;

  if (loading) {
    return (
      <p style={{ fontSize: 12, color: "var(--muted-foreground)", margin: 0 }}>Loading...</p>
    );
  }

  if (error) {
    return <FacilitiesBreachReadingsError error={error} onRetry={() => onRetry(page)} />;
  }

  if (isEmpty) {
    return (
      <p
        style={{
          fontSize: 12,
          color: "var(--muted-foreground)",
          margin: 0,
          fontStyle: "italic",
        }}
      >
        {emptyMessage}
      </p>
    );
  }

  if (rows.length === 0) return null;

  return (
    <>
      <FacilitiesBreachReadingsTable rows={rows} compact={compact} />
      <FacilitiesBreachReadingsPagination
        loading={loading}
        meta={meta}
        onPrev={() => onPrev(meta.currentPage - 1)}
        onNext={() => onNext(meta.currentPage + 1)}
      />
    </>
  );
}

function DetailField({ label, value }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 10,
        padding: "8px 0",
        borderBottom: "1px solid var(--border)",
      }}
    >
      <span style={{ fontSize: 12, color: "var(--muted-foreground)", width: 120, flexShrink: 0 }}>
        {label}
      </span>
      <span
        style={{
          fontSize: 13,
          color: "var(--foreground)",
          fontWeight: 500,
          wordBreak: "break-word",
        }}
      >
        {value || (
          <span style={{ color: "var(--muted-foreground)", fontWeight: 400 }}>
            {"\u2014"}
          </span>
        )}
      </span>
    </div>
  );
}

export function FacilitiesResolvedDetailFields({ alert }) {
  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      <DetailField label="Area ID" value={alert.areaId} />
      <DetailField label="Line Name" value={alert.lineName} />
      <DetailField
        label="Temperature"
        value={
          alert.temperature != null
            ? `${alert.temperature.toFixed(2)}\u00B0C (limit: ${alert.tempLL}\u2013${alert.tempUL}\u00B0C)`
            : null
        }
      />
      <DetailField
        label="Humidity"
        value={
          alert.humidity != null
            ? `${alert.humidity.toFixed(2)}% (limit: ${alert.humidLL}\u2013${alert.humidUL}%)`
            : null
        }
      />
      <DetailField label="Action Taken" value={ACTION_LABELS[alert.actionType] ?? alert.actionType} />
      <DetailField label="Remarks" value={alert.actionRemarks} />
      <DetailField label="Acknowledged By" value={alert.acknowledgedBy} />
      <DetailField label="Acknowledged At" value={formatAbsolute(alert.acknowledgedAt)} />
      <DetailField label="Opened By" value={alert.openedBy} />
      <DetailField label="Opened At" value={formatAbsolute(alert.openedAt)} />
      <DetailField label="Verified By" value={alert.verifiedBy} />
      <DetailField label="Verified At" value={formatAbsolute(alert.verifiedAt)} />
      <DetailField label="Resolved At" value={formatAbsolute(alert.resolvedAt)} />
    </div>
  );
}

export function buildFacilitiesResolvedColumns(setSelectedResolved) {
  return [
    { accessorKey: "areaId", header: "Area ID" },
    { accessorKey: "lineName", header: "Line Name" },
    {
      id: "readings",
      header: "Readings",
      cell: ({ row }) => {
        const alert = row.original;
        return (
          <span style={{ fontSize: 12, fontVariantNumeric: "tabular-nums" }}>
            {alert.temperature?.toFixed(1)}{"\u00B0C"} {"\u00B7"} {alert.humidity?.toFixed(1)}%
          </span>
        );
      },
    },
    {
      id: "actionType",
      header: "Action taken",
      cell: ({ row }) => {
        const alert = row.original;
        const label = ACTION_LABELS[alert.actionType] ?? alert.actionType;
        if (!alert.actionType) {
          return (
            <span style={{ fontSize: 12, color: "var(--muted-foreground)" }}>
              {"\u2014"}
            </span>
          );
        }
        return <span style={{ fontSize: 12, color: "var(--foreground)" }}>{label}</span>;
      },
    },
    {
      id: "actionRemarks",
      header: "Remarks",
      cell: ({ row }) => {
        const remarks = row.original.actionRemarks;
        return (
          <span
            style={{
              fontSize: 12,
              color: remarks ? "var(--foreground)" : "var(--muted-foreground)",
              maxWidth: 220,
              display: "inline-block",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {remarks || "\u2014"}
          </span>
        );
      },
    },
    {
      id: "resolvedAt",
      header: "Resolved",
      cell: ({ row }) => (
        <span style={{ fontSize: 12 }}>{formatAbsolute(row.original.resolvedAt)}</span>
      ),
    },
    {
      id: "viewDetails",
      header: "",
      cell: ({ row }) => (
        <Button
          variant="outline"
          size="sm"
          style={{ fontSize: 11, height: 26, cursor: "pointer", whiteSpace: "nowrap" }}
          onClick={() => setSelectedResolved(row.original)}
        >
          View Details
        </Button>
      ),
    },
  ];
}

