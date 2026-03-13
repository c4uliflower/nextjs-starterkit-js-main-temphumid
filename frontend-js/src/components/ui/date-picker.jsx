import * as React from "react";
import { format, subDays, startOfMonth, startOfYear } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";

// ── Default presets ──────────────────────────────────
export const defaultDateRangePresets = [
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

function DatePicker({
  value,
  onChange,
  placeholder = "Pick a date",
  dateFormat = "PPP",
  disabled,
  className,
  presets,
  calendarProps,
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          disabled={disabled}
          className={cn(
            "w-[280px] justify-start text-left font-normal",
            !value && "text-muted-foreground",
            className,
          )}
        >
          <CalendarIcon className="mr-2 size-4" />
          {value ? format(value, dateFormat) : placeholder}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <div className={cn("flex", presets && "flex-row")}>
          {presets && (
            <div className="flex flex-col gap-1 border-r p-2">
              {presets.map((preset) => (
                <Button
                  key={preset.label}
                  variant="ghost"
                  size="sm"
                  className="justify-start text-xs"
                  onClick={() => onChange?.(preset.date)}
                >
                  {preset.label}
                </Button>
              ))}
              <Separator className="my-1" />
              <Button
                variant="ghost"
                size="sm"
                className="justify-start text-xs text-muted-foreground"
                onClick={() => onChange?.(undefined)}
              >
                Clear
              </Button>
            </div>
          )}
          <div className="p-2">
            <Calendar
              mode="single"
              selected={value}
              onSelect={(date) => onChange?.(date)}
              {...calendarProps}
            />
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function DateRangePicker({
  value,
  onChange,
  placeholder = "Pick a date range",
  dateFormat = "MMM d, yyyy",
  disabled,
  className,
  presets,
  numberOfMonths = 2,
  calendarProps,
}) {
  const label = value?.from
    ? value.to
      ? `${format(value.from, dateFormat)} – ${format(value.to, dateFormat)}`
      : format(value.from, dateFormat)
    : placeholder;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          disabled={disabled}
          className={cn(
            "w-[320px] justify-start text-left font-normal",
            !value?.from && "text-muted-foreground",
            className,
          )}
        >
          <CalendarIcon className="mr-2 size-4" />
          {label}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <div className={cn("flex", presets && "flex-row")}>
          {presets && (
            <div className="flex flex-col gap-1 border-r p-2">
              {presets.map((preset) => (
                <Button
                  key={preset.label}
                  variant="ghost"
                  size="sm"
                  className="justify-start text-xs"
                  onClick={() => onChange?.(preset.range())}
                >
                  {preset.label}
                </Button>
              ))}
              <Separator className="my-1" />
              <Button
                variant="ghost"
                size="sm"
                className="justify-start text-xs text-muted-foreground"
                onClick={() => onChange?.(undefined)}
              >
                Clear
              </Button>
            </div>
          )}
          <div className="p-2">
            <Calendar
              mode="range"
              selected={value}
              onSelect={(range) => {
                if (range?.from) {
                  onChange?.({ from: range.from, to: range.to });
                } else {
                  onChange?.(undefined);
                }
              }}
              numberOfMonths={numberOfMonths}
              defaultMonth={value?.from}
              {...calendarProps}
            />
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export { DatePicker, DateRangePicker };