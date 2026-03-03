/**
 * @typedef {Object} AccessControlMenuOption
 * @property {number} id
 * @property {number | null} parent_id
 * @property {string} type
 * @property {string} title
 * @property {string | null} path
 * @property {string | null} permission_key
 * @property {string | null} icon
 * @property {string} label
 */

/**
 * @typedef {"group" | "header" | "item"} AccessControlManagedMenuType
 */

/**
 * @typedef {Object} AccessControlManagedMenuRecord
 * @property {number} id
 * @property {number | null} parent_id
 * @property {AccessControlManagedMenuType} type
 * @property {string} title
 * @property {string | null} icon
 * @property {string | null} path
 * @property {string | null} permission_key
 * @property {number} display_order
 * @property {boolean} is_active
 * @property {string} label
 * @property {number} children_count
 * @property {number} descendant_count
 * @property {number} role_links_count
 * @property {number} user_overrides_count
 */

/**
 * @typedef {Object} AccessControlManagedMenuPayload
 * @property {number | null} parent_id
 * @property {AccessControlManagedMenuType} type
 * @property {string} title
 * @property {string | null} icon
 * @property {string | null} path
 * @property {string | null} permission_key
 * @property {number} display_order
 * @property {boolean} is_active
 */

/**
 * @typedef {Object} AccessControlMenuLinkPayload
 * @property {number | null} parent_id
 * @property {number} display_order
 */

/**
 * @typedef {Object} AccessControlMenuManagementSummary
 * @property {number} total
 * @property {number} active
 * @property {number} linked
 * @property {number} actionable
 */

/**
 * @typedef {Object} AccessControlRoleOption
 * @property {number} id
 * @property {string} name
 * @property {string} key
 * @property {boolean | undefined} [is_default]
 */

/**
 * @typedef {Object} AccessControlRoleRecord
 * @property {number} id
 * @property {string} name
 * @property {string} key
 * @property {string | null} description
 * @property {boolean} is_default
 * @property {boolean} is_active
 * @property {number} users_count
 * @property {number[]} menu_ids
 */

/**
 * @typedef {Object} AccessControlRolePayload
 * @property {string} name
 * @property {string} key
 * @property {string | null} description
 * @property {boolean} is_default
 * @property {boolean} is_active
 */

/**
 * @typedef {"DEPARTMENT" | "SECTION" | "POSITION" | "DIVISION"} AccessControlRuleField
 */

/**
 * @typedef {"AND" | "OR"} AccessControlRuleConditionOperator
 */

/**
 * @typedef {Object} AccessControlRuleCondition
 * @property {number | undefined} [id]
 * @property {AccessControlRuleField} match_field
 * @property {string} match_value
 * @property {number} sort_order
 * @property {AccessControlRuleConditionOperator} condition_operator
 */

/**
 * @typedef {Partial<Record<AccessControlRuleField, string[]>>} AccessControlRuleFieldValues
 */

/**
 * @typedef {Object} AccessControlRuleGroup
 * @property {number | undefined} [id]
 * @property {number} sort_order
 * @property {AccessControlRuleCondition[]} conditions
 */

/**
 * @typedef {Object} AccessControlRuleRecord
 * @property {number} id
 * @property {number} role_id
 * @property {string | null} role_key
 * @property {string | null} role_name
 * @property {number} priority
 * @property {AccessControlRuleGroup[]} groups
 */

/**
 * @typedef {Object} AccessControlRulePayload
 * @property {number} role_id
 * @property {number} priority
 * @property {AccessControlRuleGroup[]} groups
 */

/**
 * @typedef {Object} AccessControlUserRole
 * @property {number} id
 * @property {string} key
 * @property {string} name
 * @property {string | null} description
 */

/**
 * @typedef {Object} AccessControlUserRecord
 * @property {string} employee_no
 * @property {string} first_name
 * @property {string} last_name
 * @property {string} full_name
 * @property {string} department
 * @property {string} section
 * @property {string} position
 * @property {string | null} unit
 * @property {AccessControlUserRole[]} assigned_roles
 * @property {AccessControlUserRole[]} effective_roles
 * @property {number} override_count
 * @property {number[]} override_menu_ids
 */

/**
 * @typedef {Object} PaginationState
 * @property {number} current_page
 * @property {number} last_page
 * @property {number} per_page
 * @property {number} total
 */

export {};
