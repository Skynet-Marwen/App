import AuthTab from './AuthTab'
import BlockingResponseTab from './BlockingResponseTab'
import DataStorageTab from './DataStorageTab'
import HttpsTab from './HttpsTab'
import IntegrationsTab from './IntegrationsTab'
import SecurityDetectionTab from './SecurityDetectionTab'
import SettingsRoadmapCard from './SettingsRoadmapCard'
import SmtpTab from './SmtpTab'
import SystemDebugTab from './SystemDebugTab'
import ThemeManagementTab from './ThemeManagementTab'
import ThemeSelectorTab from './ThemeSelectorTab'
import WebhooksTab from './WebhooksTab'

export default function SettingsSectionContent({
  sectionKey,
  settings,
  setSettings,
  securityConfig,
  setSecurityConfig,
  blockPage,
  setBlockPage,
  saving,
  saved,
  isThemeAdmin,
  showFeatureStatusDetails,
  onSaveSettings,
  onSaveSecurity,
  onSaveBlockPage,
}) {
  switch (sectionKey) {
    case 'security-detection':
      return (
        <SecurityDetectionTab
          settings={settings}
          setSettings={setSettings}
          securityConfig={securityConfig}
          setSecurityConfig={setSecurityConfig}
          saving={saving}
          savedKey={saved}
          showFeatureStatusDetails={showFeatureStatusDetails}
          onSave={onSaveSecurity}
        />
      )

    case 'access-network':
      return (
        <div className="space-y-4">
          <HttpsTab settings={settings} setSettings={setSettings} />
          {showFeatureStatusDetails ? (
            <SettingsRoadmapCard
              eyebrow="Access Layers"
              title="Access & Network Organization"
              description="Public access, trusted edge behavior, and future network policy controls now live in one place."
              groups={[
                {
                  title: 'Routing & Trust',
                  items: [
                    { label: 'HTTPS mode / provider', status: 'live', note: 'Current TLS posture and edge mode are already configurable.' },
                    { label: 'Allowed domains', status: 'live', note: 'Host-level policy controls now reject unapproved hosts before app routing.' },
                    { label: 'CORS config', status: 'live', note: 'Origin, method, header, and credential policy are now runtime-configurable.' },
                  ],
                },
                {
                  title: 'Network Policy',
                  items: [
                    { label: 'Whitelist / blacklist IP', status: 'live', note: 'Runtime IP allow/deny policy now applies before auth, tracking, and gateway forwarding.' },
                    { label: 'Country blocking', status: 'live', note: 'Threat-driven country watchlists can now observe, challenge, or block from Security & Detection.' },
                    { label: 'Rate limiting', status: 'live', note: 'Redis-backed per-IP buckets now use the Access & Network runtime limits for default, auth, and tracking paths.' },
                  ],
                },
              ]}
            />
          ) : null}
        </div>
      )

    case 'authentication-identity':
      return (
        <div className="space-y-4">
          <AuthTab settings={settings} setSettings={setSettings} />
          {showFeatureStatusDetails ? (
            <SettingsRoadmapCard
              eyebrow="Identity Stack"
              title="Authentication & Identity Organization"
              description="Operator auth stays distinct from future tenant user models and external SSO connectors."
              groups={[
                {
                  title: 'Operator Identity',
                  items: [
                    { label: 'Roles', status: 'live', note: 'Operator accounts and permissions are active today.' },
                    { label: 'Session TTL / limits', status: 'live', note: 'Token expiry and max sessions are already configurable.' },
                    { label: 'Superadmin tier', status: 'live', note: 'Owner-grade accounts can now manage tenant creation and superadmin promotion safely.' },
                  ],
                },
                {
                  title: 'External & Tenant Identity',
                  items: [
                    { label: 'Multi-IdP JWT validation', status: 'live', note: 'Keycloak and additional JWKS-backed providers can now be configured together.' },
                    { label: 'Multi-tenant accounts', status: 'live', note: 'Tenant records now include host mapping, default theme, and lifecycle controls.' },
                    { label: 'Tenant user system', status: 'live', note: 'Operators can now be assigned per tenant while superadmins stay global.' },
                  ],
                },
              ]}
            />
          ) : null}
        </div>
      )

    case 'ui-theme':
      return (
        <div className="space-y-4">
          <ThemeSelectorTab />
          {isThemeAdmin ? <ThemeManagementTab /> : null}
          {showFeatureStatusDetails ? (
            <SettingsRoadmapCard
              eyebrow="Theme Architecture"
              title="UI / Theme Engine Organization"
              description="Theme controls are now grouped by registry, branding, and user resolution so the shell can keep growing cleanly."
              groups={[
                {
                  title: 'Registry & Branding',
                  items: [
                    { label: 'Theme registry', status: 'live', note: 'Global themes, defaults, and editing are already supported.' },
                    { label: 'Logo / colors / branding', status: 'live', note: 'Brand asset and shell color controls are live.' },
                    { label: 'Advanced layout zones', status: 'live', note: 'Header, nav, footer, content width, sticky behavior, and shell mode are all configurable.' },
                  ],
                },
                {
                  title: 'Runtime Experience',
                  items: [
                    { label: 'Per-user theme', status: 'live', note: 'Users can override the default theme instantly.' },
                    { label: 'Dynamic risk / tenant themes', status: 'live', note: 'Default-theme operators can now resolve by risk posture or tenant host map.' },
                    { label: 'Fixed vs scrollable shell', status: 'live', note: 'Themes now switch between fixed-dashboard and document-scroll shells at runtime.' },
                    { label: 'Dashboard widgets', status: 'live', note: 'Themes now have a curated widget picker in addition to raw JSON control.' },
                  ],
                },
              ]}
            />
          ) : null}
        </div>
      )

    case 'data-storage':
      return (
        <DataStorageTab
          settings={settings}
          setSettings={setSettings}
          saving={saving}
          savedKey={saved}
          showFeatureStatusDetails={showFeatureStatusDetails}
          onSave={() => onSaveSettings('data')}
        />
      )

    case 'integrations':
      return (
        <div className="space-y-4">
          <IntegrationsTab settings={settings} setSettings={setSettings} saving={saving} onSave={() => onSaveSettings('integrations')} />
          {showFeatureStatusDetails ? (
            <SettingsRoadmapCard
              eyebrow="Integration Surface"
              title="Integrations Organization"
              description="External service controls stay grouped by provider type so API, SIEM, and threat intel integrations can grow without clutter."
              groups={[
                {
                  title: 'Provider Controls',
                  items: [
                    { label: 'GeoIP provider', status: 'live', note: 'Current provider and local database workflows are active today.' },
                    { label: 'API keys', status: 'live', note: 'Site API access can now be governed with runtime enable/disable and key prefix controls.' },
                    { label: 'Integration rate limits', status: 'live', note: 'Dedicated integration endpoints now use their own runtime rate-limit bucket.' },
                  ],
                },
                {
                  title: 'External Services',
                  items: [
                    { label: 'SIEM', status: 'live', note: 'Signed webhook delivery now forwards selected detections into SIEM pipelines.' },
                    { label: 'Monitoring tools', status: 'live', note: 'Monitoring connectors can now receive the same live protection events.' },
                    { label: 'Threat intelligence', status: 'live', note: 'Threat-intel inventory and manual refresh now live directly in integrations settings.' },
                  ],
                },
              ]}
            />
          ) : null}
        </div>
      )

    case 'notifications-messaging':
      return (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 2xl:grid-cols-2">
            <SmtpTab settings={settings} setSettings={setSettings} />
            <WebhooksTab settings={settings} setSettings={setSettings} saving={saving} onSave={() => onSaveSettings('notifications')} />
          </div>
          {showFeatureStatusDetails ? (
            <SettingsRoadmapCard
              eyebrow="Alerting"
              title="Notifications & Messaging Organization"
              description="Delivery channels and event wiring are grouped together so alert policy can evolve without leaking into integrations or blocking screens."
              groups={[
                {
                  title: 'Delivery Channels',
                  items: [
                    { label: 'SMTP', status: 'live', note: 'Outbound email delivery and testing are active today.' },
                    { label: 'Webhook alerts', status: 'live', note: 'Webhook delivery now supports signed test sends and a recent-delivery history for operators.' },
                    { label: 'Escalation rules', status: 'live', note: 'Open high/critical incidents can now re-notify on a configurable delay and channel mix.' },
                  ],
                },
                {
                  title: 'Event Coverage',
                  items: [
                    { label: 'High-severity incidents', status: 'live', note: 'Open high and critical incidents now dispatch email and webhook alerts.' },
                    { label: 'Block triggered', status: 'live', note: 'Webhook event hooks exist today.' },
                    { label: 'Custom event matrix', status: 'live', note: 'Per-event webhook, SMTP, and escalation routing is now configurable from a dedicated matrix.' },
                  ],
                },
              ]}
            />
          ) : null}
        </div>
      )

    case 'blocking-response':
      return (
        <BlockingResponseTab
          settings={settings}
          setSettings={setSettings}
          securityConfig={securityConfig}
          setSecurityConfig={setSecurityConfig}
          blockPage={blockPage}
          setBlockPage={setBlockPage}
          saving={saving}
          savedKey={saved}
          showFeatureStatusDetails={showFeatureStatusDetails}
          onSave={onSaveBlockPage}
          onSaveStrategy={() => onSaveSecurity('blocking-response')}
        />
      )

    case 'system-debug':
    default:
      return (
        <SystemDebugTab
          settings={settings}
          setSettings={setSettings}
          saving={saving}
          savedKey={saved}
          showFeatureStatusDetails={showFeatureStatusDetails}
          onSave={() => onSaveSettings('system')}
        />
      )
  }
}
