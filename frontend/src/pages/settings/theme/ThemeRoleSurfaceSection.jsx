import { EyeOff, Repeat2, ShieldCheck, Users } from 'lucide-react'
import { Button } from '../../../components/ui'

const DEFAULT_RULES = {
  user: { hidden: ['settings', 'integration'] },
  moderator: { hidden: ['settings'] },
  admin: { hidden: [] },
}

function readLayoutRules(layout) {
  return layout?.role_surfaces && typeof layout.role_surfaces === 'object' ? layout.role_surfaces : {}
}

function stringify(value) {
  return JSON.stringify(value ?? {}, null, 2)
}

export default function ThemeRoleSurfaceSection({ layout, onLayoutChange }) {
  const roleSurfaces = readLayoutRules(layout)
  const roleCount = Object.keys(roleSurfaces).length

  const applyPreset = (preset) => onLayoutChange('role_surfaces', preset)

  return (
    <div className="space-y-4 rounded-xl border border-cyan-500/10 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-white">Role-based Shell Surfaces</p>
          <p className="text-xs text-gray-500 font-mono mt-1">
            Theme authors can hide or relabel navigation entries by role without changing routes or backend permissions. `viewer/operator` aliases are also supported for imported packages.
          </p>
        </div>
        <div className="rounded-lg border border-cyan-500/10 bg-black/30 px-3 py-2 text-xs font-mono text-gray-400">
          {roleCount} role group{roleCount === 1 ? '' : 's'} configured
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <PresetCard
          icon={EyeOff}
          title="Viewer-safe"
          description="Hide operator-only surfaces like integration and settings."
          onClick={() => applyPreset(DEFAULT_RULES)}
        />
        <PresetCard
          icon={Users}
          title="Operator"
          description="Keep the shell focused on investigations and daily operations."
          onClick={() => applyPreset({
            user: DEFAULT_RULES.user,
            moderator: { hidden: ['settings'], labels: { users: 'Identity' } },
            admin: DEFAULT_RULES.admin,
          })}
        />
        <PresetCard
          icon={Repeat2}
          title="Clear rules"
          description="Remove all role-specific navigation overrides."
          onClick={() => applyPreset({})}
        />
      </div>

      <div className="rounded-lg border border-cyan-500/10 bg-black/30 p-3">
        <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-[0.18em] text-cyan-400">
          <ShieldCheck size={13} />
          Theme JSON shape
        </div>
        <pre className="mt-2 overflow-x-auto text-[11px] leading-5 text-gray-300 font-mono">
{stringify({
  role_surfaces: {
    user: { hidden: ['settings', 'integration'] },
    moderator: { hidden: ['settings'], labels: { users: 'Identity' } },
    admin: { hidden: [] },
  },
})}
        </pre>
      </div>
    </div>
  )
}

function PresetCard({ icon, title, description, onClick }) {
  const PresetIcon = icon
  return (
    <div className="rounded-xl border border-cyan-500/10 bg-black/20 p-3">
      <div className="flex items-center gap-2 text-white">
        <PresetIcon size={15} className="text-cyan-400" />
        <p className="text-sm font-medium">{title}</p>
      </div>
      <p className="mt-2 text-xs text-gray-500 font-mono">{description}</p>
      <Button type="button" className="mt-3" variant="secondary" size="sm" onClick={onClick}>
        Apply
      </Button>
    </div>
  )
}
