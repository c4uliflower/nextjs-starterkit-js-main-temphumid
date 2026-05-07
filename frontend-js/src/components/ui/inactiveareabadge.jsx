// Copied from the current temp/humid route pages as an additive scaffold.
export function InactiveAreaBadge() {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 3,
        fontSize: 8,
        fontWeight: 700,
        letterSpacing: ".04em",
        textTransform: "uppercase",
        background: "#fff8e1",
        color: "#000",
        border: "1px solid #ffe082",
        borderRadius: 5,
        padding: "1px 5px",
        verticalAlign: "middle",
        whiteSpace: "nowrap",
      }}
    >
      Inactive Area
    </span>
  );
}
