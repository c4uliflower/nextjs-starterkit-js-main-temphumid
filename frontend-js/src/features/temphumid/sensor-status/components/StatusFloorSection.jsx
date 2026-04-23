import { Button } from "@/components/ui/button";
import {
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Switch } from "@/components/ui/switch";

import { CHEVRON_STYLE } from "@/utils/admin-ui";

// Copied from the current temp/humid status route page as an additive scaffold.

export function StatusFloorSection({
  floor,
  sensors,
  original,
  draft,
  saving,
  apiError,
  onToggle,
  onSave,
}) {
  const isChanged = (areaId) => draft[areaId] !== original[areaId];
  const changedIds = sensors.filter((sensor) => isChanged(sensor.areaId)).map((sensor) => sensor.areaId);
  const hasChanges = changedIds.length > 0;

  const activeCount = sensors.filter((sensor) => draft[sensor.areaId] === "Active").length;
  const inactiveCount = sensors.filter((sensor) => draft[sensor.areaId] === "Inactive").length;

  return (
    <>
      <style>{CHEVRON_STYLE}</style>
      <AccordionItem
        value={floor.slug}
        style={{
          background: "var(--card)",
          border: "1px solid var(--border)",
          borderRadius: 8,
          overflow: "hidden",
        }}
        className="border-0"
      >
        <AccordionTrigger
          className="rounded-none px-0 py-0 hover:no-underline [&>svg]:hidden"
          style={{ background: "none" }}
        >
          <div
            style={{
              width: "100%",
              padding: "14px 20px",
              borderBottom: "1px solid var(--border)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div>
                <p style={{ margin: 0 }}>{floor.label}</p>
                <p
                  style={{
                    fontSize: 11,
                    margin: 0,
                    marginTop: 2,
                    color: "var(--muted-foreground)",
                  }}
                >
                  {activeCount} active - {inactiveCount} inactive - {sensors.length} total
                </p>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              {hasChanges && !saving && (
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: "#fff",
                    background: "rgba(255,255,255,.2)",
                    borderRadius: 5,
                    padding: "2px 8px",
                  }}
                >
                  {changedIds.length} unsaved change{changedIds.length !== 1 ? "s" : ""}
                </span>
              )}
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  color: "var(--muted-foreground)",
                  letterSpacing: ".06em",
                  textTransform: "uppercase",
                }}
              >
                {floor.subLabel}
              </span>
              <svg
                className="floor-chevron"
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="var(--foreground)"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </div>
          </div>
        </AccordionTrigger>

        <AccordionContent className="pb-0">
          <div>
            {[...sensors]
              .sort((left, right) => left.lineName.localeCompare(right.lineName))
              .map(({ areaId, lineName }) => {
                const isActive = draft[areaId] === "Active";
                const changed = isChanged(areaId);

                return (
                  <div
                    key={areaId}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "10px 20px",
                      borderBottom: "1px solid var(--border)",
                      background: changed ? "rgba(67,94,190,.04)" : "transparent",
                      transition: "background .1s",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div
                        style={{
                          width: 7,
                          height: 7,
                          borderRadius: "50%",
                          flexShrink: 0,
                          background: isActive ? "#00c9a7" : "#adb5bd",
                        }}
                      />
                      <div>
                        <span
                          style={{
                            fontSize: 13,
                            fontWeight: changed ? 600 : 400,
                            color: "var(--foreground)",
                          }}
                        >
                          {lineName}
                        </span>
                      </div>
                      {changed && (
                        <span
                          style={{
                            fontSize: 10,
                            fontWeight: 700,
                            color: "#fd7e14",
                            letterSpacing: ".04em",
                          }}
                        >
                          CHANGED
                        </span>
                      )}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 600,
                          color: isActive ? "#00c9a7" : "#adb5bd",
                          minWidth: 52,
                          textAlign: "right",
                        }}
                      >
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

          <div
            style={{
              padding: "12px 20px",
              borderTop: "1px solid var(--border)",
              display: "flex",
              gap: 8,
              alignItems: "center",
              justifyContent: "flex-end",
              background: "var(--card)",
            }}
          >
            {saving && (
              <span className="text-sm text-muted-foreground" style={{ marginRight: "auto" }}>
                Saving to database...
              </span>
            )}
            {apiError && !saving && (
              <div
                style={{
                  marginRight: "auto",
                  background: "#ffe8e8",
                  border: "1.5px solid #dc3545",
                  borderRadius: 8,
                  padding: "6px 12px",
                }}
                className="text-sm text-destructive"
              >
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
              {saving ? "Saving..." : `Save ${floor.subLabel}`}
            </Button>
          </div>
        </AccordionContent>
      </AccordionItem>
    </>
  );
}
