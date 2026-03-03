import { format, subDays, startOfMonth, startOfYear } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
const presets = [
  { label: "Today", range: () => ({ from: new Date(), to: new Date() }) },
  {
    label: "Last 7 days",
    range: () => ({ from: subDays(new Date(), 7), to: new Date() }),
  },
  {
    label: "Last 30 days",
    range: () => ({ from: subDays(new Date(), 30), to: new Date() }),
  },
  {
    label: "This month",
    range: () => ({ from: startOfMonth(new Date()), to: new Date() }),
  },
  {
    label: "This year",
    range: () => ({ from: startOfYear(new Date()), to: new Date() }),
  },
];

export function DataTableDateFilter({ column, title }) {
  const filterValue = column?.getFilterValue();

  const handleSelect = (range) => {
    column?.setFilterValue(range);
  };

  const label = filterValue?.from
    ? filterValue.to
      ? `${format(filterValue.from, "MMM d, yyyy")} - ${format(filterValue.to, "MMM d, yyyy")}`
      : format(filterValue.from, "MMM d, yyyy")
    : (title ?? "Pick a date");

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn("h-8 border-dashed", filterValue && "border-solid")}
        >
          <CalendarIcon className="mr-2 size-4" />
          <span className="max-w-[180px] truncate">{label}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <div className="flex">
          <div className="flex flex-col gap-1 border-r p-2">
            {presets.map((preset) => (
              <Button
                key={preset.label}
                variant="ghost"
                size="sm"
                className="justify-start text-xs"
                onClick={() => handleSelect(preset.range())}
              >
                {preset.label}
              </Button>
            ))}
            <Separator className="my-1" />
            <Button
              variant="ghost"
              size="sm"
              className="justify-start text-xs text-muted-foreground"
              onClick={() => handleSelect(undefined)}
            >
              Clear
            </Button>
          </div>
          <div className="p-2">
            <Calendar
              mode="range"
              captionLayout="dropdown"
              startMonth={new Date(2015, 0)}
              endMonth={new Date(2035, 11)}
              selected={filterValue ? { from: filterValue.from, to: filterValue.to } : undefined}
              onSelect={(range) => {
                if (range?.from) {
                  handleSelect({ from: range.from, to: range.to });
                } else {
                  handleSelect(undefined);
                }
              }}
              numberOfMonths={2}
              defaultMonth={filterValue?.from}
            />
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
// Custom filter function for date range columns
export function dateRangeFilterFn(row, columnId, filterValue) {
  if (!filterValue?.from) return true;
  const cellValue = row.getValue(columnId);

  if (!cellValue) return false;
  const date = new Date(cellValue);
  const from = new Date(filterValue.from);

  from.setHours(0, 0, 0, 0);

  if (filterValue.to) {
    const to = new Date(filterValue.to);

    to.setHours(23, 59, 59, 999);

    return date >= from && date <= to;
  }

  return date >= from;
}
