import { useEffect, useRef } from "react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import {
  HOUR_HEIGHT,
  getHoursArray,
  getEventsForDate,
  isToday,
  calculateEventPosition,
  resolveOverlaps,
} from "./utils";
import { EventChip } from "./EventChip";
import { EventDetailPopover } from "./EventDetailPopover";

export function DayView({ currentDate, events, onSlotClick, onEventEdit, onEventDelete }) {
  const scrollRef = useRef(null);
  const hours = getHoursArray();
  const dayEvents = getEventsForDate(events, currentDate);
  const allDayEvents = dayEvents.filter((e) => e.allDay);
  const timedEvents = dayEvents.filter((e) => !e.allDay);
  const positioned = resolveOverlaps(timedEvents);
  const today = isToday(currentDate);

  // Auto-scroll so current time is vertically centered
  useEffect(() => {
    if (scrollRef.current) {
      const now = new Date();
      const minutesFromMidnight = now.getHours() * 60 + now.getMinutes();
      const currentTimeOffset = (minutesFromMidnight / 60) * HOUR_HEIGHT;
      const viewportHeight = scrollRef.current.clientHeight;

      scrollRef.current.scrollTop = currentTimeOffset - viewportHeight / 2;
    }
  }, [currentDate]);

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Day header */}
      <div className="flex shrink-0 items-center gap-3 border-b px-4 py-3">
        <span
          className={cn(
            "inline-flex size-10 items-center justify-center rounded-full text-lg font-bold",
            today && "bg-primary text-primary-foreground",
          )}
        >
          {format(currentDate, "d")}
        </span>
        <div>
          <p className="text-sm font-semibold">{format(currentDate, "EEEE")}</p>
          <p className="text-xs text-muted-foreground">{format(currentDate, "MMMM yyyy")}</p>
        </div>
      </div>

      {/* All-day events */}
      {allDayEvents.length > 0 && (
        <div className="flex shrink-0 items-center gap-2 border-b px-4 py-2">
          <span className="text-[10px] text-muted-foreground">All day</span>
          <div className="flex flex-1 flex-wrap gap-1">
            {allDayEvents.map((event) => (
              <EventDetailPopover
                key={event.id}
                event={event}
                onEdit={onEventEdit}
                onDelete={onEventDelete}
              >
                <div className="max-w-xs">
                  <EventChip event={event} variant="compact" />
                </div>
              </EventDetailPopover>
            ))}
          </div>
        </div>
      )}

      {/* Time grid */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        <div className="relative grid grid-cols-[60px_1fr]" style={{ height: 24 * HOUR_HEIGHT }}>
          {/* Hour labels */}
          <div className="relative">
            {hours.map((label, i) => (
              <div
                key={i}
                className="absolute right-2 -translate-y-1/2 text-[10px] text-muted-foreground"
                style={{ top: i * HOUR_HEIGHT }}
              >
                {i > 0 ? label : ""}
              </div>
            ))}
          </div>

          {/* Main column */}
          <div className={cn("relative border-l", today && "bg-primary/[0.03]")}>
            {/* Hour grid lines */}
            {hours.map((_, i) => (
              <div
                key={i}
                className="absolute inset-x-0 border-b border-dashed border-border/50 cursor-pointer hover:bg-accent/30"
                style={{ top: i * HOUR_HEIGHT, height: HOUR_HEIGHT }}
                onClick={() => {
                  const time = `${String(i).padStart(2, "0")}:00`;

                  onSlotClick(currentDate, time);
                }}
              />
            ))}

            {/* Events */}
            {positioned.map((event) => {
              const { top, height } = calculateEventPosition(event);
              const width = `calc(${100 / event.totalCols}% - 8px)`;
              const left = `calc(${(event.col / event.totalCols) * 100}% + 4px)`;

              return (
                <EventDetailPopover
                  key={event.id}
                  event={event}
                  onEdit={onEventEdit}
                  onDelete={onEventDelete}
                >
                  <div className="absolute z-10" style={{ top, height, width, left }}>
                    <EventChip event={event} variant="expanded" className="h-full" />
                  </div>
                </EventDetailPopover>
              );
            })}

            {/* Current time indicator */}
            {today && <CurrentTimeIndicator />}
          </div>
        </div>
      </div>
    </div>
  );
}
function CurrentTimeIndicator() {
  const now = new Date();
  const minutesFromMidnight = now.getHours() * 60 + now.getMinutes();
  const top = (minutesFromMidnight / 60) * HOUR_HEIGHT;

  return (
    <div className="pointer-events-none absolute inset-x-0 z-20 flex items-center" style={{ top }}>
      <div className="size-2 rounded-full bg-destructive" />
      <div className="h-px flex-1 bg-destructive" />
    </div>
  );
}
