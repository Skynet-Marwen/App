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
  blockPage,
  setBlockPage,
  saving,
  saved,
  isThemeAdmin,
  onSaveSettings,
  onSaveBlockPage,
}) {
  switch (sectionKey) {
    case 'security-detection':
      return <SecurityDetectionTab settings={settings} setSettings={setSettings} saving={saving} savedKey={saved} onSave={() => onSaveSettings('security')} />

    case 'access-network':
      return (
        <div className="space-y-4">
          <HttpsTab settings={settings} setSettings={setSettings} />
          <SettingsRoadmapCard
            eyebrow="Access Layers"
            title="Access & Network Organization"
            description="Public access, trusted edge behavior, and future network policy controls now live in one place."
            groups={[
              {
                title: 'Routing & Trust',
                items: [
                  { label: 'HTTPS mode / provider', status: 'live', note: 'Current TLS posture and edge mode are already configurable.' },
                  { label: 'Allowed domains', status: 'planned', note: 'Host-level policy controls for multi-domain deployments.' },
                  { label: 'CORS config', status: 'planned', note: 'First-class browser trust policy settings.' },
                ],
              },
              {
                title: 'Network Policy',
                items: [
                  { label: 'Whitelist / blacklist IP', status: 'planned', note: 'Operator-managed allow and deny lists.' },
                  { label: 'Country blocking', status: 'planned', note: 'Geo-aware access policy layer.' },
                  { label: 'Rate limiting', status: 'planned', note: 'Global and per-IP/device limit tuning.' },
                ],
              },
            ]}
          />
        </div>
      )

    case 'authentication-identity':
      return (
        <div className="space-y-4">
          <AuthTab settings={settings} setSettings={setSettings} />
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
                  { label: 'Superadmin tier', status: 'planned', note: 'Dedicated owner-grade control surface for future SaaS mode.' },
                ],
              },
              {
                title: 'External & Tenant Identity',
                items: [
                  { label: 'Multi-IdP JWT validation', status: 'live', note: 'Keycloak and additional JWKS-backed providers can now be configured together.' },
                  { label: 'Multi-tenant accounts', status: 'planned', note: 'Owner and team-member hierarchy will live here.' },
                  { label: 'Tenant user system', status: 'planned', note: 'Future SaaS account model and boundaries.' },
                ],
              },
            ]}
          />
        </div>
      )

    case 'ui-theme':
      return (
        <div className="space-y-4">
          <ThemeSelectorTab />
          {isThemeAdmin ? <ThemeManagementTab /> : null}
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
                  { label: 'Advanced layout zones', status: 'partial', note: 'Header, nav, footer, and body styling are now supported.' },
                ],
              },
              {
                title: 'Runtime Experience',
                items: [
                  { label: 'Per-user theme', status: 'live', note: 'Users can override the default theme instantly.' },
                  { label: 'Dynamic risk / tenant themes', status: 'live', note: 'Default-theme operators can now resolve by risk posture or tenant host map.' },
                  { label: 'Fixed vs scrollable shell', status: 'partial', note: 'Main shell behavior now follows the new desktop UX rules.' },
                  { label: 'Dashboard widgets', status: 'partial', note: 'Widget enabling exists and can expand here.' },
                ],
              },
            ]}
          />
        </div>
      )

    case 'data-storage':
      return <DataStorageTab settings={settings} setSettings={setSettings} saving={saving} savedKey={saved} onSave={() => onSaveSettings('data')} />

    case 'integrations':
      return (
        <div className="space-y-4">
          <IntegrationsTab settings={settings} setSettings={setSettings} saving={saving} onSave={() => onSaveSettings('integrations')} />
          <SettingsRoadmapCard
            eyebrow="Integration Surface"
            title="Integrations Organization"
            description="External service controls stay grouped by provider type so API, SIEM, and threat intel integrations can grow without clutter."
            groups={[
              {
                title: 'Provider Controls',
                items: [
                  { label: 'GeoIP provider', status: 'live', note: 'Current provider and local database workflows are active today.' },
                  { label: 'API keys', status: 'planned', note: 'Scoped programmatic access settings.' },
                  { label: 'Integration rate limits', status: 'planned', note: 'Protect outbound and inbound integration surfaces.' },
                ],
              },
              {
                title: 'External Services',
                items: [
                  { label: 'SIEM', status: 'planned', note: 'Forward detections and enrich incidents upstream.' },
                  { label: 'Monitoring tools', status: 'planned', note: 'Observability platform connectors.' },
                  { label: 'Threat intelligence', status: 'planned', note: 'Provider-backed enrichment and reputation workflows.' },
                ],
              },
            ]}
          />
        </div>
      )

    case 'notifications-messaging':
      return (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 2xl:grid-cols-2">
            <SmtpTab settings={settings} setSettings={setSettings} />
            <WebhooksTab settings={settings} setSettings={setSettings} saving={saving} onSave={() => onSaveSettings('notifications')} />
          </div>
          <SettingsRoadmapCard
            eyebrow="Alerting"
            title="Notifications & Messaging Organization"
            description="Delivery channels and event wiring are grouped together so alert policy can evolve without leaking into integrations or blocking screens."
            groups={[
              {
                title: 'Delivery Channels',
                items: [
                  { label: 'SMTP', status: 'live', note: 'Outbound email delivery and testing are active today.' },
                  { label: 'Webhook alerts', status: 'live', note: 'Webhook delivery now covers high-severity incidents in addition to the existing event hooks.' },
                  { label: 'Escalation rules', status: 'planned', note: 'Alert routing by severity and event type.' },
                ],
              },
              {
                title: 'Event Coverage',
                items: [
                  { label: 'High-severity incidents', status: 'live', note: 'Open high and critical incidents now dispatch email and webhook alerts.' },
                  { label: 'Block triggered', status: 'live', note: 'Webhook event hooks exist today.' },
                  { label: 'Custom event matrix', status: 'partial', note: 'Common operational events are wired today, with finer routing still ahead.' },
                ],
              },
            ]}
          />
        </div>
      )

    case 'blocking-response':
      return <BlockingResponseTab blockPage={blockPage} setBlockPage={setBlockPage} saving={saving} savedKey={saved} onSave={onSaveBlockPage} />

    case 'system-debug':
    default:
      return <SystemDebugTab settings={settings} setSettings={setSettings} saving={saving} savedKey={saved} onSave={() => onSaveSettings('system')} />
  }
}
