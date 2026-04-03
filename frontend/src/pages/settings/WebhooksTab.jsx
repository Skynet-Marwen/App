import { useCallback, useEffect, useMemo, useState } from 'react'
import { CheckCircle, RefreshCw, Save, Send } from 'lucide-react'

import { Badge, Button, Card, CardHeader, Input, Pagination, Select, Table, Toggle } from '../../components/ui'
import { settingsApi } from '../../services/api'

const EVENT_DEFINITIONS = [
  { key: 'high_severity_incident', label: 'High Severity Incident', description: 'High and critical incidents created by anti-evasion and risk enforcement.', allowEscalation: true },
  { key: 'evasion_detected', label: 'Evasion Detected', description: 'Headless, crawler, click-farm, and general anti-evasion detections.' },
  { key: 'spam_detected', label: 'Spam Detected', description: 'Form abuse, burst submission, and duplicate-content detections.' },
  { key: 'block_triggered', label: 'Block Triggered', description: 'Operator-triggered blocks for IPs, visitors, devices, or users.' },
  { key: 'new_user', label: 'New User', description: 'Operator account creation events inside SkyNet.' },
]

const DELIVERY_CHANNEL_OPTIONS = [
  { value: '', label: 'All channels' },
  { value: 'webhook', label: 'Webhook' },
  { value: 'smtp', label: 'SMTP' },
]

const DELIVERY_STATUS_OPTIONS = [
  { value: '', label: 'All statuses' },
  { value: 'sent', label: 'Sent' },
  { value: 'failed', label: 'Failed' },
  { value: 'queued', label: 'Queued' },
]

const DEFAULT_ESCALATION_CHANNELS = { smtp: true, webhook: true }

function badgeVariantForStatus(status) {
  if (status === 'sent') return 'success'
  if (status === 'failed') return 'danger'
  if (status === 'queued') return 'warning'
  return 'default'
}

function badgeVariantForChannel(channel) {
  if (channel === 'webhook') return 'info'
  if (channel === 'smtp') return 'purple'
  return 'default'
}

function summarizePayload(payloadExcerpt) {
  if (!payloadExcerpt) return '—'
  if (payloadExcerpt.length <= 96) return payloadExcerpt
  return `${payloadExcerpt.slice(0, 96)}...`
}

function buildMatrix(settings) {
  const raw = settings.notification_event_matrix || {}
  return EVENT_DEFINITIONS.reduce((acc, definition) => {
    const current = raw[definition.key] || {}
    acc[definition.key] = {
      label: current.label || definition.label,
      webhook: current.webhook ?? (definition.key !== 'new_user'),
      smtp: current.smtp ?? (definition.key === 'high_severity_incident'),
      escalate: current.escalate ?? (definition.key === 'high_severity_incident'),
    }
    return acc
  }, {})
}

export default function WebhooksTab({ settings, setSettings, saving, onSave }) {
  const [saved, setSaved] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testEvent, setTestEvent] = useState('high_severity_incident')
  const [testResult, setTestResult] = useState(null)
  const [testError, setTestError] = useState('')
  const [deliveries, setDeliveries] = useState([])
  const [deliveriesTotal, setDeliveriesTotal] = useState(0)
  const [deliveriesPage, setDeliveriesPage] = useState(1)
  const [deliveryChannel, setDeliveryChannel] = useState('')
  const [deliveryStatus, setDeliveryStatus] = useState('')
  const [loadingDeliveries, setLoadingDeliveries] = useState(true)

  const matrix = useMemo(() => buildMatrix(settings), [settings])
  const escalationChannels = {
    ...DEFAULT_ESCALATION_CHANNELS,
    ...(settings.notification_escalation_channels || {}),
  }

  const refreshDeliveries = useCallback(async () => {
    setLoadingDeliveries(true)
    try {
      const res = await settingsApi.notificationDeliveries({
        page: deliveriesPage,
        page_size: 6,
        channel: deliveryChannel,
        status: deliveryStatus,
      })
      setDeliveries(res.data.items || [])
      setDeliveriesTotal(res.data.total || 0)
    } catch {
      setDeliveries([])
      setDeliveriesTotal(0)
    } finally {
      setLoadingDeliveries(false)
    }
  }, [deliveriesPage, deliveryChannel, deliveryStatus])

  useEffect(() => {
    refreshDeliveries()
  }, [refreshDeliveries])

  const updateMatrixRow = (eventKey, field, value) => {
    const nextMatrix = {
      ...matrix,
      [eventKey]: {
        ...matrix[eventKey],
        [field]: value,
      },
    }
    setSettings({
      ...settings,
      notification_event_matrix: nextMatrix,
    })
  }

  const updateEscalationChannels = (channel, value) => {
    setSettings({
      ...settings,
      notification_escalation_channels: {
        ...escalationChannels,
        [channel]: value,
      },
    })
  }

  const handleSave = async () => {
    await onSave()
    setSaved(true)
    window.setTimeout(() => setSaved(false), 2000)
  }

  const handleTest = async () => {
    setTesting(true)
    setTestResult(null)
    setTestError('')
    try {
      await settingsApi.testWebhook({
        url: settings.webhook_url,
        secret: settings.webhook_secret,
        event: testEvent,
      })
      setTestResult('ok')
      await refreshDeliveries()
    } catch (error) {
      setTestResult('error')
      setTestError(error.response?.data?.detail || 'Webhook request failed')
      await refreshDeliveries()
    } finally {
      setTesting(false)
    }
  }

  const deliveryColumns = [
    {
      key: 'channel',
      label: 'Channel',
      render: (value) => <Badge variant={badgeVariantForChannel(value)}>{String(value || 'unknown').toUpperCase()}</Badge>,
    },
    {
      key: 'event_type',
      label: 'Event',
      render: (value) => <span className="text-xs text-white">{(value || 'unknown').replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase())}</span>,
    },
    {
      key: 'status',
      label: 'Status',
      render: (value) => <Badge variant={badgeVariantForStatus(value)}>{String(value || 'unknown').toUpperCase()}</Badge>,
    },
    {
      key: 'target',
      label: 'Target',
      render: (value) => <span className="text-xs text-gray-400 break-all">{value || '—'}</span>,
    },
    {
      key: 'attempt_count',
      label: 'Attempt',
      render: (_, row) => (
        <span className="text-xs text-gray-400">
          #{row.attempt_count || 1}
          {row.escalation_level > 0 ? ` · Escalation ${row.escalation_level}` : ' · Initial'}
        </span>
      ),
    },
    {
      key: 'payload_excerpt',
      label: 'Details',
      render: (value, row) => (
        <span className={`text-xs ${row.status === 'failed' ? 'text-red-300' : 'text-gray-500'}`}>
          {row.error_message || summarizePayload(value)}
        </span>
      ),
    },
    {
      key: 'created_at',
      label: 'Time',
      render: (_, row) => <span className="text-xs text-gray-400">{new Date(row.delivered_at || row.created_at).toLocaleString()}</span>,
    },
  ]

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader
          action={
            <Button loading={saving} onClick={handleSave} icon={saved ? CheckCircle : Save}>
              {saved ? 'Saved!' : 'Save Notifications'}
            </Button>
          }
        >
          <div>
            <p className="text-sm font-medium text-white">Notifications Routing</p>
            <p className="text-xs text-gray-500">Define exactly which events go to webhook, SMTP, or follow-up escalation without relying on one global toggle list.</p>
          </div>
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

          <div className="rounded-xl border border-cyan-500/10 bg-black/20 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-mono uppercase tracking-[0.2em] text-cyan-400">Custom Event Matrix</p>
                <p className="mt-1 text-xs text-gray-500">Each event decides its own channels. SMTP and webhook no longer share a single coarse switch.</p>
              </div>
              <Badge variant="success">Live</Badge>
            </div>

            <div className="mt-4 space-y-3">
              {EVENT_DEFINITIONS.map((definition) => {
                const row = matrix[definition.key]
                return (
                  <div key={definition.key} className="rounded-lg border border-cyan-500/10 bg-black/25 p-4">
                    <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                      <div className="max-w-2xl">
                        <p className="text-sm font-medium text-white">{definition.label}</p>
                        <p className="mt-1 text-xs text-gray-500">{definition.description}</p>
                      </div>
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 xl:min-w-[420px]">
                        <Toggle
                          label="Webhook"
                          checked={!!row.webhook}
                          onChange={(value) => updateMatrixRow(definition.key, 'webhook', value)}
                        />
                        <Toggle
                          label="SMTP"
                          checked={!!row.smtp}
                          onChange={(value) => updateMatrixRow(definition.key, 'smtp', value)}
                        />
                        {definition.allowEscalation ? (
                          <Toggle
                            label="Escalate"
                            description="Use global escalation delay/repeat policy."
                            checked={!!row.escalate}
                            onChange={(value) => updateMatrixRow(definition.key, 'escalate', value)}
                          />
                        ) : (
                          <div className="flex items-center justify-between py-3">
                            <div>
                              <p className="text-sm font-mono font-medium text-gray-300">Escalate</p>
                              <p className="text-xs mt-0.5 font-mono text-gray-600">Not applicable for this event.</p>
                            </div>
                            <Badge variant="default">N/A</Badge>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          <div className="rounded-xl border border-cyan-500/10 bg-black/20 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-mono uppercase tracking-[0.2em] text-cyan-400">Escalation Policy</p>
                <p className="mt-1 text-xs text-gray-500">Applies only to matrix rows that enable escalation, currently the high-severity incident flow.</p>
              </div>
              <Badge variant={settings.notification_escalation_enabled ? 'success' : 'default'}>
                {settings.notification_escalation_enabled ? 'Enabled' : 'Disabled'}
              </Badge>
            </div>

            <div className="mt-3 divide-y divide-gray-800">
              <Toggle
                label="Enable escalation reminders"
                description="Schedules follow-up notifications for incidents that remain open."
                checked={!!settings.notification_escalation_enabled}
                onChange={(value) => setSettings({ ...settings, notification_escalation_enabled: value })}
              />
            </div>

            <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
              <Select
                label="Minimum Severity"
                value={settings.notification_escalation_min_severity || 'critical'}
                onChange={(event) => setSettings({ ...settings, notification_escalation_min_severity: event.target.value })}
                options={[
                  { value: 'high', label: 'High and critical' },
                  { value: 'critical', label: 'Critical only' },
                ]}
              />
              <Input
                label="Delay (minutes)"
                type="number"
                min="1"
                value={settings.notification_escalation_delay_minutes ?? 15}
                onChange={(event) => setSettings({ ...settings, notification_escalation_delay_minutes: Number(event.target.value) || 15 })}
              />
            </div>

            <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
              <Input
                label="Max Follow-up Sends"
                type="number"
                min="0"
                max="10"
                value={settings.notification_escalation_repeat_limit ?? 2}
                onChange={(event) => setSettings({ ...settings, notification_escalation_repeat_limit: Number(event.target.value) || 0 })}
              />
              <div className="rounded-lg border border-cyan-500/10 bg-black/25 p-3">
                <p className="text-xs font-mono uppercase tracking-[0.18em] text-gray-500">Escalation Channels</p>
                <div className="mt-1 divide-y divide-gray-800">
                  <Toggle label="SMTP" checked={!!escalationChannels.smtp} onChange={(value) => updateEscalationChannels('smtp', value)} />
                  <Toggle label="Webhook" checked={!!escalationChannels.webhook} onChange={(value) => updateEscalationChannels('webhook', value)} />
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-cyan-500/10 bg-black/20 p-4">
            <p className="text-xs font-mono uppercase tracking-[0.2em] text-cyan-400">Test Delivery</p>
            <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,1fr)_auto]">
              <Select
                label="Test Event"
                value={testEvent}
                onChange={(event) => setTestEvent(event.target.value)}
                options={EVENT_DEFINITIONS.map((item) => ({ value: item.key, label: item.label }))}
              />
              <div className="flex items-end">
                <Button loading={testing} icon={Send} className="w-full md:w-auto" onClick={handleTest}>
                  Send Test
                </Button>
              </div>
            </div>
            {testResult === 'ok' && <p className="mt-2 text-xs text-green-400">Webhook test sent successfully.</p>}
            {testResult === 'error' && <p className="mt-2 text-xs text-red-400">{testError}</p>}
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader
          action={<Button variant="secondary" size="sm" icon={RefreshCw} onClick={refreshDeliveries}>Refresh</Button>}
        >
          <div>
            <p className="text-sm font-medium text-white">Delivery Log</p>
            <p className="text-xs text-gray-500">Recent SMTP and webhook delivery attempts, including failures and escalation retries.</p>
          </div>
        </CardHeader>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-[0.9fr_0.9fr]">
          <Select
            label="Channel"
            value={deliveryChannel}
            onChange={(event) => { setDeliveryChannel(event.target.value); setDeliveriesPage(1) }}
            options={DELIVERY_CHANNEL_OPTIONS}
          />
          <Select
            label="Status"
            value={deliveryStatus}
            onChange={(event) => { setDeliveryStatus(event.target.value); setDeliveriesPage(1) }}
            options={DELIVERY_STATUS_OPTIONS}
          />
        </div>

        <div className="mt-4 overflow-hidden rounded-xl border border-cyan-500/10">
          <Table columns={deliveryColumns} data={deliveries} loading={loadingDeliveries} emptyMessage="No notification deliveries logged yet" />
        </div>
        <Pagination page={deliveriesPage} total={deliveriesTotal} pageSize={6} onChange={setDeliveriesPage} />
      </Card>
    </div>
  )
}
