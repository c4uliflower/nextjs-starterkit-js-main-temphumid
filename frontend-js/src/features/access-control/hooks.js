import useSWR from "swr";
import {
  fetchMenuManagementData,
  fetchRoleManagementData,
  fetchRuleManagementData,
  fetchUserAccessData,
} from "@/features/access-control/api";

/**
 * @typedef {import("./types").AccessControlRoleRecord} AccessControlRoleRecord
 * @typedef {import("./types").AccessControlMenuOption} AccessControlMenuOption
 * @typedef {import("./types").AccessControlManagedMenuRecord} AccessControlManagedMenuRecord
 * @typedef {import("./types").AccessControlMenuManagementSummary} AccessControlMenuManagementSummary
 * @typedef {import("./types").AccessControlRuleField} AccessControlRuleField
 * @typedef {import("./types").AccessControlRuleFieldValues} AccessControlRuleFieldValues
 * @typedef {import("./types").AccessControlRoleOption} AccessControlRoleOption
 * @typedef {import("./types").AccessControlRuleRecord} AccessControlRuleRecord
 * @typedef {import("./types").AccessControlUserRecord} AccessControlUserRecord
 * @typedef {import("./types").PaginationState} PaginationState
 */

/**
 * @typedef {{ roles: AccessControlRoleRecord[]; menus: AccessControlMenuOption[] }} RoleManagementData
 * @typedef {{ menus: AccessControlManagedMenuRecord[]; parent_options: AccessControlMenuOption[]; summary: AccessControlMenuManagementSummary }} MenuManagementData
 * @typedef {{ fields: AccessControlRuleField[]; field_values: AccessControlRuleFieldValues; roles: AccessControlRoleOption[]; rules: AccessControlRuleRecord[] }} RuleManagementData
 * @typedef {{ items: AccessControlUserRecord[]; roles: AccessControlRoleOption[]; menus: AccessControlMenuOption[]; pagination: PaginationState }} UserAccessData
 */

/**
 * @param {boolean} enabled
 * @returns {import("swr").SWRResponse<MenuManagementData, unknown>}
 */
export function useMenus(enabled) {
  return useSWR(enabled ? "/api/access-control/menus" : null, fetchMenuManagementData);
}

/**
 * @param {boolean} enabled
 * @returns {import("swr").SWRResponse<RoleManagementData, unknown>}
 */
export function useRoles(enabled) {
  return useSWR(enabled ? "/api/access-control/roles" : null, fetchRoleManagementData);
}

/**
 * @param {boolean} enabled
 * @returns {import("swr").SWRResponse<RuleManagementData, unknown>}
 */
export function useRules(enabled) {
  return useSWR(enabled ? "/api/access-control/rules" : null, fetchRuleManagementData);
}

/**
 * @param {string} search
 * @param {number} page
 * @param {number} perPage
 * @param {boolean} enabled
 * @returns {import("swr").SWRResponse<UserAccessData, unknown>}
 */
export function useUsers(search, page, perPage, enabled) {
  return useSWR(
    enabled ? ["/api/access-control/users", search, page, perPage] : null,
    ([, s, p, pp]) => fetchUserAccessData(s, p, pp),
    { keepPreviousData: true },
  );
}
