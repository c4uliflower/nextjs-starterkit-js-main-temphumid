// Copied from the current temp/humid limits route page as an additive scaffold.

export function NumField({
  sensorId,
  fieldKey,
  label,
  unit,
  draft,
  errors,
  onSetField,
  saving,
}) {
  const err = errors[`${sensorId}.${fieldKey}`];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4, flex: 1 }}>
      <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </label>
      <div style={{ position: "relative" }}>
        <input
          type="number"
          value={draft[sensorId]?.[fieldKey] ?? ""}
          onChange={(event) => onSetField(sensorId, fieldKey, event.target.value)}
          disabled={saving}
          style={{
            width: "100%",
            padding: "8px 30px 8px 12px",
            borderRadius: 7,
            fontSize: 14,
            border: `1.5px solid ${err ? "#dc3545" : "var(--border)"}`,
            background: err ? "#fff5f5" : saving ? "var(--muted)" : "var(--background)",
            color: "var(--foreground)",
            outline: "none",
            boxSizing: "border-box",
            opacity: saving ? 0.7 : 1,
            transition: "border-color .15s",
          }}
          onFocus={(event) => {
            if (!err) event.target.style.borderColor = "#435ebe";
          }}
          onBlur={(event) => {
            if (!err) event.target.style.borderColor = "var(--border)";
          }}
        />
        <span
          style={{
            position: "absolute",
            right: 10,
            top: "50%",
            transform: "translateY(-50%)",
            fontSize: 11,
            color: "var(--muted-foreground)",
            pointerEvents: "none",
            fontWeight: 500,
          }}
        >
          {unit}
        </span>
      </div>
      {err && <span className="text-xs text-destructive">{err}</span>}
    </div>
  );
}
