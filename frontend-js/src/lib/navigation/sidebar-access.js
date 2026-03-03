/**
 * @typedef {import("@/config/menu").MenuGroup} MenuGroup
 * @typedef {import("@/config/menu").NavItem} NavItem
 * @typedef {(permission?: string | null) => boolean} PermissionChecker
 */

/**
 * @param {string} path
 * @returns {string}
 */
function normalizePath(path) {
  if (!path) return "/";
  const trimmed = path.trim();
  const withLeadingSlash = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;

  if (withLeadingSlash.length > 1 && withLeadingSlash.endsWith("/")) {
    return withLeadingSlash.slice(0, -1);
  }

  return withLeadingSlash;
}

/**
 * @param {string} href
 * @param {string} pathname
 * @returns {boolean}
 */
export function isSidebarRouteMatch(href, pathname) {
  const route = normalizePath(href);
  const current = normalizePath(pathname);

  if (route === "/") {
    return current === "/";
  }

  return current === route || current.startsWith(`${route}/`);
}

/**
 * @param {NavItem[]} items
 * @param {PermissionChecker} hasPermission
 * @returns {NavItem[]}
 */
export function filterSidebarNavItems(items, hasPermission) {
  return items.reduce((visibleItems, item) => {
    const children = item.children
      ? filterSidebarNavItems(item.children, hasPermission)
      : undefined;

    if (item.type === "item") {
      const canViewItem = hasPermission(item.permission);
      const hasVisibleChildren = !!children && children.length > 0;

      if (!canViewItem && !hasVisibleChildren) {
        return visibleItems;
      }
    }

    visibleItems.push({
      ...item,
      children: children && children.length > 0 ? children : undefined,
    });

    return visibleItems;
  }, []);
}

/**
 * @param {MenuGroup[]} groups
 * @param {PermissionChecker} hasPermission
 * @returns {MenuGroup[]}
 */
export function filterSidebarMenuGroups(groups, hasPermission) {
  return groups
    .map((group) => ({
      ...group,
      items: filterSidebarNavItems(group.items, hasPermission),
    }))
    .filter((group) => group.items.length > 0);
}

/**
 * @param {NavItem[]} items
 * @param {string} pathname
 * @returns {boolean}
 */
function hasRouteInItems(items, pathname) {
  for (const item of items) {
    if (item.type !== "item") {
      continue;
    }
    if (item.href && isSidebarRouteMatch(item.href, pathname)) {
      return true;
    }
    if (item.children && hasRouteInItems(item.children, pathname)) {
      return true;
    }
  }

  return false;
}

/**
 * @param {MenuGroup[]} groups
 * @param {string} pathname
 * @param {PermissionChecker} hasPermission
 * @returns {boolean}
 */
export function hasSidebarRouteAccess(groups, pathname, hasPermission) {
  const visibleGroups = filterSidebarMenuGroups(groups, hasPermission);

  return visibleGroups.some((group) => hasRouteInItems(group.items, pathname));
}
