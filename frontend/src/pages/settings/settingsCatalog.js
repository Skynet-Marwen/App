export const SETTINGS_SECTIONS = [
  {
    key: 'security-detection',
    title: 'Security & Detection',
    description: 'Risk engine, automation signals, network intelligence, and device identity tuning.',
    icon: 'shield',
    capabilities: [
      { label: 'Risk Engine', status: 'live' },
      { label: 'Bot & Automation Detection', status: 'live' },
      { label: 'Network Intelligence', status: 'partial' },
      { label: 'Threat Intelligence', status: 'live' },
      { label: 'Device Identity', status: 'partial' },
    ],
  },
  {
    key: 'access-network',
    title: 'Access & Network',
    description: 'HTTPS posture, routing, trusted domains, IP controls, and rate enforcement.',
    icon: 'network',
    capabilities: [
      { label: 'HTTPS & TLS', status: 'live' },
      { label: 'Domains & Routing', status: 'planned' },
      { label: 'IP Control', status: 'planned' },
      { label: 'Rate Limiting', status: 'planned' },
    ],
  },
  {
    key: 'authentication-identity',
    title: 'Authentication & Identity',
    description: 'Operator auth, session policy, SaaS user systems, and external identity providers.',
    icon: 'lock',
    capabilities: [
      { label: 'Admin Access', status: 'live' },
      { label: 'User System', status: 'planned' },
      { label: 'SSO / External Auth', status: 'live' },
    ],
  },
  {
    key: 'ui-theme',
    title: 'UI / Theme Engine',
    description: 'Theme registry, per-user theme selection, branding, shell layout, and widget presentation.',
    icon: 'palette',
    capabilities: [
      { label: 'Theme Management', status: 'live' },
      { label: 'Layout', status: 'partial' },
      { label: 'Branding', status: 'live' },
      { label: 'User Theme', status: 'live' },
    ],
  },
  {
    key: 'data-storage',
    title: 'Data & Storage',
    description: 'Retention windows, backup workflows, database performance, and lifecycle controls.',
    icon: 'database',
    capabilities: [
      { label: 'Retention', status: 'live' },
      { label: 'Database', status: 'planned' },
      { label: 'Data Lifecycle', status: 'planned' },
      { label: 'Backups', status: 'live' },
    ],
  },
  {
    key: 'integrations',
    title: 'Integrations',
    description: 'GeoIP providers today, with API, SIEM, monitoring, and threat intel connectors next.',
    icon: 'plug',
    capabilities: [
      { label: 'GeoIP Provider', status: 'live' },
      { label: 'API Access', status: 'planned' },
      { label: 'External Services', status: 'planned' },
      { label: 'Threat Intelligence', status: 'planned' },
    ],
  },
  {
    key: 'notifications-messaging',
    title: 'Notifications & Messaging',
    description: 'SMTP delivery, alert channels, and event-driven webhook notifications.',
    icon: 'bell',
    capabilities: [
      { label: 'SMTP', status: 'live' },
      { label: 'Alerts', status: 'live' },
      { label: 'Events', status: 'live' },
    ],
  },
  {
    key: 'blocking-response',
    title: 'Blocking & Response',
    description: 'Block-page UX today, with adaptive defense and graduated response strategy next.',
    icon: 'ban',
    capabilities: [
      { label: 'Block Page', status: 'live' },
      { label: 'Response Strategy', status: 'planned' },
      { label: 'Adaptive Defense', status: 'planned' },
    ],
  },
  {
    key: 'system-debug',
    title: 'System & Debug',
    description: 'Instance runtime settings, diagnostics, observability, and future feature flags.',
    icon: 'wrench',
    capabilities: [
      { label: 'General Runtime', status: 'live' },
      { label: 'Logs', status: 'planned' },
      { label: 'Debug Mode', status: 'planned' },
      { label: 'Health Check', status: 'partial' },
    ],
  },
]

export function getSettingsSection(key) {
  return SETTINGS_SECTIONS.find((section) => section.key === key) || SETTINGS_SECTIONS[0]
}
