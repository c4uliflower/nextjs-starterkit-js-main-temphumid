import { Button } from "@/components/ui/button";
import { CardSkeleton } from "@/components/custom/CardSkeleton";

import { SensorListItem, SensorMarker, FLOOR_MAP_LEGEND } from "@/components/custom/temphumid/components/FloorMapShared";
import { LoadingOverlay } from "@/components/ui/loadingoverlay";

// Copied from the current temp/humid floor-map route pages and consolidated as an additive scaffold.

export function FloorMapLayout({
  title,
  subtitle,
  floorPlanImage,
  imageAlt,
  visibleSensors,
  selectedIds,
  toggle,
  toggleAll,
  allSelected,
  totalActiveCount,
  loading,
  legend = FLOOR_MAP_LEGEND,
}) {
  return (
    <div className="flex flex-col h-full overflow-hidden" style={{ minHeight: 0 }}>
      {loading && (
        <LoadingOverlay
          title="Fetching sensor data"
          subtitle="Please wait while live readings are loaded..."
        />
      )}

      <div style={{ marginTop: 10, padding: "14px 24px", flexShrink: 0 }} className="bg-background">
        <h1 className="text-2xl font-bold">{title}</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {totalActiveCount} sensor{totalActiveCount !== 1 ? "s" : ""} active · {subtitle}
        </p>
      </div>

      <div className="flex flex-1 overflow-hidden" style={{ minHeight: 0 }}>
        <div style={{ paddingLeft: 20, paddingTop: 20, paddingBottom: 20, boxSizing: "border-box", display: "flex", flexDirection: "column" }}>
          <aside style={{ width: 260, flexShrink: 0, background: "var(--card)", border: "1px solid var(--border)", display: "flex", flexDirection: "column", overflow: "hidden", borderRadius: 5 }}>
            <div style={{ padding: "12px 16px 12px", borderBottom: "1px solid var(--border)", display: "flex", flexDirection: "column", gap: 8 }}>
              <Button type="button" size="default" variant={allSelected ? "outline" : "default"} className="w-full flex items-center justify-center gap-1.5 font-bold text-sm cursor-pointer" onClick={toggleAll}>
                {allSelected ? "Deselect All" : "Select All"}
              </Button>
            </div>
            <div style={{ flex: 1, overflowY: "auto", padding: "8px 12px" }}>
              <div className="text-sm px-1 pt-2 pb-1">Line Name</div>
              {visibleSensors.map((sensor) => (
                <SensorListItem key={sensor.id} sensor={sensor} selected={selectedIds.has(sensor.id)} onToggle={toggle} />
              ))}
            </div>
            <div style={{ padding: "10px 20px 16px", borderTop: "1px solid var(--border)", display: "flex", flexDirection: "column", gap: 4 }}>
              {legend.map(({ color, label, isText }) => (
                <div key={label} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "var(--muted-foreground)" }}>
                  {isText ? <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#ffe082", display: "block", flexShrink: 0 }} /> : <div style={{ width: 8, height: 8, borderRadius: "50%", background: color, flexShrink: 0 }} />}
                  {label}
                </div>
              ))}
            </div>
          </aside>
        </div>

        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", minHeight: 0 }}>
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 12, padding: 20, overflow: "hidden", minHeight: 0, borderRadius: 5 }}>
            {loading ? (
              <div style={{ flex: 1, minHeight: 0 }}>
                <CardSkeleton />
              </div>
            ) : (
              <div style={{ flex: 1, position: "relative", overflow: "hidden", borderRadius: 5, background: "transparent", border: "1px solid #e9ecef", minHeight: 0 }}>
                <img src={floorPlanImage} alt={imageAlt} style={{ width: "100%", height: "100%", objectFit: "contain", display: "block", userSelect: "none", pointerEvents: "none" }} />
                {visibleSensors.map((sensor) => (
                  <SensorMarker key={sensor.id} sensor={sensor} selected={selectedIds.has(sensor.id)} onToggle={toggle} />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

