import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Badge, Button, Modal } from '../ui'
import { settingsApi, systemApi, themesApi } from '../../services/api'
import { useThemeStore } from '../../store/themeStore'

const DISMISS_KEY = 'skynet_onboarding_dismissed'

export default function OnboardingWizard() {
  const navigate = useNavigate()
  const loadThemeContext = useThemeStore((state) => state.loadThemeContext)
  const [open, setOpen] = useState(false)
  const [status, setStatus] = useState(null)
  const [packs, setPacks] = useState([])
  const [installingPack, setInstallingPack] = useState('')
  const [finishing, setFinishing] = useState(false)

  const checklist = status?.checklist || {}
  const recommendedPack = useMemo(() => packs[0] || null, [packs])

  useEffect(() => {
    let mounted = true
    Promise.allSettled([systemApi.bootstrapStatus(), themesApi.starterPacks()]).then(([bootstrapRes, packRes]) => {
      if (!mounted) return
      const nextStatus = bootstrapRes.status === 'fulfilled' ? bootstrapRes.value.data : null
      const nextPacks = packRes.status === 'fulfilled' && Array.isArray(packRes.value.data) ? packRes.value.data : []
      setStatus(nextStatus)
      setPacks(nextPacks)
      const dismissed = typeof window !== 'undefined' && window.localStorage.getItem(DISMISS_KEY) === '1'
      const shouldOpen = !!nextStatus?.onboarding_enabled && !nextStatus?.onboarding_completed && !dismissed
      setOpen(shouldOpen)
    })
    return () => {
      mounted = false
    }
  }, [])

  const closeTemporarily = () => {
    window.localStorage.setItem(DISMISS_KEY, '1')
    setOpen(false)
  }

  const completeOnboarding = async () => {
    setFinishing(true)
    try {
      await settingsApi.update({ onboarding_completed: true })
      window.localStorage.setItem(DISMISS_KEY, '1')
      setOpen(false)
    } finally {
      setFinishing(false)
    }
  }

  const installStarterPack = async () => {
    if (!recommendedPack) return
    setInstallingPack(recommendedPack.id)
    try {
      await themesApi.installStarterPack(recommendedPack.id, { set_default: true })
      await loadThemeContext()
    } finally {
      setInstallingPack('')
    }
  }

  if (!open || !status) return null

  return (
    <Modal open={open} onClose={closeTemporarily} title="First-Run Onboarding" width="max-w-4xl">
      <div className="space-y-5">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="info">Checklist</Badge>
          <Badge variant={checklist.site_created ? 'success' : 'warning'}>Site {checklist.site_created ? 'ready' : 'missing'}</Badge>
          <Badge variant={checklist.idp_connected ? 'success' : 'warning'}>IdP {checklist.idp_connected ? 'ready' : 'missing'}</Badge>
          <Badge variant={checklist.theme_ready ? 'success' : 'warning'}>Theme {checklist.theme_ready ? 'ready' : 'recommended'}</Badge>
          <Badge variant={checklist.gateway_ready ? 'success' : 'default'}>Gateway {checklist.gateway_ready ? 'ready' : 'optional'}</Badge>
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <StepCard
            title="1. Connect your protected app"
            body="Create a site entry so tracker snippets and future gateway analytics have a target."
            done={checklist.site_created}
            actionLabel={checklist.site_created ? 'Review Integration' : 'Create Site'}
            onAction={() => navigate('/integration')}
          />
          <StepCard
            title="2. Connect Mouwaten / Keycloak"
            body="Configure the JWKS provider, then optionally run the new Keycloak realm sync to pre-load user profiles."
            done={checklist.idp_connected}
            actionLabel="Open Identity Settings"
            onAction={() => navigate('/settings')}
          />
          <StepCard
            title="3. Install a starter pack"
            body={recommendedPack ? `Apply ${recommendedPack.name} as your first polished shell, then customize it in Theme Management.` : 'Starter packs are available in Theme Management.'}
            done={checklist.theme_ready}
            actionLabel={recommendedPack ? `Install ${recommendedPack.name}` : 'Open Theme Settings'}
            onAction={recommendedPack ? installStarterPack : () => navigate('/settings')}
            loading={installingPack === recommendedPack?.id}
          />
          <StepCard
            title="4. Turn on gateway mode"
            body="When you’re ready, SKYNET can sit in front of the origin and make allow / challenge / block decisions itself."
            done={checklist.gateway_ready}
            actionLabel="Configure Gateway"
            onAction={() => navigate('/settings')}
          />
        </div>

        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="secondary" onClick={closeTemporarily}>Dismiss for now</Button>
          <Button loading={finishing} onClick={completeOnboarding}>Mark Onboarding Complete</Button>
        </div>
      </div>
    </Modal>
  )
}

function StepCard({ title, body, done, actionLabel, onAction, loading = false }) {
  return (
    <div className="rounded-xl border border-cyan-500/10 bg-black/25 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-white">{title}</p>
          <p className="mt-2 text-sm text-gray-300">{body}</p>
        </div>
        <Badge variant={done ? 'success' : 'warning'}>{done ? 'Done' : 'Next'}</Badge>
      </div>
      <div className="mt-4 flex justify-end">
        <Button variant="secondary" onClick={onAction} loading={loading}>{actionLabel}</Button>
      </div>
    </div>
  )
}
