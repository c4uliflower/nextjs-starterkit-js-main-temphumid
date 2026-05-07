const SPINNER_STYLE = `@keyframes spinLoader { to { transform: rotate(360deg); } }`;

// Copied from the current temp/humid route pages as an additive scaffold.
export function LoadingOverlay({
  title = "Fetching sensor data",
  subtitle = "Please wait while live readings are loaded...",
}) {
  return (
    <>
      <style>{SPINNER_STYLE}</style>
      <div
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 200,
          background: "rgba(0,0,0,.55)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            background: "var(--card)",
            borderRadius: 10,
            padding: "36px 48px",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 20,
            boxShadow: "0 8px 40px rgba(0,0,0,.18)",
            minWidth: 260,
          }}
        >
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: "50%",
              border: "4px solid var(--border)",
              borderTop: "4px solid #435ebe",
              animation: "spinLoader 0.8s linear infinite",
            }}
          />
          <div style={{ textAlign: "center" }}>
            <p style={{ fontWeight: 700, fontSize: 15, color: "var(--foreground)", margin: 0 }}>{title}</p>
            <p style={{ fontSize: 12, color: "var(--muted-foreground)", marginTop: 6 }}>{subtitle}</p>
          </div>
        </div>
      </div>
    </>
  );
}
