import * as React from "react";
import { ChevronUp, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

function TimeField({ value, onChange, min, max, step = 1, disabled }) {
  const increment = () => {
    const next = value + step;

    onChange(next > max ? min : next);
  };
  const decrement = () => {
    const next = value - step;

    onChange(
      next < min
        ? max - ((max - min + 1) % step === 0 ? 0 : (max - min + 1) % step) + step - step
        : next,
    );
    // Simplified: just wrap around
  };
  const handleDecrement = () => {
    const next = value - step;

    onChange(next < min ? max : next);
  };
  const handleKeyDown = (e) => {
    if (e.key === "ArrowUp") {
      e.preventDefault();
      increment();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      handleDecrement();
    }
  };
  const handleChange = (e) => {
    const raw = e.target.value.replace(/\D/g, "");

    if (raw === "") return;
    const num = parseInt(raw, 10);

    if (num >= min && num <= max) {
      onChange(num);
    }
  };

  return (
    <div className="flex flex-col items-center gap-0.5">
      <Button
        variant="ghost"
        size="icon-xs"
        type="button"
        disabled={disabled}
        onClick={increment}
        tabIndex={-1}
        className="text-muted-foreground hover:text-foreground"
      >
        <ChevronUp className="size-4" />
      </Button>
      <input
        type="text"
        inputMode="numeric"
        value={value.toString().padStart(2, "0")}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        className={cn(
          "border-input bg-transparent text-center text-sm font-medium tabular-nums",
          "w-10 rounded-md border px-1 py-1.5",
          "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] outline-none",
          "disabled:cursor-not-allowed disabled:opacity-50",
        )}
      />
      <Button
        variant="ghost"
        size="icon-xs"
        type="button"
        disabled={disabled}
        onClick={handleDecrement}
        tabIndex={-1}
        className="text-muted-foreground hover:text-foreground"
      >
        <ChevronDown className="size-4" />
      </Button>
    </div>
  );
}
// ── TimePicker ───────────────────────────────────────
function TimePicker({ value, onChange, hourFormat = "12", minuteStep = 1, disabled, className }) {
  const baseDate = value ?? new Date();
  const hours24 = baseDate.getHours();
  const minutes = baseDate.getMinutes();
  const is12h = hourFormat === "12";
  const displayHour = is12h ? hours24 % 12 || 12 : hours24;
  const period = hours24 >= 12 ? "PM" : "AM";

  const updateTime = (newHours24, newMinutes) => {
    const next = new Date(baseDate);

    next.setHours(newHours24, newMinutes, 0, 0);
    onChange?.(next);
  };
  const handleHourChange = (h) => {
    if (is12h) {
      // Convert 12h display back to 24h
      let h24 = h % 12;

      if (period === "PM") h24 += 12;
      updateTime(h24, minutes);
    } else {
      updateTime(h, minutes);
    }
  };
  const handleMinuteChange = (m) => {
    updateTime(hours24, m);
  };
  const togglePeriod = () => {
    const newHours = hours24 >= 12 ? hours24 - 12 : hours24 + 12;

    updateTime(newHours, minutes);
  };

  // Calculate max minute that wraps properly with step
  const maxMinute = minuteStep === 1 ? 59 : Math.floor(59 / minuteStep) * minuteStep;

  return (
    <div className={cn("flex items-center gap-1", className)}>
      <TimeField
        value={displayHour}
        onChange={handleHourChange}
        min={is12h ? 1 : 0}
        max={is12h ? 12 : 23}
        disabled={disabled}
      />
      <span className="text-sm font-medium text-muted-foreground pb-0.5">:</span>
      <TimeField
        value={minutes}
        onChange={handleMinuteChange}
        min={0}
        max={maxMinute}
        step={minuteStep}
        disabled={disabled}
      />
      {is12h && (
        <div className="flex flex-col items-center gap-0.5">
          <Button
            variant="ghost"
            size="icon-xs"
            type="button"
            disabled={disabled}
            onClick={togglePeriod}
            tabIndex={-1}
            className="text-muted-foreground hover:text-foreground"
          >
            <ChevronUp className="size-4" />
          </Button>
          <button
            type="button"
            onClick={togglePeriod}
            disabled={disabled}
            className={cn(
              "border-input bg-transparent text-center text-sm font-medium",
              "w-10 rounded-md border px-1 py-1.5",
              "hover:bg-accent hover:text-accent-foreground",
              "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] outline-none",
              "disabled:cursor-not-allowed disabled:opacity-50",
            )}
          >
            {period}
          </button>
          <Button
            variant="ghost"
            size="icon-xs"
            type="button"
            disabled={disabled}
            onClick={togglePeriod}
            tabIndex={-1}
            className="text-muted-foreground hover:text-foreground"
          >
            <ChevronDown className="size-4" />
          </Button>
        </div>
      )}
    </div>
  );
}

export { TimePicker };
