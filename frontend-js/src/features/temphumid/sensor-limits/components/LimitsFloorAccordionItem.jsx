import {
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

import { CHEVRON_STYLE } from "@/utils/admin-ui";

// Copied from the current temp/humid limits route page as an additive scaffold.

export function LimitsFloorAccordionItem({
  floor,
  groups,
  activeId,
  saving,
  isChanged,
  hasRowError,
  onSelect,
  sensorStatuses,
}) {
  const floorSensors = groups.flatMap((group) => group.sensors);
  const changedCount = floorSensors.filter((sensor) => isChanged(sensor.id)).length;
  const errorCount = floorSensors.filter((sensor) => hasRowError(sensor.id)).length;

  return (
    <>
      <style>{CHEVRON_STYLE}</style>
      <AccordionItem value={floor.slug} className="border-0">
        <AccordionTrigger
          className="rounded-none px-0 py-0 pr-0 hover:no-underline [&>svg]:hidden"
          style={{ background: "none" }}
        >
          <div
            style={{
              width: "100%",
              padding: "11px 16px",
              borderBottom: "1px solid var(--border)",
              borderTop: "1px solid var(--border)",
              background: "var(--card)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <div>
              <p style={{ margin: 0 }}>{floor.label}</p>
              <p
                style={{
                  fontSize: 10,
                  color: "var(--muted-foreground)",
                  margin: 0,
                  letterSpacing: ".05em",
                  textTransform: "uppercase",
                }}
              >
                {floor.subLabel} - {floorSensors.length} sensor
                {floorSensors.length !== 1 ? "s" : ""}
              </p>
            </div>
            <div
              style={{ display: "flex", gap: 6, alignItems: "center", marginRight: 8 }}
            >
              {errorCount > 0 && (
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    color: "#fff",
                    background: "#dc3545",
                    borderRadius: 5,
                    padding: "2px 7px",
                  }}
                >
                  {errorCount} error{errorCount !== 1 ? "s" : ""}
                </span>
              )}
              {changedCount > 0 && !errorCount && (
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    color: "#fff",
                    background: "rgba(255,255,255,.2)",
                    borderRadius: 5,
                    padding: "2px 7px",
                  }}
                >
                  {changedCount} changed
                </span>
              )}
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
          <div style={{ background: "var(--card)" }}>
            {groups.map(({ group, sensors }) => (
              <div key={group}>
                {groups.length > 1 && (
                  <div
                    style={{ padding: "7px 16px 6px" }}
                    className="text-xs font-semibold uppercase tracking-widest text-muted-foreground"
                  >
                    {group}
                  </div>
                )}
                {sensors.map((sensor) => {
                  const selected = sensor.id === activeId;
                  const changed = isChanged(sensor.id);
                  const rowError = hasRowError(sensor.id);
                  const isActive = sensorStatuses[sensor.areaId] === "Active";

                  return (
                    <div
                      key={sensor.id}
                      onClick={() => !saving && onSelect(sensor.id)}
                      style={{
                        padding: "9px 16px",
                        cursor: saving ? "default" : "pointer",
                        background: selected ? "rgba(67,94,190,.10)" : "transparent",
                        borderLeft: `3px solid ${selected ? "#435ebe" : "transparent"}`,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        transition: "background .1s",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                          overflow: "hidden",
                        }}
                      >
                        <div
                          style={{
                            width: 7,
                            height: 7,
                            borderRadius: "50%",
                            flexShrink: 0,
                            background: isActive ? "#00c9a7" : "#adb5bd",
                          }}
                        />
                        <span
                          style={{
                            fontSize: 13,
                            fontWeight: selected ? 700 : 400,
                            color: rowError
                              ? "#dc3545"
                              : changed
                                ? "#fd7e14"
                                : "var(--foreground)",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {sensor.lineName}
                        </span>
                      </div>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 4,
                          flexShrink: 0,
                        }}
                      >
                        {!rowError && changed && (
                          <span
                            style={{
                              width: 6,
                              height: 6,
                              borderRadius: "50%",
                              background: "#fd7e14",
                              display: "block",
                            }}
                            title="Unsaved change"
                          />
                        )}
                        {rowError && (
                          <span
                            style={{
                              width: 6,
                              height: 6,
                              borderRadius: "50%",
                              background: "#dc3545",
                              display: "block",
                            }}
                            title="Validation error"
                          />
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </AccordionContent>
      </AccordionItem>
    </>
  );
}
