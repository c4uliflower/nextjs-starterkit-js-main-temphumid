import { useEffect, useRef } from "react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import {
  HOUR_HEIGHT,
  getWeekDays,
  getHoursArray,
  getEventsForDate,
  isToday,
  calculateEventPosition,
  resolveOverlaps,
} from "./utils";
import { EventChip } from "./EventChip";
import { EventDetailPopover } from "./EventDetailPopover";

export function WeekView({ currentDate, events, onSlotClick, onEventEdit, onEventDelete }) {
  const scrollRef = useRef(null);
  const days = getWeekDays(currentDate);
  const hours = getHoursArray();

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
  // Separate all-day events from timed events
  const allDayEventsByDay = days.map((day) =>
    getEventsForDate(events, day).filter((e) => e.allDay),
  );
  const hasAllDay = allDayEventsByDay.some((arr) => arr.length > 0);

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        {/* Sticky header group: column headers + all-day row */}
        <div className="sticky top-0 z-30 bg-card">
          {/* Column headers */}
          <div className="grid grid-cols-[60px_repeat(7,1fr)] border-b">
            <div /> {/* gutter */}
            {days.map((day) => (
              <div
                key={day.toISOString()}
                className={cn(
                  "flex flex-col items-center py-2 text-center",
                  isToday(day) && "bg-primary/5",
                )}
              >
                <span className="text-xs font-medium text-muted-foreground">
                  {format(day, "EEE")}
                </span>
                <span
                  className={cn(
                    "mt-0.5 inline-flex size-7 items-center justify-center rounded-full text-sm font-semibold",
                    isToday(day) && "bg-primary text-primary-foreground",
                  )}
                >
                  {format(day, "d")}
                </span>
              </div>
            ))}
          </div>

          {/* All-day row */}
          {hasAllDay && (
            <div className="grid grid-cols-[60px_repeat(7,1fr)] border-b">
              <div className="flex items-center justify-center text-[10px] text-muted-foreground">
                All day
              </div>
              {allDayEventsByDay.map((dayEvents, i) => (
                <div key={i} className="flex flex-col gap-0.5 border-l p-1">
                  {dayEvents.map((event) => (
                    <EventDetailPopover
                      key={event.id}
                      event={event}
                      onEdit={onEventEdit}
                      onDelete={onEventDelete}
                    >
                      <div>
                        <EventChip event={event} variant="compact" />
                      </div>
                    </EventDetailPopover>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Time grid */}
        <div
          className="relative grid grid-cols-[60px_repeat(7,1fr)]"
          style={{ height: 24 * HOUR_HEIGHT }}
        >
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

          {/* Day columns */}
          {days.map((day, dayIndex) => {
            const timedEvents = getEventsForDate(events, day).filter((e) => !e.allDay);
            const positioned = resolveOverlaps(timedEvents);

            return (
              <div
                key={dayIndex}
                className={cn("relative border-l", isToday(day) && "bg-primary/[0.03]")}
              >
                {/* Hour grid lines */}
                {hours.map((_, i) => (
                  <div
                    key={i}
                    className="absolute inset-x-0 border-b border-dashed border-border/50 cursor-pointer hover:bg-accent/30"
                    style={{
                      top: i * HOUR_HEIGHT,
                      height: HOUR_HEIGHT,
                    }}
                    onClick={() => {
                      const time = `${String(i).padStart(2, "0")}:00`;

                      onSlotClick(day, time);
                    }}
                  />
                ))}

                {/* Events */}
                {positioned.map((event) => {
                  const { top, height } = calculateEventPosition(event);
                  const width = `calc(${100 / event.totalCols}% - 4px)`;
                  const left = `calc(${(event.col / event.totalCols) * 100}% + 2px)`;

                  return (
                    <EventDetailPopover
                      key={event.id}
                      event={event}
                      onEdit={onEventEdit}
                      onDelete={onEventDelete}
                    >
                      <div
                        className="absolute z-10"
                        style={{
                          top,
                          height,
                          width,
                          left,
                        }}
                      >
                        <EventChip event={event} variant="expanded" className="h-full" />
                      </div>
                    </EventDetailPopover>
                  );
                })}

                {/* Current time indicator */}
                {isToday(day) && <CurrentTimeIndicator />}
              </div>
            );
          })}
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
