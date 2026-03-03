import { cn } from "@/lib/utils";
import { eventColorMap } from "./types";
import { formatEventTime } from "./utils";

export function EventChip({ event, variant = "compact", onClick, className }) {
  const colors = eventColorMap[event.color];

  if (variant === "compact") {
    return (
      <button
        type="button"
        onClick={onClick}
        className={cn(
          "flex w-full items-center gap-1 rounded px-1.5 py-0.5 text-left text-xs transition-opacity hover:opacity-80",
          "border-l-2",
          colors.bg,
          colors.text,
          colors.border,
          className,
        )}
      >
        <span className="truncate font-medium">{event.title}</span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full overflow-hidden rounded px-2 py-1 text-left text-xs transition-opacity hover:opacity-80",
        "border-l-2",
        colors.bg,
        colors.text,
        colors.border,
        className,
      )}
    >
      {/* Use a wrapper that switches between column and row based on available height */}
      <span className="flex min-h-0 min-w-0 flex-1 flex-col justify-center">
        <span className="truncate font-medium leading-tight">{event.title}</span>
        <span className="truncate leading-tight opacity-75">{formatEventTime(event)}</span>
      </span>
    </button>
  );
}
