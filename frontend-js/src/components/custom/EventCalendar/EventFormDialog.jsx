import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { eventColorMap } from "./types";
import { applyTimeToDate, getTimeFromDate } from "./utils";
import { TimeCombobox } from "./TimeCombobox";
const EVENT_COLORS = [
  { value: "primary", label: "Blue" },
  { value: "info", label: "Cyan" },
  { value: "success", label: "Green" },
  { value: "warning", label: "Yellow" },
  { value: "destructive", label: "Red" },
  { value: "secondary", label: "Gray" },
];
const eventSchema = z
  .object({
    title: z.string().min(1, "Title is required"),
    date: z.date({ error: "Date is required" }),
    startTime: z.string().min(1, "Start time is required"),
    endTime: z.string().min(1, "End time is required"),
    allDay: z.boolean(),
    description: z.string().optional(),
    location: z.string().optional(),
    color: z.string().min(1),
  })
  .refine(
    (data) => {
      if (data.allDay) return true;

      return data.endTime > data.startTime;
    },
    { message: "End time must be after start time", path: ["endTime"] },
  );

export function EventFormDialog({ open, onOpenChange, event, defaultDate, defaultTime, onSubmit }) {
  const isEditing = !!event;
  const form = useForm({
    defaultValues: {
      title: "",
      date: defaultDate ?? new Date(),
      startTime: defaultTime ?? "09:00",
      endTime: defaultTime ? incrementTime(defaultTime) : "10:00",
      allDay: false,
      description: "",
      location: "",
      color: "primary",
    },
  });

  // Reset form when dialog opens with new data
  useEffect(() => {
    if (open) {
      if (event) {
        form.reset({
          title: event.title,
          date: event.start,
          startTime: getTimeFromDate(event.start),
          endTime: getTimeFromDate(event.end),
          allDay: event.allDay ?? false,
          description: event.description ?? "",
          location: event.location ?? "",
          color: event.color,
        });
      } else {
        form.reset({
          title: "",
          date: defaultDate ?? new Date(),
          startTime: defaultTime ?? "09:00",
          endTime: defaultTime ? incrementTime(defaultTime) : "10:00",
          allDay: false,
          description: "",
          location: "",
          color: "primary",
        });
      }
    }
  }, [open, event, defaultDate, defaultTime, form]);
  const allDay = form.watch("allDay");
  const selectedDate = form.watch("date");

  /** When start time changes, ensure end time stays after it. */
  function handleStartTimeChange(newStart) {
    const currentEnd = form.getValues("endTime");

    form.setValue("startTime", newStart);

    if (newStart >= currentEnd) {
      form.setValue("endTime", incrementTime(newStart));
    }
  }
  /** When end time changes, ensure start time stays before it. */
  function handleEndTimeChange(newEnd) {
    const currentStart = form.getValues("startTime");

    form.setValue("endTime", newEnd);

    if (newEnd <= currentStart) {
      form.setValue("startTime", decrementTime(newEnd));
    }
  }
  function handleSubmit(values) {
    form.clearErrors();
    const parsed = eventSchema.safeParse(values);

    if (!parsed.success) {
      const seen = new Set();

      for (const issue of parsed.error.issues) {
        const field = issue.path[0];

        if (typeof field !== "string" || seen.has(field)) continue;
        seen.add(field);
        form.setError(field, {
          type: "manual",
          message: issue.message,
        });
      }

      return;
    }

    const start = parsed.data.allDay
      ? parsed.data.date
      : applyTimeToDate(parsed.data.date, parsed.data.startTime);
    const end = parsed.data.allDay
      ? parsed.data.date
      : applyTimeToDate(parsed.data.date, parsed.data.endTime);

    onSubmit({
      ...(event?.id ? { id: event.id } : {}),
      title: parsed.data.title,
      description: parsed.data.description || undefined,
      start,
      end,
      color: parsed.data.color,
      allDay: parsed.data.allDay,
      location: parsed.data.location || undefined,
    });
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit Event" : "New Event"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input id="title" placeholder="Event title" {...form.register("title")} />
            {form.formState.errors.title && (
              <p className="text-xs text-destructive">{form.formState.errors.title.message}</p>
            )}
          </div>

          {/* Date */}
          <div className="space-y-2">
            <Label>Date</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !selectedDate && "text-muted-foreground",
                  )}
                >
                  <CalendarIcon className="mr-2 size-4" />
                  {selectedDate ? format(selectedDate, "PPP") : "Pick a date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  captionLayout="dropdown"
                  selected={selectedDate}
                  onSelect={(date) => date && form.setValue("date", date)}
                  startMonth={new Date(2020, 0)}
                  endMonth={new Date(2035, 11)}
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* All Day Toggle */}
          <div className="flex items-center gap-2">
            <Switch
              id="allDay"
              checked={allDay}
              onCheckedChange={(checked) => form.setValue("allDay", checked)}
            />
            <Label htmlFor="allDay">All day</Label>
          </div>

          {/* Time Pickers */}
          {!allDay && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Start Time</Label>
                <TimeCombobox value={form.watch("startTime")} onChange={handleStartTimeChange} />
              </div>
              <div className="space-y-2">
                <Label>End Time</Label>
                <TimeCombobox value={form.watch("endTime")} onChange={handleEndTimeChange} />
                {form.formState.errors.endTime && (
                  <p className="text-xs text-destructive">
                    {form.formState.errors.endTime.message}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              placeholder="Add a description..."
              rows={2}
              {...form.register("description")}
            />
          </div>

          {/* Location */}
          <div className="space-y-2">
            <Label htmlFor="location">Location</Label>
            <Input id="location" placeholder="Add a location..." {...form.register("location")} />
          </div>

          {/* Color Picker */}
          <div className="space-y-2">
            <Label>Color</Label>
            <div className="flex items-center gap-2">
              {EVENT_COLORS.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  title={c.label}
                  onClick={() => form.setValue("color", c.value)}
                  className={cn(
                    "size-7 rounded-full transition-all",
                    eventColorMap[c.value].dot,
                    form.watch("color") === c.value
                      ? "ring-2 ring-offset-2 ring-ring"
                      : "opacity-60 hover:opacity-100",
                  )}
                />
              ))}
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit">{isEditing ? "Save Changes" : "Create Event"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Helper: increment a "HH:mm" time string by 1 hour (capped at 23:59). */
function incrementTime(time) {
  const [h, m] = time.split(":").map(Number);

  if (h >= 23) return "23:59";

  return `${String(h + 1).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** Helper: decrement a "HH:mm" time string by 1 hour (floored at 00:00). */
function decrementTime(time) {
  const [h, m] = time.split(":").map(Number);

  if (h <= 0) return "00:00";

  return `${String(h - 1).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}
