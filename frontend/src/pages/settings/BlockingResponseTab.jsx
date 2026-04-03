import { CheckCircle, Save } from 'lucide-react'

import { Button, Card, CardHeader, Input, Select, Toggle } from '../../components/ui'
import SettingsRoadmapCard from './SettingsRoadmapCard'

const CHALLENGE_TYPE_OPTIONS = [
  { value: 'js_pow', label: 'JS Proof of Work' },
  { value: 'captcha_redirect', label: 'Redirect Challenge' },
  { value: 'honeypot', label: 'Honeypot Form' },
]

export default function BlockingResponseTab({
  settings,
  setSettings,
  securityConfig,
  setSecurityConfig,
  blockPage,
  setBlockPage,
  saving,
  savedKey,
  showFeatureStatusDetails,
  onSave,
  onSaveStrategy,
}) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,0.98fr)_minmax(360px,0.72fr)]">
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <div>
                <p className="text-xs font-mono font-medium uppercase tracking-widest text-cyan-400">Block Page Content</p>
                <p className="mt-1 text-xs text-gray-500">Keep the current response page configurable here, separate from the future response engine.</p>
              </div>
            </CardHeader>

            <div className="space-y-4">
              <Input label="Title" value={blockPage.title} onChange={(event) => setBlockPage({ ...blockPage, title: event.target.value })} />
              <Input label="Subtitle" value={blockPage.subtitle} onChange={(event) => setBlockPage({ ...blockPage, subtitle: event.target.value })} />
              <div className="space-y-1.5">
                <label className="block text-xs font-mono uppercase tracking-wider text-gray-500">Message</label>
                <textarea
                  rows={3}
                  value={blockPage.message}
                  onChange={(event) => setBlockPage({ ...blockPage, message: event.target.value })}
                  className="w-full resize-none rounded-lg border border-cyan-500/15 px-3 py-2 text-sm font-mono text-gray-200 focus:border-cyan-500/60 focus:outline-none"
                  style={{ background: 'rgba(0,0,0,0.6)' }}
                />
              </div>
              <Input
                label="Logo URL (optional)"
                placeholder="https://example.com/logo.png"
                value={blockPage.logo_url || ''}
                onChange={(event) => setBlockPage({ ...blockPage, logo_url: event.target.value })}
              />
              <Input
                label="Contact Email (optional)"
                type="email"
                value={blockPage.contact_email || ''}
                onChange={(event) => setBlockPage({ ...blockPage, contact_email: event.target.value })}
              />
            </div>
          </Card>

          <Card>
            <CardHeader
              action={
                <Button loading={saving} onClick={onSaveStrategy} variant="secondary" icon={savedKey === 'blocking-response' ? CheckCircle : Save}>
                  {savedKey === 'blocking-response' ? 'Saved!' : 'Save Response Strategy'}
                </Button>
              }
            >
              <div>
                <p className="text-xs font-mono font-medium uppercase tracking-widest text-cyan-400">Response Ladder</p>
                <p className="mt-1 text-xs text-gray-500">Configure challenge, slow-down, and adaptive response behavior from one place.</p>
              </div>
            </CardHeader>

            <div className="space-y-4">
              <div className="divide-y divide-cyan-500/10">
                <Toggle
                  label="Challenge Response"
                  description="Serve a verification step before a hard deny when a response path chooses challenge."
                  checked={!!securityConfig.challenge_enabled}
                  onChange={(value) => setSecurityConfig({ ...securityConfig, challenge_enabled: value })}
                />
                <Toggle
                  label="Slow Down Strategy"
                  description="Allow rate-limit style response actions to return a temporary slow-down instead of an immediate block."
                  checked={!!settings.response_slowdown_enabled}
                  onChange={(value) => setSettings({ ...settings, response_slowdown_enabled: value })}
                />
                <Toggle
                  label="Adaptive Defense"
                  description="Escalate response strength automatically when manual rules, user risk, and device risk overlap."
                  checked={!!settings.enable_auto_defense}
                  onChange={(value) => setSettings({ ...settings, enable_auto_defense: value })}
                />
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <Select
                  label="Challenge Type"
                  value={securityConfig.challenge_type || 'js_pow'}
                  onChange={(event) => setSecurityConfig({ ...securityConfig, challenge_type: event.target.value })}
                  options={CHALLENGE_TYPE_OPTIONS}
                />
                <Input
                  label="Slow Down Retry-After (sec)"
                  type="number"
                  min="1"
                  value={settings.response_slowdown_retry_after_sec ?? 30}
                  onChange={(event) => setSettings({ ...settings, response_slowdown_retry_after_sec: Number(event.target.value) || 30 })}
                />
              </div>

              {securityConfig.challenge_type === 'captcha_redirect' ? (
                <Input
                  label="Redirect Challenge URL"
                  placeholder="https://challenge.example.com/verify"
                  value={securityConfig.challenge_redirect_url || ''}
                  onChange={(event) => setSecurityConfig({ ...securityConfig, challenge_redirect_url: event.target.value })}
                />
              ) : null}

              {securityConfig.challenge_type === 'js_pow' ? (
                <Input
                  label="Proof-of-Work Difficulty"
                  type="number"
                  min="1"
                  max="8"
                  value={securityConfig.challenge_pow_difficulty ?? 4}
                  onChange={(event) => setSecurityConfig({ ...securityConfig, challenge_pow_difficulty: Number(event.target.value) || 4 })}
                />
              ) : null}

              {securityConfig.challenge_type === 'honeypot' ? (
                <Input
                  label="Honeypot Field Name"
                  value={securityConfig.challenge_honeypot_field || 'website'}
                  onChange={(event) => setSecurityConfig({ ...securityConfig, challenge_honeypot_field: event.target.value })}
                />
              ) : null}

              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <Input
                  label="Auto-Challenge Threshold"
                  type="number"
                  min="0.1"
                  max="1"
                  step="0.05"
                  value={settings.risk_auto_challenge_threshold ?? 0.8}
                  onChange={(event) => setSettings({ ...settings, risk_auto_challenge_threshold: Number(event.target.value) || 0.8 })}
                />
                <Input
                  label="Auto-Block Threshold"
                  type="number"
                  min="0.1"
                  max="1"
                  step="0.05"
                  value={settings.risk_auto_block_threshold ?? 0.95}
                  onChange={(event) => setSettings({ ...settings, risk_auto_block_threshold: Number(event.target.value) || 0.95 })}
                />
              </div>
            </div>
          </Card>

          <Card>
            <CardHeader
              action={
                <Button loading={saving} onClick={onSave} icon={savedKey === 'block' ? CheckCircle : Save}>
                  {savedKey === 'block' ? 'Saved!' : 'Save Block Page'}
                </Button>
              }
            >
              <div>
                <p className="text-xs font-mono font-medium uppercase tracking-widest text-cyan-400">Appearance</p>
                <p className="mt-1 text-xs text-gray-500">Visual styling for the current block response page.</p>
              </div>
            </CardHeader>

            <div className="space-y-4">
              <div className="flex gap-4">
                <div className="flex-1 space-y-1.5">
                  <label className="block text-xs font-mono uppercase tracking-wider text-gray-500">Background</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={blockPage.bg_color}
                      onChange={(event) => setBlockPage({ ...blockPage, bg_color: event.target.value })}
                      className="h-10 w-10 cursor-pointer rounded border border-cyan-500/20 bg-transparent"
                    />
                    <Input value={blockPage.bg_color} onChange={(event) => setBlockPage({ ...blockPage, bg_color: event.target.value })} className="font-mono text-xs" />
                  </div>
                </div>

                <div className="flex-1 space-y-1.5">
                  <label className="block text-xs font-mono uppercase tracking-wider text-gray-500">Accent</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={blockPage.accent_color}
                      onChange={(event) => setBlockPage({ ...blockPage, accent_color: event.target.value })}
                      className="h-10 w-10 cursor-pointer rounded border border-cyan-500/20 bg-transparent"
                    />
                    <Input value={blockPage.accent_color} onChange={(event) => setBlockPage({ ...blockPage, accent_color: event.target.value })} className="font-mono text-xs" />
                  </div>
                </div>
              </div>

              <div className="divide-y divide-cyan-500/10">
                <Toggle
                  label="Show Request ID"
                  description="Display a support-friendly request code on the response page."
                  checked={blockPage.show_request_id}
                  onChange={(value) => setBlockPage({ ...blockPage, show_request_id: value })}
                />
                <Toggle
                  label="Show Contact Email"
                  description="Include contact guidance directly in the response screen."
                  checked={blockPage.show_contact}
                  onChange={(value) => setBlockPage({ ...blockPage, show_contact: value })}
                />
              </div>
            </div>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <div>
              <p className="text-xs font-mono font-medium uppercase tracking-widest text-cyan-400">Live Preview</p>
              <p className="mt-1 text-xs text-gray-500">See the current block surface while the larger response strategy layer is still being built.</p>
            </div>
          </CardHeader>

          <div className="overflow-hidden rounded-xl border border-cyan-500/10" style={{ height: '420px' }}>
            <div className="flex h-full w-full items-center justify-center font-mono" style={{ background: blockPage.bg_color }}>
              <div
                className="max-w-xs px-6 py-8 text-center"
                style={{ border: `1px solid ${blockPage.accent_color}33`, background: 'rgba(255,255,255,0.02)' }}
              >
                {blockPage.logo_url ? (
                  <img
                    src={blockPage.logo_url}
                    style={{ height: 36, margin: '0 auto 16px', display: 'block' }}
                    alt=""
                    onError={(event) => {
                      event.target.style.display = 'none'
                    }}
                  />
                ) : null}

                <div
                  className="mx-auto mb-4 flex items-center justify-center"
                  style={{ width: 44, height: 44, border: `1.5px solid ${blockPage.accent_color}`, borderRadius: '50%', color: blockPage.accent_color, fontSize: 18 }}
                >
                  ✕
                </div>
                <p style={{ color: blockPage.accent_color, fontSize: 13, fontWeight: 700, letterSpacing: '0.12em', marginBottom: 8 }}>{blockPage.title || '—'}</p>
                <p style={{ color: '#9ca3af', fontSize: 11, marginBottom: 10, lineHeight: 1.5 }}>{blockPage.subtitle || '—'}</p>
                <p style={{ color: '#6b7280', fontSize: 10, marginBottom: 14, lineHeight: 1.6 }}>{blockPage.message || '—'}</p>
                {blockPage.show_request_id ? <code style={{ color: '#374151', fontSize: 9, display: 'block', marginBottom: 10 }}>REQ#A1B2C3D4</code> : null}
                {blockPage.show_contact && blockPage.contact_email ? (
                  <span style={{ color: blockPage.accent_color, fontSize: 10 }}>{blockPage.contact_email}</span>
                ) : null}
              </div>
            </div>
          </div>
        </Card>
      </div>

      {showFeatureStatusDetails ? (
        <SettingsRoadmapCard
          eyebrow="Response Strategy"
          title="Blocking & Response Organization"
          description="Block-page UX, graduated challenge, slow-down, and adaptive defense now live together as one operator response ladder."
          groups={[
            {
              title: 'Response Surface',
              items: [
                { label: 'Block page UI', status: 'live', note: 'Content and appearance are fully editable today.' },
                { label: 'Challenge response', status: 'live', note: 'Proof-of-work, redirect, and honeypot challenge flows are configurable here and enforced by the response engine.' },
                { label: 'Slow down strategy', status: 'live', note: 'Blocking rules can now return temporary rate-limit responses with a configurable Retry-After window.' },
              ],
            },
            {
              title: 'Adaptive Defense',
              items: [
                { label: 'Reaction by risk score', status: 'live', note: 'Auto-challenge and auto-block thresholds now directly shape the response ladder.' },
                { label: 'Policy orchestration', status: 'live', note: 'Blocking rules, user risk, device risk, and challenge policy now resolve inside the same enforcement flow.' },
              ],
            },
          ]}
        />
      ) : null}
    </div>
  )
}
