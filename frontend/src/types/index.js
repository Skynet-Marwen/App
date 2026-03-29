/**
 * @fileoverview JSDoc type definitions for SkyNet frontend.
 * Import these in components/hooks/services using JSDoc @param/@returns annotations.
 * These are compile-time documentation only — no runtime cost.
 */

/**
 * @typedef {Object} User
 * @property {string} id
 * @property {string} email
 * @property {string} username
 * @property {'admin'|'moderator'|'user'} role
 * @property {'active'|'blocked'|'pending'} status
 * @property {string|null} keycloak_id
 * @property {string|null} last_login
 * @property {string} created_at
 * @property {number} devices_count
 */

/**
 * @typedef {Object} Visitor
 * @property {string} id
 * @property {string} ip
 * @property {string|null} country
 * @property {string} country_flag
 * @property {string|null} city
 * @property {string|null} isp
 * @property {string|null} device_type
 * @property {string|null} browser
 * @property {string|null} os
 * @property {string|null} user_agent
 * @property {'active'|'blocked'|'suspicious'} status
 * @property {number} page_views
 * @property {string} first_seen
 * @property {string} last_seen
 * @property {string|null} linked_user
 */

/**
 * @typedef {Object} Device
 * @property {string} id
 * @property {string} fingerprint
 * @property {string|null} type
 * @property {string|null} browser
 * @property {string|null} os
 * @property {string|null} screen_resolution
 * @property {string|null} language
 * @property {string|null} timezone
 * @property {string|null} canvas_hash
 * @property {string|null} webgl_hash
 * @property {number} risk_score
 * @property {'active'|'blocked'} status
 * @property {string|null} linked_user
 * @property {string} first_seen
 * @property {string} last_seen
 */

/**
 * @typedef {Object} BlockingRule
 * @property {string} id
 * @property {'ip'|'country'|'device'|'user_agent'|'asn'} type
 * @property {string} value
 * @property {string|null} reason
 * @property {'block'|'challenge'|'rate_limit'} action
 * @property {number} hits
 * @property {string} created_at
 */

/**
 * @typedef {Object} BlockedIP
 * @property {string} ip
 * @property {string|null} country
 * @property {string|null} country_flag
 * @property {string|null} reason
 * @property {number} hits
 * @property {string} blocked_at
 */

/**
 * @typedef {Object} Incident
 * @property {string} id
 * @property {string} type
 * @property {string|null} description
 * @property {string|null} ip
 * @property {'low'|'medium'|'high'|'critical'} severity
 * @property {'open'|'resolved'} status
 * @property {string} detected_at
 */

/**
 * @typedef {Object} Site
 * @property {string} id
 * @property {string} name
 * @property {string} url
 * @property {string|null} description
 * @property {string} api_key
 * @property {boolean} active
 * @property {{ visitors: number, events: number, blocked: number }} stats
 * @property {string} created_at
 */

/**
 * @typedef {Object} OverviewStats
 * @property {number} total_visitors
 * @property {number} unique_users
 * @property {number} total_devices
 * @property {number} total_blocked
 * @property {number} evasion_attempts
 * @property {number} spam_detected
 * @property {number|null} visitors_change
 * @property {number|null} users_change
 * @property {number|null} blocked_change
 * @property {Array<{time: string, visitors: number, blocked: number}>} traffic_chart
 * @property {Array<{country: string, flag: string, percent: number}>} top_countries
 * @property {Array<{reason: string, count: number}>} blocking_chart
 * @property {Array<{id: string, title: string, severity: string, time: string}>} recent_incidents
 */

/**
 * @typedef {Object} RealtimeStats
 * @property {number} active_visitors
 * @property {number} blocked_attempts_last_minute
 * @property {number} suspicious_sessions
 */

/**
 * @typedef {Object} PaginatedResponse
 * @property {number} total
 * @property {Array<*>} items
 */

/**
 * @typedef {Object} AuthState
 * @property {User|null} user
 * @property {string|null} token
 * @property {boolean} isAuthenticated
 */

/**
 * @typedef {Object} Notification
 * @property {number} id
 * @property {string} title
 * @property {string} message
 * @property {'info'|'warning'|'danger'|'success'} type
 * @property {boolean} [read]
 */

export {}
