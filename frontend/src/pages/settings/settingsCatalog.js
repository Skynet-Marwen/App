export const SETTINGS_SECTIONS = [
  {
    key: 'security-detection',
    title: 'Security & Detection',
    description: 'Risk engine, automation signals, network intelligence, and device identity tuning.',
    icon: 'shield',
    capabilities: [
      { label: 'Risk Engine', status: 'live' },
      { label: 'Bot & Automation Detection', status: 'live' },
      { label: 'Network Intelligence', status: 'live' },
      { label: 'Threat Intelligence', status: 'live' },
      { label: 'Device Identity', status: 'live' },
    ],
  },
  {
    key: 'access-network',
    title: 'Access & Network',
    description: 'HTTPS posture, routing, trusted domains, IP controls, and rate enforcement.',
    icon: 'network',
    capabilities: [
      { label: 'HTTPS & TLS', status: 'live' },
      { label: 'Domains & Routing', status: 'live' },
      { label: 'IP Control', status: 'live' },
      { label: 'Rate Limiting', status: 'live' },
    ],
  },
  {
    key: 'authentication-identity',
    title: 'Authentication & Identity',
    description: 'Operator auth, session policy, SaaS user systems, and external identity providers.',
    icon: 'lock',
    capabilities: [
      { label: 'Admin Access', status: 'live' },
      { label: 'Session Policy', status: 'live' },
      { label: 'SSO / External Auth', status: 'live' },
      { label: 'Superadmin Tier', status: 'live' },
      { label: 'Tenant Accounts', status: 'live' },
      { label: 'Tenant User System', status: 'live' },
    ],
  },
  {
    key: 'ui-theme',
    title: 'UI / Theme Engine',
    description: 'Theme registry, per-user theme selection, branding, shell layout, and widget presentation.',
    icon: 'palette',
    capabilities: [
      { label: 'Theme Management', status: 'live' },
      { label: 'Branding', status: 'live' },
      { label: 'User Theme', status: 'live' },
      { label: 'Layout', status: 'live' },
      { label: 'Dynamic Themes', status: 'live' },
      { label: 'Dashboard Widgets', status: 'live' },
    ],
  },
  {
    key: 'data-storage',
    title: 'Data & Storage',
    description: 'Retention windows, backup workflows, database performance, and lifecycle controls.',
    icon: 'database',
    capabilities: [
      { label: 'Retention', status: 'live' },
      { label: 'Backups', status: 'live' },
      { label: 'Database Performance', status: 'live' },
      { label: 'Cache & Indexing', status: 'live' },
      { label: 'Data Lifecycle', status: 'live' },
    ],
  },
  {
    key: 'integrations',
    title: 'Integrations',
    description: 'GeoIP providers today, with API, SIEM, monitoring, and threat intel connectors next.',
    icon: 'plug',
    capabilities: [
      { label: 'GeoIP Provider', status: 'live' },
      { label: 'API Access', status: 'live' },
      { label: 'External Services', status: 'live' },
      { label: 'Threat Intelligence', status: 'live' },
    ],
  },
  {
    key: 'notifications-messaging',
    title: 'Notifications & Messaging',
    description: 'SMTP delivery, alert channels, and event-driven webhook notifications.',
    icon: 'bell',
    capabilities: [
      { label: 'SMTP', status: 'live' },
      { label: 'Webhook Routing', status: 'live' },
      { label: 'Custom Event Matrix', status: 'live' },
      { label: 'Escalation Rules', status: 'live' },
      { label: 'Delivery History', status: 'live' },
    ],
  },
  {
    key: 'blocking-response',
    title: 'Blocking & Response',
    description: 'Block-page UX today, with adaptive defense and graduated response strategy next.',
    icon: 'ban',
    capabilities: [
      { label: 'Block Page', status: 'live' },
      { label: 'Challenge Response', status: 'live' },
      { label: 'Slow Down Strategy', status: 'live' },
      { label: 'Adaptive Defense', status: 'live' },
    ],
  },
  {
    key: 'system-debug',
    title: 'System & Debug',
    description: 'Instance runtime settings, diagnostics, observability, and future feature flags.',
    icon: 'wrench',
    capabilities: [
      { label: 'General Runtime', status: 'live' },
      { label: 'Health Check', status: 'live' },
      { label: 'Live Monitoring', status: 'live' },
      { label: 'Logs & Debug', status: 'live' },
      { label: 'Feature Flags', status: 'live' },
      { label: 'Maintenance Controls', status: 'live' },
    ],
  },
]

export function getSettingsSection(key) {
  return SETTINGS_SECTIONS.find((section) => section.key === key) || SETTINGS_SECTIONS[0]
}
