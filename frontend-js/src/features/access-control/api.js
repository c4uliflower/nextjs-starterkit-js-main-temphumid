import axios from "@/lib/axios";

/**
 * @typedef {import("./types").AccessControlManagedMenuPayload} AccessControlManagedMenuPayload
 * @typedef {import("./types").AccessControlManagedMenuRecord} AccessControlManagedMenuRecord
 * @typedef {import("./types").AccessControlMenuLinkPayload} AccessControlMenuLinkPayload
 * @typedef {import("./types").AccessControlMenuManagementSummary} AccessControlMenuManagementSummary
 * @typedef {import("./types").PaginationState} PaginationState
 * @typedef {import("./types").AccessControlMenuOption} AccessControlMenuOption
 * @typedef {import("./types").AccessControlRoleOption} AccessControlRoleOption
 * @typedef {import("./types").AccessControlRolePayload} AccessControlRolePayload
 * @typedef {import("./types").AccessControlRoleRecord} AccessControlRoleRecord
 * @typedef {import("./types").AccessControlRuleField} AccessControlRuleField
 * @typedef {import("./types").AccessControlRuleFieldValues} AccessControlRuleFieldValues
 * @typedef {import("./types").AccessControlRulePayload} AccessControlRulePayload
 * @typedef {import("./types").AccessControlRuleRecord} AccessControlRuleRecord
 * @typedef {import("./types").AccessControlUserRecord} AccessControlUserRecord
 * @typedef {import("./types").AccessControlUserRole} AccessControlUserRole
 */

/**
 * @typedef {Object} RoleManagementData
 * @property {AccessControlRoleRecord[]} roles
 * @property {AccessControlMenuOption[]} menus
 */

/**
 * @typedef {Object} RuleManagementData
 * @property {AccessControlRuleField[]} fields
 * @property {AccessControlRuleFieldValues} field_values
 * @property {AccessControlRoleOption[]} roles
 * @property {AccessControlRuleRecord[]} rules
 */

/**
 * @typedef {Object} UserAccessData
 * @property {AccessControlUserRecord[]} items
 * @property {AccessControlRoleOption[]} roles
 * @property {AccessControlMenuOption[]} menus
 * @property {PaginationState} pagination
 */

/**
 * @typedef {Object} MenuManagementData
 * @property {AccessControlManagedMenuRecord[]} menus
 * @property {AccessControlMenuOption[]} parent_options
 * @property {AccessControlMenuManagementSummary} summary
 */

/**
 * @typedef {Object} RoleMutationData
 * @property {number} id
 * @property {string} name
 * @property {string} key
 * @property {string | null} description
 * @property {boolean} is_default
 * @property {boolean} is_active
 */

/** @returns {Promise<RoleManagementData>} */
export async function fetchRoleManagementData() {
  const response = await axios.get("/api/access-control/roles");

  return response.data.data;
}

/** @returns {Promise<MenuManagementData>} */
export async function fetchMenuManagementData() {
  const response = await axios.get("/api/access-control/menus");

  return response.data.data;
}

/**
 * @param {AccessControlManagedMenuPayload} payload
 * @returns {Promise<AccessControlManagedMenuRecord>}
 */
export async function createMenu(payload) {
  const response = await axios.post("/api/access-control/menus", payload);

  return response.data.data;
}

/**
 * @param {number} menuId
 * @param {AccessControlManagedMenuPayload} payload
 * @returns {Promise<AccessControlManagedMenuRecord>}
 */
export async function updateMenu(menuId, payload) {
  const response = await axios.put(`/api/access-control/menus/${menuId}`, payload);

  return response.data.data;
}

/**
 * @param {number} menuId
 * @param {AccessControlMenuLinkPayload} payload
 * @returns {Promise<{ id: number; parent_id: number | null; display_order: number }>}
 */
export async function linkMenu(menuId, payload) {
  const response = await axios.put(`/api/access-control/menus/${menuId}/link`, payload);

  return response.data.data;
}

/** @param {number} menuId */
export async function deleteMenu(menuId) {
  await axios.delete(`/api/access-control/menus/${menuId}`);
}

/**
 * @param {AccessControlRolePayload} payload
 * @returns {Promise<RoleMutationData>}
 */
export async function createRole(payload) {
  const response = await axios.post("/api/access-control/roles", payload);

  return response.data.data;
}

/**
 * @param {number} roleId
 * @param {AccessControlRolePayload} payload
 * @returns {Promise<RoleMutationData>}
 */
export async function updateRole(roleId, payload) {
  const response = await axios.put(`/api/access-control/roles/${roleId}`, payload);

  return response.data.data;
}

/** @param {number} roleId */
export async function deleteRole(roleId) {
  await axios.delete(`/api/access-control/roles/${roleId}`);
}

/**
 * @param {number} roleId
 * @param {number[]} menuIds
 * @returns {Promise<void>}
 */
export async function syncRoleMenus(roleId, menuIds) {
  await axios.put(`/api/access-control/roles/${roleId}/menus`, {
    menu_ids: menuIds,
  });
}

/** @returns {Promise<RuleManagementData>} */
export async function fetchRuleManagementData() {
  const response = await axios.get("/api/access-control/rules");

  return response.data.data;
}

/**
 * @param {AccessControlRulePayload} payload
 * @returns {Promise<AccessControlRuleRecord>}
 */
export async function createRule(payload) {
  const response = await axios.post("/api/access-control/rules", payload);

  return response.data.data;
}

/**
 * @param {number} ruleId
 * @param {AccessControlRulePayload} payload
 * @returns {Promise<AccessControlRuleRecord>}
 */
export async function updateRule(ruleId, payload) {
  const response = await axios.put(`/api/access-control/rules/${ruleId}`, payload);

  return response.data.data;
}

/** @param {number} ruleId */
export async function deleteRule(ruleId) {
  await axios.delete(`/api/access-control/rules/${ruleId}`);
}

/**
 * @param {string} search
 * @param {number} page
 * @param {number} perPage
 * @returns {Promise<UserAccessData>}
 */
export async function fetchUserAccessData(search, page, perPage) {
  const response = await axios.get("/api/access-control/users", {
    params: {
      search,
      page,
      per_page: perPage,
    },
  });

  return response.data.data;
}

/**
 * @param {string} employeeNo
 * @param {number[]} roleIds
 * @returns {Promise<{ assigned_roles: AccessControlUserRole[]; effective_roles: AccessControlUserRole[] }>}
 */
export async function syncUserRoles(employeeNo, roleIds) {
  const response = await axios.put(`/api/access-control/users/${employeeNo}/roles`, {
    role_ids: roleIds,
  });

  return response.data.data;
}

/**
 * @param {string} employeeNo
 * @param {number[]} menuIds
 * @returns {Promise<{ override_count: number; override_menu_ids: number[] }>}
 */
export async function syncUserOverrides(employeeNo, menuIds) {
  const response = await axios.put(`/api/access-control/users/${employeeNo}/overrides`, {
    menu_ids: menuIds,
  });

  return response.data.data;
}
