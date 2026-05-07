export function ConfirmedChip({ label, sub, color, bg, onClear }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "9px 14px",
        borderRadius: 5,
        background: bg,
      }}
    >
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color, letterSpacing: ".01em" }}>
          {label}
        </div>
        {sub && (
          <div style={{ fontSize: 11, color, opacity: 0.75, marginTop: 1 }}>{sub}</div>
        )}
      </div>
      {onClear && (
        <button
          onClick={onClear}
          style={{
            background: "rgba(255,255,255,0.25)",
            border: "none",
            borderRadius: 5,
            padding: "2px 8px",
            fontSize: 11,
            color,
            fontWeight: 600,
            cursor: "pointer",
            flexShrink: 0,
          }}
        >
          change
        </button>
      )}
    </div>
  );
}

export function StepBar({ step, total = 3 }) {
  return (
    <div style={{ display: "flex", gap: 4, marginBottom: 4 }}>
      {Array.from({ length: total }).map((_, index) => (
        <div
          key={index}
          style={{
            flex: 1,
            height: 3,
            borderRadius: 5,
            background: index < step ? "#435ebe" : "var(--border)",
            transition: "background .2s",
          }}
        />
      ))}
    </div>
  );
}

export function PaneField({ label, value, valueStyle }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "8px 0",
        borderBottom: "1px solid var(--border)",
      }}
    >
      <span
        style={{
          fontSize: 12,
          color: "var(--muted-foreground)",
          width: 100,
          flexShrink: 0,
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontSize: 13,
          color: "var(--foreground)",
          fontWeight: 500,
          ...valueStyle,
        }}
      >
        {value || (
          <span style={{ color: "var(--muted-foreground)", fontWeight: 400 }}>-</span>
        )}
      </span>
    </div>
  );
}
