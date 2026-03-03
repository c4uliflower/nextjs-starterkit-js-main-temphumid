import * as React from "react";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { TimePicker } from "@/components/ui/time-picker";

// ── DateTimePicker ───────────────────────────────────
function DateTimePicker({
  value,
  onChange,
  placeholder = "Pick date and time",
  dateFormat = "PPP",
  hourFormat = "12",
  disabled,
  className,
  calendarProps,
}) {
  const timeFormat = hourFormat === "12" ? "h:mm a" : "HH:mm";
  const label = value
    ? `${format(value, dateFormat)} at ${format(value, timeFormat)}`
    : placeholder;

  const handleDateSelect = (date) => {
    if (!date) {
      onChange?.(undefined);

      return;
    }

    // Preserve existing time when picking a new date
    const next = new Date(date);

    if (value) {
      next.setHours(value.getHours(), value.getMinutes(), 0, 0);
    }

    onChange?.(next);
  };
  const handleTimeChange = (time) => {
    // Preserve existing date when changing time
    const next = new Date(value ?? new Date());

    next.setHours(time.getHours(), time.getMinutes(), 0, 0);
    onChange?.(next);
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          disabled={disabled}
          className={cn(
            "w-[320px] justify-start text-left font-normal",
            !value && "text-muted-foreground",
            className,
          )}
        >
          <CalendarIcon className="mr-2 size-4" />
          {label}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <div className="p-2">
          <Calendar mode="single" selected={value} onSelect={handleDateSelect} {...calendarProps} />
        </div>
        <Separator />
        <div className="flex items-center justify-center p-3">
          <TimePicker
            value={value}
            onChange={handleTimeChange}
            hourFormat={hourFormat}
            disabled={disabled}
          />
        </div>
      </PopoverContent>
    </Popover>
  );
}

export { DateTimePicker };
