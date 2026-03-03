import {
  format,
  startOfYear,
  addMonths,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isToday,
} from "date-fns";
import { cn } from "@/lib/utils";
import { getEventsForDate } from "./utils";
import { eventColorMap } from "./types";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
const WEEKDAY_LABELS = ["S", "M", "T", "W", "T", "F", "S"];

export function YearView({ currentDate, events, onMonthClick }) {
  const yearStart = startOfYear(currentDate);
  const months = Array.from({ length: 12 }, (_, i) => addMonths(yearStart, i));

  return (
    <TooltipProvider delayDuration={200}>
      <div className="flex-1 overflow-y-auto p-4">
        <div className="mx-auto grid max-w-5xl grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {months.map((month) => (
            <MiniMonth
              key={month.toISOString()}
              month={month}
              events={events}
              onMonthClick={onMonthClick}
            />
          ))}
        </div>
      </div>
    </TooltipProvider>
  );
}
function MiniMonth({ month, events, onMonthClick }) {
  const monthStart = startOfMonth(month);
  const monthEnd = endOfMonth(month);
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 0 });
  const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });
  const allDays = eachDayOfInterval({ start: gridStart, end: gridEnd });
  // Pad to 42 cells (6 rows)
  const weeks = [];

  for (let i = 0; i < allDays.length; i += 7) {
    weeks.push(allDays.slice(i, i + 7));
  }

  return (
    <div className="rounded-lg border bg-card p-3">
      {/* Month header — clickable */}
      <button
        type="button"
        onClick={() => onMonthClick(month)}
        className="mb-2 w-full text-left text-sm font-semibold hover:text-primary transition-colors"
      >
        {format(month, "MMMM")}
      </button>

      {/* Weekday labels */}
      <div className="grid grid-cols-7 mb-1">
        {WEEKDAY_LABELS.map((label, i) => (
          <div key={i} className="text-center text-[10px] font-medium text-muted-foreground">
            {label}
          </div>
        ))}
      </div>

      {/* Day grid */}
      <div className="grid grid-cols-7">
        {weeks.map((week, wi) =>
          week.map((day, di) => {
            const inMonth = isSameMonth(day, month);
            const today = isToday(day);
            const dayEvents = inMonth ? getEventsForDate(events, day) : [];
            const hasEvents = dayEvents.length > 0;
            const cell = (
              <button
                key={`${wi}-${di}`}
                type="button"
                onClick={() => onMonthClick(day)}
                className={cn(
                  "relative flex size-7 items-center justify-center text-[11px] rounded-md transition-colors",
                  !inMonth && "text-muted-foreground/30",
                  inMonth && !today && "hover:bg-accent",
                  today && "bg-primary text-primary-foreground font-bold",
                )}
              >
                {format(day, "d")}
                {/* Event dots */}
                {hasEvents && (
                  <span className="absolute bottom-0.5 flex gap-px">
                    {dayEvents.slice(0, 3).map((ev, idx) => (
                      <span
                        key={idx}
                        className={cn(
                          "size-1 rounded-full",
                          today ? "bg-primary-foreground" : eventColorMap[ev.color].dot,
                        )}
                      />
                    ))}
                  </span>
                )}
              </button>
            );

            if (!hasEvents) return cell;

            return (
              <Tooltip key={`${wi}-${di}`}>
                <TooltipTrigger asChild>{cell}</TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-48">
                  <p className="mb-1 text-xs font-semibold">{format(day, "MMM d")}</p>
                  <div className="space-y-0.5">
                    {dayEvents.slice(0, 4).map((ev) => (
                      <div key={ev.id} className="flex items-center gap-1.5 text-xs">
                        <span
                          className={cn(
                            "size-1.5 shrink-0 rounded-full",
                            eventColorMap[ev.color].dot,
                          )}
                        />
                        <span className="truncate">{ev.title}</span>
                      </div>
                    ))}
                    {dayEvents.length > 4 && (
                      <p className="text-[10px] text-muted-foreground">
                        +{dayEvents.length - 4} more
                      </p>
                    )}
                  </div>
                </TooltipContent>
              </Tooltip>
            );
          }),
        )}
      </div>
    </div>
  );
}
