import { minutesSince } from "@/utils/time";

// Copied from the current temp/humid facilities route page as an additive scaffold.

export const ACTION_OPTIONS = [
  { value: "adjust_temp", label: "Adjust temperature" },
  { value: "adjust_humid", label: "Adjust humidity" },
  { value: "others", label: "Others" },
];

export const ACTION_LABELS = {
  adjust_temp: "Adjust temperature",
  adjust_humid: "Adjust humidity",
  maintenance: "Scheduled for maintenance",
  repair: "Queued for repair",
  others: "Others",
};

export const ESCALATION_THRESHOLD_MINS = 30;
export const NO_READING_WARN_MINS = 45;

export const ACTIVE_COLUMNS = [
  { key: "acknowledged", label: "Acknowledged", accent: "#dc2626", dot: "#dc2626" },
  { key: "open", label: "Open", accent: "#f59e0b", dot: "#f59e0b" },
];

export const FACILITIES_STYLES = `
  @keyframes dotPulse { 0%,100%{opacity:1} 50%{opacity:.25} }
  @keyframes slideDown {
    from { opacity: 0; transform: translateY(-6px); }
    to { opacity: 1; transform: translateY(0); }
  }
`;

export function getFacilitiesEscalatedCount(alerts) {
  return alerts.filter(
    (alert) =>
      !(alert.actionType === "maintenance" || alert.actionType === "repair") &&
      alert.status !== "resolved" &&
      minutesSince(alert.acknowledgedAt) >= ESCALATION_THRESHOLD_MINS
  ).length;
}

export function getFacilitiesActionLabel(alert) {
  return ACTION_LABELS[alert.actionType] ?? alert.actionType ?? null;
}

export function getFacilitiesAlertState(alert) {
  const isAcknowledged = alert.status === "acknowledged";
  const isOpen = alert.status === "open";
  const isVerifying = alert.status === "verifying";
  const isScheduled = alert.actionType === "maintenance" || alert.actionType === "repair";
  const isMaintenanceOngoing = !!alert.maintenanceOngoing;
  const workTypeLabel = alert.actionType === "repair" ? "Repair" : "Maintenance";
  const minutesDelayed = minutesSince(alert.acknowledgedAt);
  const isEscalated =
    alert.status !== "resolved" && !isScheduled && minutesDelayed >= ESCALATION_THRESHOLD_MINS;
  const backendCount = Number(alert.escalationCount || 0);
  const frontendCount = Math.floor(minutesDelayed / ESCALATION_THRESHOLD_MINS);
  const escalationCount = Math.max(backendCount, frontendCount);
  const delayedHours = escalationCount * (ESCALATION_THRESHOLD_MINS / 60);
  const delayedLabel = isEscalated ? `Delayed for ${delayedHours} hours` : "";
  const maintenanceDelayMinutes =
    isOpen && isScheduled && !alert.verifiedAt && alert.maintenanceQueuedAt
      ? minutesSince(alert.maintenanceQueuedAt)
      : 0;
  const hasWorkTimer = isOpen && isScheduled && !alert.verifiedAt && !!alert.maintenanceQueuedAt;
  const maintenanceDelayCount = Math.floor(maintenanceDelayMinutes / ESCALATION_THRESHOLD_MINS);
  const isMaintenanceDelayed = hasWorkTimer && maintenanceDelayCount >= 1;
  const maintenanceDelayedHours = maintenanceDelayCount * (ESCALATION_THRESHOLD_MINS / 60);
  const maintenanceElapsedHours =
    Math.floor(Math.max(maintenanceDelayMinutes, 0) / ESCALATION_THRESHOLD_MINS) *
    (ESCALATION_THRESHOLD_MINS / 60);
  const maintenanceElapsedLabel = ` In ${workTypeLabel} for ${maintenanceElapsedHours}h`;
  const maintenanceDelayedLabel = isMaintenanceDelayed
    ? `${workTypeLabel} delayed for ${maintenanceDelayedHours} hours`
    : "";

  return {
    delayedLabel,
    escalationCount,
    hasWorkTimer,
    isAcknowledged,
    isEscalated,
    isMaintenanceDelayed,
    isMaintenanceOngoing,
    isOpen,
    isScheduled,
    isVerifying,
    maintenanceElapsedLabel,
    maintenanceDelayedLabel,
    maintenanceDelayMinutes,
    minutesDelayed,
  };
}

export function getFacilitiesVerifyState(alert) {
  const minsWaiting = minutesSince(alert.verifiedAt);
  return {
    isStale: minsWaiting >= NO_READING_WARN_MINS,
    minsWaiting,
  };
}

export function formatFacilitiesReadingSummary(alert, digits = 1) {
  const temperature =
    alert.temperature != null ? `${alert.temperature.toFixed(digits)}\u00B0C` : "\u2014";
  const humidity =
    alert.humidity != null ? `${alert.humidity.toFixed(digits)}%` : "\u2014";

  return `${temperature} \u00B7 ${humidity}`;
}

export function buildFacilitiesStats({
  acknowledgedCount,
  escalatedCount,
  openCount,
  resolvedCount,
}) {
  return {
    acknowledgedCount,
    escalatedCount,
    openCount,
    resolvedCount,
  };
}
