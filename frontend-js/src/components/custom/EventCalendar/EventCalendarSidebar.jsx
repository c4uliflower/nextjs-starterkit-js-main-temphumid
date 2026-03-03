import { format, isAfter, isSameDay } from "date-fns";
import { Plus } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { eventColorMap } from "./types";

export function EventCalendarSidebar({ currentDate, events, onDateSelect, onAddEvent }) {
  // Get upcoming events (today and future), sorted by start time
  const now = new Date();
  const upcoming = events
    .filter((e) => isAfter(e.start, now) || isSameDay(e.start, now))
    .sort((a, b) => a.start.getTime() - b.start.getTime())
    .slice(0, 6);

  return (
    <div className="flex w-64 shrink-0 flex-col border-r">
      {/* Mini calendar */}
      <div className="border-b p-2">
        <Calendar
          mode="single"
          selected={currentDate}
          onSelect={(date) => date && onDateSelect(date)}
          className="mx-auto bg-transparent p-0"
        />
      </div>

      {/* Upcoming events */}
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="flex items-center justify-between px-3 pt-3 pb-2">
          <h3 className="text-sm font-semibold">Upcoming</h3>
        </div>

        <ScrollArea className="min-h-0 flex-1 px-3">
          {upcoming.length === 0 ? (
            <p className="py-4 text-center text-xs text-muted-foreground">No upcoming events</p>
          ) : (
            <div className="space-y-2 pb-3">
              {upcoming.map((event) => {
                const colors = eventColorMap[event.color];

                return (
                  <button
                    key={event.id}
                    type="button"
                    onClick={() => onDateSelect(event.start)}
                    className="flex w-full items-start gap-2 rounded-md p-2 text-left transition-colors hover:bg-accent"
                  >
                    <div className={cn("mt-1 size-2 shrink-0 rounded-full", colors.dot)} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{event.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {isSameDay(event.start, now) ? "Today" : format(event.start, "MMM d")}
                        {!event.allDay && ` · ${format(event.start, "h:mm a")}`}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </div>

      {/* Add event button */}
      <div className="border-t p-3">
        <Button className="w-full" size="sm" onClick={onAddEvent}>
          <Plus className="mr-1.5 size-4" />
          New Event
        </Button>
      </div>
    </div>
  );
}
