import { Save } from 'lucide-react'

import { Button, Card, CardHeader, Input, Toggle } from '../../components/ui'

export default function WebhooksTab({ settings, setSettings, saving, onSave }) {
  const eventOptions = [
    'on_block',
    'on_evasion_detected',
    'on_spam_detected',
    'on_high_severity_incident',
    'on_new_user',
  ]

  return (
    <div className="space-y-4 max-w-2xl">
      <Card>
        <CardHeader>
          <p className="text-sm font-medium text-white">Webhooks</p>
          <p className="text-xs text-gray-500">Receive real-time HTTP callbacks on events</p>
        </CardHeader>
        <div className="space-y-4">
          <Input
            label="Webhook URL"
            type="url"
            placeholder="https://hooks.example.com/skynet"
            value={settings.webhook_url ?? ''}
            onChange={(e) => setSettings({ ...settings, webhook_url: e.target.value })}
          />
          <Input
            label="Secret"
            type="password"
            placeholder="Signing secret"
            value={settings.webhook_secret ?? ''}
            onChange={(e) => setSettings({ ...settings, webhook_secret: e.target.value })}
          />
          <div className="divide-y divide-gray-800">
            {eventOptions.map((ev) => (
              <Toggle
                key={ev}
                label={ev.replace('on_', 'On ').replace(/_/g, ' ')}
                checked={!!(settings.webhook_events ?? {})[ev]}
                onChange={(v) => setSettings({ ...settings, webhook_events: { ...(settings.webhook_events ?? {}), [ev]: v } })}
              />
            ))}
          </div>
        </div>
        <div className="mt-5 flex justify-end">
          <Button loading={saving} onClick={onSave} icon={Save}>Save Webhook</Button>
        </div>
      </Card>
    </div>
  )
}
