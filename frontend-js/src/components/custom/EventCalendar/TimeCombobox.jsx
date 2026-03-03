import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";

/** Generate preset time options at the given minute interval. */
function generateTimeOptions(step) {
  const options = [];

  for (let h = 0; h < 24; h++) {
    for (let m = 0; m < 60; m += step) {
      const period = h >= 12 ? "PM" : "AM";
      const h12 = h % 12 || 12;
      const label = `${h12}:${String(m).padStart(2, "0")} ${period}`;
      const value = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;

      options.push({ value, label });
    }
  }

  return options;
}

/** Convert "HH:mm" to a display label like "9:00 AM". */
function toDisplayLabel(time) {
  const [h, m] = time.split(":").map(Number);

  if (isNaN(h) || isNaN(m)) return time;
  const period = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;

  return `${h12}:${String(m).padStart(2, "0")} ${period}`;
}

/** Try to parse a freeform input string into "HH:mm". Returns null if invalid. */
function parseTimeInput(input) {
  const trimmed = input.trim().toUpperCase();

  if (!trimmed) return null;
  // Match patterns: "9", "9:30", "9:30 AM", "09:30", "1330", "13:30", "9am", "9:30pm"
  const match = trimmed.match(/^(\d{1,2}):?(\d{2})?\s*(AM|PM|A|P)?$/);

  if (!match) return null;
  let hours = parseInt(match[1], 10);
  const minutes = match[2] ? parseInt(match[2], 10) : 0;
  const meridian = match[3];

  if (minutes < 0 || minutes > 59) return null;

  if (meridian) {
    if (hours < 1 || hours > 12) return null;
    if (meridian.startsWith("P") && hours !== 12) hours += 12;
    if (meridian.startsWith("A") && hours === 12) hours = 0;
  } else {
    if (hours > 23) return null;
  }

  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}
export function TimeCombobox({ value, onChange, step = 30, className }) {
  const [open, setOpen] = useState(false);
  const [inputValue, setInputValue] = useState(() => toDisplayLabel(value));
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const inputRef = useRef(null);
  const listRef = useRef(null);
  const itemRefs = useRef(new Map());
  const options = useMemo(() => generateTimeOptions(step), [step]);

  // Sync display when value changes externally
  useEffect(() => {
    if (!open) {
      setInputValue(toDisplayLabel(value));
    }
  }, [value, open]);
  // Filter options based on input
  const filtered = useMemo(() => {
    const q = inputValue.trim().toLowerCase();

    if (!q) return options;

    return options.filter((o) => o.label.toLowerCase().includes(q) || o.value.includes(q));
  }, [inputValue, options]);

  // When dropdown opens, set highlight to the current value
  useEffect(() => {
    if (open) {
      const idx = filtered.findIndex((o) => o.value === value);

      setHighlightedIndex(idx >= 0 ? idx : 0);
    }
  }, [open, filtered, value]);
  // Scroll highlighted item into view
  const scrollToHighlighted = useCallback((index) => {
    requestAnimationFrame(() => {
      const el = itemRefs.current.get(index);

      el?.scrollIntoView({ block: "nearest" });
    });
  }, []);

  function handleSelect(optionValue) {
    onChange(optionValue);
    setInputValue(toDisplayLabel(optionValue));
    setOpen(false);
  }
  function commitInput() {
    const parsed = parseTimeInput(inputValue);

    if (parsed) {
      onChange(parsed);
      setInputValue(toDisplayLabel(parsed));
    } else {
      setInputValue(toDisplayLabel(value));
    }
  }
  function handleKeyDown(e) {
    if (!open) {
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        setOpen(true);

        return;
      }
    }
    if (open && filtered.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        const next = highlightedIndex < filtered.length - 1 ? highlightedIndex + 1 : 0;

        setHighlightedIndex(next);
        scrollToHighlighted(next);

        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        const next = highlightedIndex > 0 ? highlightedIndex - 1 : filtered.length - 1;

        setHighlightedIndex(next);
        scrollToHighlighted(next);

        return;
      }
    }
    if (e.key === "Enter") {
      e.preventDefault();

      if (open && highlightedIndex >= 0 && highlightedIndex < filtered.length) {
        handleSelect(filtered[highlightedIndex].value);
      } else {
        commitInput();
        setOpen(false);
      }

      return;
    }
    if (e.key === "Escape") {
      setInputValue(toDisplayLabel(value));
      setOpen(false);
    }
    if (e.key === "Tab") {
      commitInput();
      setOpen(false);
    }
  }

  return (
    <Popover open={open} modal={false}>
      <PopoverAnchor asChild>
        <div className={cn("relative flex items-center", className)}>
          <Clock className="pointer-events-none absolute left-2.5 size-4 text-muted-foreground" />
          <Input
            ref={inputRef}
            value={inputValue}
            onChange={(e) => {
              setInputValue(e.target.value);
              setHighlightedIndex(0);
              if (!open) setOpen(true);
            }}
            onFocus={() => {
              setOpen(true);
              inputRef.current?.select();
            }}
            onBlur={() => {
              // Delay so option clicks register before closing
              setTimeout(() => {
                setOpen(false);
                commitInput();
              }, 200);
            }}
            onKeyDown={handleKeyDown}
            placeholder="e.g. 9:00 AM"
            className="pl-8 pr-2"
          />
        </div>
      </PopoverAnchor>
      <PopoverContent
        className="w-[--radix-popover-trigger-width] p-0"
        align="start"
        onOpenAutoFocus={(e) => e.preventDefault()}
        onCloseAutoFocus={(e) => e.preventDefault()}
        onInteractOutside={(e) => {
          // Don't close if clicking the input itself
          if (inputRef.current?.contains(e.target)) {
            e.preventDefault();
          }
        }}
      >
        <ScrollArea className="h-52">
          <div ref={listRef} className="p-1" role="listbox">
            {filtered.length === 0 ? (
              <p className="px-2 py-4 text-center text-sm text-muted-foreground">
                Press Enter to use "{inputValue}"
              </p>
            ) : (
              filtered.map((option, index) => (
                <button
                  key={option.value}
                  ref={(el) => {
                    if (el) itemRefs.current.set(index, el);
                    else itemRefs.current.delete(index);
                  }}
                  type="button"
                  role="option"
                  aria-selected={index === highlightedIndex}
                  className={cn(
                    "flex w-full items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors",
                    index === highlightedIndex
                      ? "bg-primary text-primary-foreground"
                      : option.value === value
                        ? "bg-accent text-accent-foreground"
                        : "hover:bg-accent hover:text-accent-foreground",
                  )}
                  onMouseDown={(e) => e.preventDefault()}
                  onMouseEnter={() => setHighlightedIndex(index)}
                  onClick={() => handleSelect(option.value)}
                >
                  {option.label}
                </button>
              ))
            )}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
