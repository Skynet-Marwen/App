import { CheckCircle, Save } from 'lucide-react'

import { Button, Card, CardHeader, Input, Toggle } from '../../components/ui'
import SettingsRoadmapCard from './SettingsRoadmapCard'

export default function BlockingResponseTab({ blockPage, setBlockPage, saving, savedKey, onSave }) {
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
                style={{ border: `1px solid ${blockPage.accent_color}33`, background: 'rgba(255,255,255,0.02)', boxShadow: `0 0 30px ${blockPage.accent_color}15` }}
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
                  style={{ width: 44, height: 44, border: `1.5px solid ${blockPage.accent_color}`, borderRadius: '50%', color: blockPage.accent_color, fontSize: 18, boxShadow: `0 0 14px ${blockPage.accent_color}55` }}
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

      <SettingsRoadmapCard
        eyebrow="Response Strategy"
        title="Blocking & Response Organization"
        description="Block-page UX is now its own clean area, with the future response ladder reserved beside it instead of mixed into generic settings."
        groups={[
          {
            title: 'Response Surface',
            items: [
              { label: 'Block page UI', status: 'live', note: 'Content and appearance are fully editable today.' },
              { label: 'Challenge response', status: 'planned', note: 'Escalate to friction before hard deny.' },
              { label: 'Slow down strategy', status: 'planned', note: 'Rate-based degradation instead of immediate block.' },
            ],
          },
          {
            title: 'Adaptive Defense',
            items: [
              { label: 'Reaction by risk score', status: 'planned', note: 'Graduated action selection by confidence.' },
              { label: 'Policy orchestration', status: 'planned', note: 'Tie response strategy back into risk engine outputs.' },
            ],
          },
        ]}
      />
    </div>
  )
}
