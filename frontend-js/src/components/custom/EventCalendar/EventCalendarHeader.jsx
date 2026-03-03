import {
  format,
  addYears,
  subYears,
  addMonths,
  subMonths,
  addWeeks,
  subWeeks,
  addDays,
  subDays,
  startOfWeek,
  endOfWeek,
} from "date-fns";
import { ChevronLeft, ChevronRight, PanelLeftClose, PanelLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
const VIEWS = [
  { value: "year", label: "Year" },
  { value: "month", label: "Month" },
  { value: "week", label: "Week" },
  { value: "day", label: "Day" },
];

export function EventCalendarHeader({
  currentDate,
  view,
  sidebarOpen,
  onDateChange,
  onViewChange,
  onToggleSidebar,
}) {
  function navigate(direction) {
    const fn =
      view === "year"
        ? direction === "prev"
          ? subYears
          : addYears
        : view === "month"
          ? direction === "prev"
            ? subMonths
            : addMonths
          : view === "week"
            ? direction === "prev"
              ? subWeeks
              : addWeeks
            : direction === "prev"
              ? subDays
              : addDays;

    onDateChange(fn(currentDate, 1));
  }
  function getPeriodLabel() {
    if (view === "year") return format(currentDate, "yyyy");
    if (view === "month") return format(currentDate, "MMMM yyyy");

    if (view === "week") {
      const weekStart = startOfWeek(currentDate, { weekStartsOn: 0 });
      const weekEnd = endOfWeek(currentDate, { weekStartsOn: 0 });
      const sameMonth = weekStart.getMonth() === weekEnd.getMonth();

      return sameMonth
        ? `${format(weekStart, "MMM d")} – ${format(weekEnd, "d, yyyy")}`
        : `${format(weekStart, "MMM d")} – ${format(weekEnd, "MMM d, yyyy")}`;
    }

    return format(currentDate, "EEEE, MMMM d, yyyy");
  }

  return (
    <div className="flex shrink-0 flex-wrap items-center gap-2 border-b px-4 py-2">
      {/* Sidebar toggle */}
      <Button
        variant="ghost"
        size="icon"
        onClick={onToggleSidebar}
        className="hidden md:inline-flex"
      >
        {sidebarOpen ? <PanelLeftClose className="size-4" /> : <PanelLeft className="size-4" />}
      </Button>

      {/* Navigation */}
      <div className="flex items-center gap-1">
        <Button variant="outline" size="icon" onClick={() => navigate("prev")}>
          <ChevronLeft className="size-4" />
        </Button>
        <Button variant="outline" size="icon" onClick={() => navigate("next")}>
          <ChevronRight className="size-4" />
        </Button>
      </div>

      <Button variant="outline" size="sm" onClick={() => onDateChange(new Date())}>
        Today
      </Button>

      {/* Period label */}
      <h2 className="text-base font-semibold sm:text-lg">{getPeriodLabel()}</h2>

      {/* Spacer */}
      <div className="flex-1" />

      {/* View switcher */}
      <div className="flex rounded-md border">
        {VIEWS.map((v) => (
          <Button
            key={v.value}
            variant={view === v.value ? "default" : "ghost"}
            size="sm"
            className={cn(
              "rounded-none first:rounded-l-md last:rounded-r-md",
              view !== v.value && "border-0",
            )}
            onClick={() => onViewChange(v.value)}
          >
            {v.label}
          </Button>
        ))}
      </div>
    </div>
  );
}
