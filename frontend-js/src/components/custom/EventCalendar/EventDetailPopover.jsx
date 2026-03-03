import { useState } from "react";
import { format } from "date-fns";
import { Calendar, Clock, MapPin, Pencil, Trash2 } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { eventColorMap } from "./types";
import { formatEventTime } from "./utils";

export function EventDetailPopover({ event, onEdit, onDelete, children }) {
  const [open, setOpen] = useState(false);
  const colors = eventColorMap[event.color];

  function handleEdit() {
    setOpen(false);
    // Defer so the popover fully closes before triggering the dialog
    setTimeout(() => onEdit?.(event), 0);
  }
  function handleDelete() {
    setOpen(false);
    setTimeout(() => onDelete?.(event.id), 0);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent
        className="w-80 p-0"
        align="start"
        sideOffset={4}
        onClick={(e) => e.stopPropagation()}
        onCloseAutoFocus={(e) => e.preventDefault()}
      >
        {/* Color bar */}
        <div className={cn("h-2 rounded-t-md", colors.dot)} />

        <div className="space-y-3 p-4">
          {/* Title */}
          <h4 className="text-base font-semibold leading-tight">{event.title}</h4>

          {/* Date & Time */}
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Calendar className="size-4 shrink-0" />
            <span>{format(event.start, "EEEE, MMMM d, yyyy")}</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Clock className="size-4 shrink-0" />
            <span>{formatEventTime(event)}</span>
          </div>

          {/* Location */}
          {event.location && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <MapPin className="size-4 shrink-0" />
              <span>{event.location}</span>
            </div>
          )}

          {/* Description */}
          {event.description && (
            <p className="text-sm text-muted-foreground">{event.description}</p>
          )}

          {/* Actions */}
          {(onEdit || onDelete) && (
            <>
              <Separator />
              <div className="flex items-center gap-2">
                {onEdit && (
                  <Button variant="outline" size="sm" className="flex-1" onClick={handleEdit}>
                    <Pencil className="mr-1.5 size-3.5" />
                    Edit
                  </Button>
                )}
                {onDelete && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 text-destructive hover:bg-destructive/10 hover:text-destructive"
                    onClick={handleDelete}
                  >
                    <Trash2 className="mr-1.5 size-3.5" />
                    Delete
                  </Button>
                )}
              </div>
            </>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
