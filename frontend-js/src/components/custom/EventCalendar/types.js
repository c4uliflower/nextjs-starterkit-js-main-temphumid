/**
 * @typedef {"primary" | "secondary" | "success" | "warning" | "info" | "destructive"} EventColor
 */

/**
 * @typedef {"year" | "month" | "week" | "day"} CalendarView
 */

/**
 * @typedef {Object} CalendarEvent
 * @property {string} id
 * @property {string} title
 * @property {string | undefined} [description]
 * @property {Date} start
 * @property {Date} end
 * @property {EventColor} color
 * @property {boolean | undefined} [allDay]
 * @property {string | undefined} [location]
 */

/** @type {Record<EventColor, { bg: string; text: string; border: string; dot: string }>} */
export const eventColorMap = {
  primary: {
    bg: "bg-primary/15",
    text: "text-primary",
    border: "border-primary",
    dot: "bg-primary",
  },
  secondary: {
    bg: "bg-secondary/15",
    text: "text-secondary",
    border: "border-secondary",
    dot: "bg-secondary",
  },
  success: {
    bg: "bg-success/15",
    text: "text-success",
    border: "border-success",
    dot: "bg-success",
  },
  warning: {
    bg: "bg-warning/15",
    text: "text-warning",
    border: "border-warning",
    dot: "bg-warning",
  },
  info: {
    bg: "bg-info/15",
    text: "text-info",
    border: "border-info",
    dot: "bg-info",
  },
  destructive: {
    bg: "bg-destructive/15",
    text: "text-destructive",
    border: "border-destructive",
    dot: "bg-destructive",
  },
};
