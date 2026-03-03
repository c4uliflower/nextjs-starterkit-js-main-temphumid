import { icons } from "lucide-react";

/**
 * @typedef {import("react").ComponentType<{ className?: string }>} IconComponent
 */
/**
 * Resolves a NavItem icon value to a renderable component.
 * - If it's already a component, returns it as-is.
 * - If it's a string (icon name from the backend), looks it up in the lucide-react icon map.
 * - Returns undefined if not found.
 * @param {IconComponent | string | undefined} icon
 * @returns {IconComponent | undefined}
 */
export function resolveIcon(icon) {
  if (!icon) return undefined;
  if (typeof icon !== "string") return icon;

  return /** @type {Record<string, IconComponent>} */ (icons)[icon];
}
