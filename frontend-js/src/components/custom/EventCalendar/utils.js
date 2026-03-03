import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameDay,
  isSameMonth,
  isToday,
  format,
  addMinutes,
  differenceInMinutes,
  startOfDay,
  setHours,
  setMinutes,
} from "date-fns";

/**
 * @typedef {import("./types").CalendarEvent} CalendarEvent
 */
/**
 * Returns a 6×7 grid of dates for a given month (including overflow days).
 * @param {Date} date
 * @returns {Date[][]}
 */
export function getMonthGrid(date) {
  const monthStart = startOfMonth(date);
  const monthEnd = endOfMonth(date);
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 0 });
  const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });
  const allDays = eachDayOfInterval({ start: gridStart, end: gridEnd });
  const weeks = [];

  for (let i = 0; i < allDays.length; i += 7) {
    weeks.push(allDays.slice(i, i + 7));
  }
  // Ensure exactly 6 weeks for consistent grid height
  while (weeks.length < 6) {
    const lastDay = weeks[weeks.length - 1][6];
    const nextWeekStart = addMinutes(lastDay, 24 * 60);
    const nextWeek = eachDayOfInterval({
      start: startOfWeek(nextWeekStart, { weekStartsOn: 0 }),
      end: endOfWeek(nextWeekStart, { weekStartsOn: 0 }),
    });

    weeks.push(nextWeek);
  }

  return weeks;
}

/**
 * Returns the 7 dates of the week containing the given date.
 * @param {Date} date
 * @returns {Date[]}
 */
export function getWeekDays(date) {
  const weekStart = startOfWeek(date, { weekStartsOn: 0 });
  const weekEnd = endOfWeek(date, { weekStartsOn: 0 });

  return eachDayOfInterval({ start: weekStart, end: weekEnd });
}

/**
 * Returns an array of 24 hour labels.
 * @returns {string[]}
 */
export function getHoursArray() {
  const hours = [];

  for (let i = 0; i < 24; i++) {
    const d = setMinutes(setHours(new Date(), i), 0);

    hours.push(format(d, "h a"));
  }

  return hours;
}

/**
 * Filters events that occur on a specific date.
 * @param {CalendarEvent[]} events
 * @param {Date} date
 * @returns {CalendarEvent[]}
 */
export function getEventsForDate(events, date) {
  return events
    .filter((e) => isSameDay(e.start, date))
    .sort((a, b) => {
      // All-day events first, then by start time
      if (a.allDay && !b.allDay) return -1;
      if (!a.allDay && b.allDay) return 1;

      return a.start.getTime() - b.start.getTime();
    });
}

/**
 * Checks if a date is in the current displayed month.
 */
export { isSameMonth, isSameDay, isToday };

/**
 * Format an event's time range.
 * @param {CalendarEvent} event
 * @returns {string}
 */
export function formatEventTime(event) {
  if (event.allDay) return "All day";

  return `${format(event.start, "h:mm a")} – ${format(event.end, "h:mm a")}`;
}

/** Pixels per hour in the time-grid views. */
export const HOUR_HEIGHT = 72;

/**
 * Calculates the top offset and height (px) for a time-grid event.
 * @param {CalendarEvent} event
 * @returns {{ top: number; height: number }}
 */
export function calculateEventPosition(event) {
  const dayStart = startOfDay(event.start);
  const minutesFromMidnight = differenceInMinutes(event.start, dayStart);
  const durationMinutes = differenceInMinutes(event.end, event.start);
  const top = (minutesFromMidnight / 60) * HOUR_HEIGHT;
  const height = Math.max((durationMinutes / 60) * HOUR_HEIGHT, 32);

  return { top, height };
}

/**
 * Generate 15-minute time options for select dropdowns.
 * @returns {{ label: string; value: string }[]}
 */
export function getTimeOptions() {
  const options = [];

  for (let h = 0; h < 24; h++) {
    for (let m = 0; m < 60; m += 15) {
      const d = setMinutes(setHours(new Date(), h), m);
      const label = format(d, "h:mm a");
      const value = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;

      options.push({ label, value });
    }
  }

  return options;
}

/**
 * Parses a "HH:mm" string and applies it to a Date.
 * @param {Date} date
 * @param {string} time
 * @returns {Date}
 */
export function applyTimeToDate(date, time) {
  const [h, m] = time.split(":").map(Number);

  return setMinutes(setHours(startOfDay(date), h), m);
}

/**
 * Extracts "HH:mm" string from a Date.
 * @param {Date} date
 * @returns {string}
 */
export function getTimeFromDate(date) {
  return format(date, "HH:mm");
}

/**
 * Resolves overlap columns for events on a single day (time-grid).
 * Returns events annotated with column index and total columns.
 * @param {CalendarEvent[]} events
 * @returns {(CalendarEvent & { col: number; totalCols: number })[]}
 */
export function resolveOverlaps(events) {
  if (events.length === 0) return [];
  const sorted = [...events].sort((a, b) => a.start.getTime() - b.start.getTime());
  const columns = [];

  for (const event of sorted) {
    let placed = false;

    for (let i = 0; i < columns.length; i++) {
      const lastInCol = columns[i][columns[i].length - 1];

      if (lastInCol.end.getTime() <= event.start.getTime()) {
        columns[i].push(event);
        placed = true;
        break;
      }
    }
    if (!placed) {
      columns.push([event]);
    }
  }

  const totalCols = columns.length;
  const result = [];

  columns.forEach((col, colIndex) => {
    for (const event of col) {
      result.push({ ...event, col: colIndex, totalCols });
    }
  });

  return result;
}
