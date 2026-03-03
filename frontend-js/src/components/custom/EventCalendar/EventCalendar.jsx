import { useState, useCallback } from "react";
import { cn } from "@/lib/utils";
import { EventCalendarHeader } from "./EventCalendarHeader";
import { EventCalendarSidebar } from "./EventCalendarSidebar";
import { YearView } from "./YearView";
import { MonthView } from "./MonthView";
import { WeekView } from "./WeekView";
import { DayView } from "./DayView";
import { EventFormDialog } from "./EventFormDialog";

export function EventCalendar({
  events,
  onEventCreate,
  onEventUpdate,
  onEventDelete,
  defaultView = "month",
  defaultDate,
  showSidebar = true,
  className,
}) {
  const [currentDate, setCurrentDate] = useState(defaultDate ?? new Date());
  const [view, setView] = useState(defaultView);
  const [sidebarOpen, setSidebarOpen] = useState(showSidebar);
  // Form dialog state
  const [formOpen, setFormOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);
  const [formDefaultDate, setFormDefaultDate] = useState();
  const [formDefaultTime, setFormDefaultTime] = useState();
  const openCreateDialog = useCallback((date, time) => {
    setEditingEvent(null);
    setFormDefaultDate(date);
    setFormDefaultTime(time);
    setFormOpen(true);
  }, []);
  const openEditDialog = useCallback((event) => {
    setEditingEvent(event);
    setFormDefaultDate(undefined);
    setFormDefaultTime(undefined);
    setFormOpen(true);
  }, []);

  function handleFormSubmit(data) {
    if (data.id) {
      onEventUpdate?.({ ...data, id: data.id });
    } else {
      onEventCreate?.(data);
    }
  }
  function handleDateClick(date) {
    openCreateDialog(date);
  }
  function handleSlotClick(date, time) {
    openCreateDialog(date, time);
  }
  function handleSidebarDateSelect(date) {
    setCurrentDate(date);
  }
  function handleDelete(eventId) {
    onEventDelete?.(eventId);
  }

  return (
    <div
      className={cn("flex h-full flex-col overflow-hidden rounded-lg border bg-card", className)}
    >
      {/* Header */}
      <EventCalendarHeader
        currentDate={currentDate}
        view={view}
        sidebarOpen={sidebarOpen}
        onDateChange={setCurrentDate}
        onViewChange={setView}
        onToggleSidebar={() => setSidebarOpen((p) => !p)}
      />

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        {sidebarOpen && (
          <div className="hidden md:flex">
            <EventCalendarSidebar
              currentDate={currentDate}
              events={events}
              onDateSelect={handleSidebarDateSelect}
              onAddEvent={() => openCreateDialog()}
            />
          </div>
        )}

        {/* Main view */}
        {view === "year" && (
          <YearView
            currentDate={currentDate}
            events={events}
            onMonthClick={(date) => {
              setCurrentDate(date);
              setView("month");
            }}
          />
        )}
        {view === "month" && (
          <MonthView
            currentDate={currentDate}
            events={events}
            onDateClick={handleDateClick}
            onEventEdit={openEditDialog}
            onEventDelete={handleDelete}
          />
        )}
        {view === "week" && (
          <WeekView
            currentDate={currentDate}
            events={events}
            onSlotClick={handleSlotClick}
            onEventEdit={openEditDialog}
            onEventDelete={handleDelete}
          />
        )}
        {view === "day" && (
          <DayView
            currentDate={currentDate}
            events={events}
            onSlotClick={handleSlotClick}
            onEventEdit={openEditDialog}
            onEventDelete={handleDelete}
          />
        )}
      </div>

      {/* Event form dialog */}
      <EventFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        event={editingEvent}
        defaultDate={formDefaultDate}
        defaultTime={formDefaultTime}
        onSubmit={handleFormSubmit}
      />
    </div>
  );
}
