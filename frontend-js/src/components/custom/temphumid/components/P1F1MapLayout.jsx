import { CardSkeleton } from "@/components/custom/CardSkeleton";
import { Button } from "@/components/ui/button";

import {
  FLOOR_MAP_LEGEND,
  SensorListItem,
  SensorMarker,
} from "@/components/custom/temphumid/components/FloorMapShared";
import {
  DessicatorCard,
  DessicatorZoneMarker,
} from "@/components/custom/temphumid/components/P1F1DessicatorComponents";
import { LoadingOverlay } from "@/components/ui/loadingoverlay";

// Copied from the current temp/humid p1f1 route page and kept additive.

export function P1F1MapLayout({
  title,
  subtitle,
  floorPlanImage,
  imageAlt,
  visibleSensors,
  visibleDessSensors,
  selectedIds,
  toggle,
  toggleAll,
  allSelected,
  totalActiveCount,
  loading,
  dessOpen,
  setDessOpen,
  dessicatorZone,
  dessicatorTemplate,
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

      <div
        className="bg-background"
        style={{ marginTop: 10, padding: "14px 24px", flexShrink: 0 }}
      >
        <h1 className="text-2xl font-bold">{title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {totalActiveCount} sensor{totalActiveCount !== 1 ? "s" : ""} active ·{" "}
          {subtitle}
        </p>
      </div>

      <div className="flex flex-1 overflow-hidden" style={{ minHeight: 0 }}>
        <div
          style={{
            paddingLeft: 20,
            paddingTop: 20,
            paddingBottom: 20,
            boxSizing: "border-box",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <aside
            style={{
              width: 260,
              flexShrink: 0,
              background: "var(--card)",
              borderRight: "1px solid var(--border)",
              border: "1px solid var(--border)",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
              borderRadius: 5,
            }}
          >
            <div
              style={{
                padding: "12px 16px 12px",
                borderBottom: "1px solid var(--border)",
                display: "flex",
                flexDirection: "column",
                gap: 8,
              }}
            >
              <Button
                type="button"
                size="default"
                variant={allSelected ? "outline" : "default"}
                className="w-full cursor-pointer items-center justify-center gap-1.5 font-bold text-sm"
                onClick={toggleAll}
              >
                {allSelected ? "Deselect All" : "Select All"}
              </Button>
            </div>
            <div style={{ flex: 1, overflowY: "auto", padding: "8px 12px" }}>
              <div className="px-1 pb-1 pt-2 text-sm">Line Name</div>
              {visibleSensors.map((sensor) => (
                <SensorListItem
                  key={sensor.id}
                  sensor={sensor}
                  selected={selectedIds.has(sensor.id)}
                  onToggle={toggle}
                />
              ))}
            </div>
            <div
              style={{
                padding: "10px 20px",
                borderTop: "1px solid var(--border)",
                display: "flex",
                flexDirection: "column",
                gap: 4,
              }}
            >
              {legend.map(({ color, label, isText }) => (
                <div
                  key={label}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    fontSize: 11,
                    color: "var(--muted-foreground)",
                  }}
                >
                  {isText ? (
                    <span
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: "50%",
                        background: "#ffe082",
                        display: "block",
                        flexShrink: 0,
                      }}
                    />
                  ) : (
                    <div
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: "50%",
                        background: color,
                        flexShrink: 0,
                      }}
                    />
                  )}
                  {label}
                </div>
              ))}
            </div>
          </aside>
        </div>

        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            minHeight: 0,
          }}
        >
          <div
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              gap: 12,
              padding: 20,
              overflow: "hidden",
              minHeight: 0,
              borderRadius: 5,
            }}
          >
            {loading ? (
              <div style={{ flex: 1, minHeight: 0 }}>
                <CardSkeleton />
              </div>
            ) : (
              <div
                style={{
                  flex: 1,
                  position: "relative",
                  overflow: "hidden",
                  borderRadius: 5,
                  background: "transparent",
                  border: "1px solid var(--border)",
                  minHeight: 0,
                }}
                onClick={(event) => {
                  if (
                    event.target === event.currentTarget ||
                    event.target.tagName === "IMG"
                  ) {
                    setDessOpen(false);
                  }
                }}
              >
                <img
                  src={floorPlanImage}
                  alt={imageAlt}
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "contain",
                    display: "block",
                    userSelect: "none",
                    pointerEvents: "none",
                  }}
                />
                {visibleSensors.map((sensor) => (
                  <SensorMarker
                    key={sensor.id}
                    sensor={sensor}
                    selected={selectedIds.has(sensor.id)}
                    onToggle={toggle}
                  />
                ))}
                <DessicatorZoneMarker
                  zone={dessicatorZone}
                  open={dessOpen}
                  onToggle={() => setDessOpen((value) => !value)}
                  sensors={visibleDessSensors}
                />
              </div>
            )}

            <div
              style={{
                background: "var(--card)",
                border: "1px solid var(--border)",
                borderRadius: 5,
                padding: "10px 16px",
                flexShrink: 0,
              }}
            >
              <div className="mb-2 text-sm">Dessicators</div>
              <div style={{ display: "flex", gap: 10, overflowX: "auto" }}>
                {loading
                  ? dessicatorTemplate.map((sensor) => (
                      <div key={sensor.id} style={{ flex: 1, minWidth: 0 }}>
                        <CardSkeleton />
                      </div>
                    ))
                  : visibleDessSensors.map((sensor) => (
                      <DessicatorCard key={sensor.id} sensor={sensor} />
                    ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

