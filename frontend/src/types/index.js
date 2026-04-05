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
 * @property {'superadmin'|'admin'|'moderator'|'user'} role
 * @property {'active'|'blocked'|'pending'} status
 * @property {string|null} keycloak_id
 * @property {string|null} tenant_id
 * @property {string|null} tenant_name
 * @property {string|null} tenant_slug
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
 * @property {string|null} external_user_id
 * @property {Object|null} [tracking_signals]
 */

/**
 * @typedef {Object} Device
 * @property {string} id
 * @property {string} fingerprint
 * @property {string|null} display_name
 * @property {string|null} probable_model
 * @property {string|null} probable_vendor
 * @property {string|null} match_key
 * @property {number|null} match_version
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
 * @property {number} visitor_count
 * @property {string} first_seen
 * @property {string} last_seen
 * @property {Object|null} [tracking_signals]
 */

/**
 * @typedef {Object} DeviceGroupChild
 * @property {string} id
 * @property {string} fingerprint
 * @property {string|null} display_name
 * @property {string|null} probable_model
 * @property {string|null} probable_vendor
 * @property {string|null} browser
 * @property {string|null} os
 * @property {number} risk_score
 * @property {'active'|'blocked'} status
 * @property {string|null} linked_user
 * @property {number} visitor_count
 * @property {string} first_seen
 * @property {string} last_seen
 */

/**
 * @typedef {Object} DeviceGroup
 * @property {string} group_id
 * @property {string|null} display_name
 * @property {string|null} probable_model
 * @property {string|null} probable_vendor
 * @property {string|null} match_key
 * @property {'strict'|'probable_mobile'|'exact'} match_strength
 * @property {string} match_label
 * @property {Array<string>} match_evidence
 * @property {number} fingerprint_count
 * @property {number} visitor_count
 * @property {'active'|'blocked'|'mixed'} status
 * @property {'none'|'single'|'mixed'} linked_user_state
 * @property {string|null} linked_user
 * @property {string} first_seen
 * @property {string} last_seen
 * @property {Array<DeviceGroupChild>} devices
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
 * @typedef {Object} UserSession
 * @property {string} id
 * @property {string} ip
 * @property {string} device
 * @property {string|null} created_at
 * @property {string|null} last_active
 */

/**
 * @typedef {Object} AuditLog
 * @property {string} id
 * @property {string|null} actor_id
 * @property {string|null} actor_label
 * @property {string} action
 * @property {string|null} target_type
 * @property {string|null} target_id
 * @property {string|null} ip
 * @property {string} created_at
 * @property {Object<string, *> | null} extra
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
 * @property {Array<{timestamp: string, count: number}>} traffic_heatmap
 * @property {Array<{country: string, flag: string, count: number, percent: number}>} top_countries
 * @property {Array<{reason: string, count: number}>} blocking_chart
 * @property {Array<{id: string, title: string, severity: string, time: string}>} recent_incidents
 * @property {Array<{country: string, flag: string, count: number, percent: number, delta: number, top_reason: string, threat_score: number}>} [threat_hotspots]
 * @property {{totals: {blocked: number, challenged: number, rate_limited: number, observed: number}, summaries: Array<{label: string, value: string}>}|null} [enforcement_pressure]
 * @property {Array<{id: string, title: string, severity: string, status: string, target_type: string, target_label: string, time: string, repeat_count: number, state_tags: Array<string>}>} [priority_investigations]
 * @property {Array<{external_user_id: string, email: string|null, display_name: string|null, current_risk_score: number, trust_level: string, total_devices: number, total_sessions: number, open_flags_count: number, top_flag: string|null, last_seen: string|null, last_country: string|null, enhanced_audit: boolean}>} [risk_leaderboard]
 */

/**
 * @typedef {Object} RealtimeStats
 * @property {number} active_visitors
 * @property {number} blocked_attempts_last_minute
 * @property {number} suspicious_sessions
 */

/**
 * @typedef {Object} PortalUserProfile
 * @property {string} external_user_id
 * @property {string|null} email
 * @property {string|null} display_name
 * @property {number} current_risk_score
 * @property {string} trust_level
 * @property {number} total_devices
 * @property {number} total_sessions
 * @property {string|null} first_seen
 * @property {string|null} last_seen
 * @property {string|null} last_ip
 * @property {string|null} last_country
 * @property {boolean} enhanced_audit
 * @property {number} [open_flags_count]
 * @property {Object|null} [tracking_signals]
 */

/**
 * @typedef {Object} PortalUserDevice
 * @property {string} id
 * @property {string|null} fingerprint_id
 * @property {string} platform
 * @property {Object|null} [tracking_signals]
 * @property {string|null} ip
 * @property {string|null} linked_at
 * @property {string|null} last_seen_at
 */

/**
 * @typedef {Object} PortalUserVisitor
 * @property {string} id
 * @property {string|null} site_id
 * @property {string|null} device_id
 * @property {string} ip
 * @property {string|null} country
 * @property {string|null} country_flag
 * @property {string|null} browser
 * @property {string|null} os
 * @property {number} page_views
 * @property {string} status
 * @property {string|null} first_seen
 * @property {string|null} last_seen
 * @property {Object|null} [tracking_signals]
 */

/**
 * @typedef {Object} PortalUserActivity
 * @property {string} id
 * @property {string} event_type
 * @property {string|null} platform
 * @property {string|null} site_id
 * @property {string|null} fingerprint_id
 * @property {string|null} ip
 * @property {string|null} country
 * @property {string|null} page_url
 * @property {string|null} session_id
 * @property {string|null} created_at
 */

/**
 * @typedef {Object} PortalUserFlag
 * @property {string} id
 * @property {string} flag_type
 * @property {string} severity
 * @property {string} status
 * @property {string|null} related_device_id
 * @property {string|null} evidence
 * @property {string|null} detected_at
 * @property {string|null} resolved_at
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
