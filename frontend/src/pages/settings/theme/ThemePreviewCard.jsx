export default function ThemePreviewCard({ theme }) {
  const colors = theme?.colors ?? {}
  const branding = theme?.branding ?? {}
  const layout = theme?.layout ?? {}
  const widgets = Array.isArray(theme?.widgets) ? theme.widgets : []
  const roleSurfaces = layout.role_surfaces && typeof layout.role_surfaces === 'object' ? layout.role_surfaces : {}

  const background = colors.background || '#0b1120'
  const surface = colors.panelBackground || colors.surface || '#111827'
  const header = colors.headerBackground || '#020617'
  const nav = colors.navBackground || '#020617'
  const footer = colors.footerBackground || '#020617'
  const primary = colors.primary || '#06b6d4'
  const secondary = colors.secondary || '#8b5cf6'
  const accent = colors.accent || '#22c55e'
  const text = colors.text || '#e5e7eb'
  const muted = colors.muted || '#9ca3af'

  return (
    <div
      className="rounded-xl border overflow-hidden"
      style={{
        background: colors.backgroundGradient || background,
        borderColor: `${primary}33`,
        boxShadow: '0 10px 24px rgba(0, 0, 0, 0.18)',
      }}
    >
      <div
        className="px-4 py-3 border-b flex items-center justify-between"
        style={{ borderColor: `${primary}22`, background: `${header}` }}
      >
        <div className="flex items-center gap-3">
          {branding?.logo_url ? <img src={branding.logo_url} alt="" className="h-9 w-9 rounded-lg object-cover border border-white/10" /> : null}
          <div>
            <p className="text-xs font-mono uppercase tracking-[0.18em]" style={{ color: primary }}>
              {theme?.name || 'Untitled theme'}
            </p>
            <p className="text-[11px] font-mono mt-1" style={{ color: muted }}>
              Layout: {layout.mode || 'dark'} / {layout.density || 'comfortable'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="h-3 w-3 rounded-full border" style={{ background: primary, borderColor: `${text}33` }} />
          <span className="h-3 w-3 rounded-full border" style={{ background: secondary, borderColor: `${text}33` }} />
          <span className="h-3 w-3 rounded-full border" style={{ background: accent, borderColor: `${text}33` }} />
        </div>
      </div>

      <div className="px-4 py-2 border-b" style={{ background: nav, borderColor: `${primary}22`, color: muted }}>
        <div className="flex gap-2 text-[10px] font-mono uppercase tracking-widest">
          <span style={{ color: colors.navTextActive || primary }}>Overview</span>
          <span>Devices</span>
          <span>Audit</span>
        </div>
      </div>

      <div className="p-4 space-y-4" style={{ color: text }}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold font-mono">{branding?.company_name || 'SKYNET Console'}</p>
            <p className="text-xs mt-1 font-mono" style={{ color: muted }}>
              {branding?.tagline || 'Runtime dashboard preview'}
            </p>
          </div>
          <div
            className="px-2.5 py-1 rounded-lg text-[10px] font-mono uppercase tracking-wider border"
            style={{ color: accent, borderColor: `${accent}55`, background: `${accent}11` }}
          >
            {theme?.is_active ? 'Active' : 'Inactive'}
          </div>
        </div>

        <div
          className="rounded-xl border p-3"
          style={{ borderColor: `${secondary}33`, background: `${surface}dd` }}
        >
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-mono uppercase tracking-widest" style={{ color: secondary }}>
              Primary Panel
            </p>
            <div
              className="h-2 w-16 rounded-full"
              style={{ background: `linear-gradient(90deg, ${primary}, ${secondary})` }}
            />
          </div>
          <div className="grid grid-cols-3 gap-2">
            {[primary, secondary, accent].map((color, index) => (
              <div
                key={`${color}-${index}`}
                className="rounded-lg p-2 border text-center text-[10px] font-mono"
                style={{ borderColor: `${color}44`, background: `${color}14`, color }}
              >
                Signal {index + 1}
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {widgets.length > 0 ? widgets.slice(0, 4).map((widget, index) => (
            <span
              key={`${theme?.id || 'theme'}-widget-${index}`}
              className="inline-flex items-center px-2 py-1 rounded-md text-[10px] font-mono border"
              style={{ borderColor: `${primary}33`, color: muted, background: `${surface}aa` }}
            >
              {typeof widget === 'string' ? widget : widget?.name || `Widget ${index + 1}`}
            </span>
          )) : (
            <span
              className="inline-flex items-center px-2 py-1 rounded-md text-[10px] font-mono border"
              style={{ borderColor: `${primary}22`, color: muted, background: `${surface}aa` }}
            >
              No widgets configured
            </span>
          )}
        </div>

        <div className="rounded-lg border px-3 py-2 text-[10px] font-mono flex items-center justify-between" style={{ borderColor: `${primary}22`, background: footer, color: muted }}>
          <span>{branding?.title || 'Dashboard footer'}</span>
          <span>{layout.footer_enabled === false ? 'Footer Hidden' : 'Footer Visible'}</span>
        </div>

        <div className="rounded-lg border px-3 py-2 text-[10px] font-mono flex items-center justify-between" style={{ borderColor: `${primary}22`, background: footer, color: muted }}>
          <span>Role surfaces</span>
          <span>{Object.keys(roleSurfaces).length ? `${Object.keys(roleSurfaces).length} roles` : 'Default shell'}</span>
        </div>
      </div>
    </div>
  )
}
