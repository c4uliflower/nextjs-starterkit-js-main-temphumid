// Copied from the current temp/humid route pages as an additive scaffold.

export function parseUTC(isoString) {
  if (!isoString) return null;
  if (isoString.includes("Z") || isoString.includes("+")) return new Date(isoString);
  return new Date(isoString.replace(" ", "T") + "+08:00");
}

export function minutesSince(isoString) {
  const date = parseUTC(isoString);
  if (!date) return 0;
  return Math.floor((Date.now() - date.getTime()) / 60000);
}

export function formatRelative(isoString) {
  if (!isoString) return "—";

  const mins = minutesSince(isoString);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;

  const hours = Math.floor(mins / 60);
  const rem = mins % 60;
  return rem > 0 ? `${hours}h ${rem}m ago` : `${hours}h ago`;
}

export function formatAbsolute(isoString) {
  const date = parseUTC(isoString);
  if (!date) return "—";

  return date.toLocaleString("en-PH", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
    timeZone: "Asia/Manila",
  });
}

export function formatTimer(seconds) {
  const abs = Math.abs(Math.round(seconds ?? 0));
  const h = Math.floor(abs / 3600);
  const m = Math.floor((abs % 3600) / 60);
  const s = abs % 60;

  return [h, m, s].map((value) => String(value).padStart(2, "0")).join(":");
}
