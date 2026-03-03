import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { getMonthGrid, getEventsForDate, isSameMonth, isToday } from "./utils";
import { EventChip } from "./EventChip";
import { EventDetailPopover } from "./EventDetailPopover";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MAX_VISIBLE_EVENTS = 2;

export function MonthView({ currentDate, events, onDateClick, onEventEdit, onEventDelete }) {
  const weeks = getMonthGrid(currentDate);

  return (
    <div className="flex flex-1 flex-col">
      {/* Weekday headers */}
      <div className="grid grid-cols-7 border-b">
        {WEEKDAYS.map((day) => (
          <div
            key={day}
            className="px-2 py-2 text-center text-xs font-medium text-muted-foreground"
          >
            {day}
          </div>
        ))}
      </div>

      {/* Day grid */}
      <div className="grid flex-1 grid-cols-7 grid-rows-6">
        {weeks.map((week, wi) =>
          week.map((day, di) => {
            const dayEvents = getEventsForDate(events, day);
            const isCurrentMonth = isSameMonth(day, currentDate);
            const today = isToday(day);
            const visibleEvents = dayEvents.slice(0, MAX_VISIBLE_EVENTS);
            const overflowCount = dayEvents.length - MAX_VISIBLE_EVENTS;

            return (
              <div
                key={`${wi}-${di}`}
                className={cn(
                  "group relative flex min-h-24 flex-col border-b border-r p-1 transition-colors",
                  !isCurrentMonth && "bg-muted/30",
                  "hover:bg-accent/50 cursor-pointer",
                )}
                onClick={() => onDateClick(day)}
              >
                {/* Day number */}
                <span
                  className={cn(
                    "mb-0.5 inline-flex size-6 items-center justify-center rounded-full text-xs",
                    today && "bg-primary text-primary-foreground font-semibold",
                    !today && isCurrentMonth && "text-foreground",
                    !today && !isCurrentMonth && "text-muted-foreground",
                  )}
                >
                  {format(day, "d")}
                </span>

                {/* Event chips */}
                <div className="flex flex-1 flex-col gap-0.5">
                  {visibleEvents.map((event) => (
                    <EventDetailPopover
                      key={event.id}
                      event={event}
                      onEdit={onEventEdit}
                      onDelete={onEventDelete}
                    >
                      <div onClick={(e) => e.stopPropagation()}>
                        <EventChip event={event} variant="compact" />
                      </div>
                    </EventDetailPopover>
                  ))}

                  {/* Overflow */}
                  {overflowCount > 0 && (
                    <Popover>
                      <PopoverTrigger asChild>
                        <button
                          type="button"
                          className="rounded px-1.5 py-0.5 text-left text-xs font-medium text-muted-foreground hover:bg-accent hover:text-foreground"
                          onClick={(e) => e.stopPropagation()}
                        >
                          +{overflowCount} more
                        </button>
                      </PopoverTrigger>
                      <PopoverContent
                        className="w-56 p-2"
                        align="start"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <p className="mb-2 text-xs font-semibold text-muted-foreground">
                          {format(day, "EEEE, MMM d")}
                        </p>
                        <div className="space-y-1">
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
                      </PopoverContent>
                    </Popover>
                  )}
                </div>
              </div>
            );
          }),
        )}
      </div>
    </div>
  );
}
