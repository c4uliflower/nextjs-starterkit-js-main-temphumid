/**
 * @typedef {import("@/types/user").User} User
 * @typedef {import("@/config/menu").MenuGroup} MenuGroup
 */

/**
 * @typedef {Object} AuthRole
 * @property {number} id
 * @property {string} key
 * @property {string} name
 * @property {string | null | undefined} [description]
 */

/**
 * @typedef {Object} AuthPayload
 * @property {User} profile
 * @property {AuthRole[]} roles
 * @property {string[]} permissions
 * @property {MenuGroup[]} sidebar
 */

/**
 * @typedef {Object} AuthUser
 * @property {AuthPayload} data
 * @property {string} accessToken
 */

/**
 * @typedef {AuthUser | null} UserType
 */

/**
 * @typedef {Object} AuthState
 * @property {UserType} user
 * @property {boolean} loading
 */

/**
 * @typedef {Object} AuthContextValue
 * @property {UserType} user
 * @property {boolean} loading
 * @property {boolean} authenticated
 * @property {boolean} unauthenticated
 * @property {string[]} permissions
 * @property {(permission?: string | null) => boolean} hasPermission
 * @property {(() => Promise<boolean>) | undefined} [checkUserSession]
 * @property {() => Promise<void>} logout
 */

export {};
