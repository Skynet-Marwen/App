import { useAuthStore } from '../../store/useAppStore'
import { useThemeStore } from '../../store/themeStore'

export default function DashboardFooter() {
  const user = useAuthStore((state) => state.user)
  const currentTheme = useThemeStore((state) => state.currentTheme)
  const branding = currentTheme?.branding || {}
  const layout = currentTheme?.layout || {}

  if (layout.footer_enabled === false) return null

  return (
    <footer
      className="border-t flex-shrink-0 text-xs font-mono"
      style={{
        background: 'var(--theme-footer-bg)',
        borderColor: 'var(--theme-footer-border)',
        color: 'var(--theme-footer-text)',
      }}
    >
      <div className="mx-auto flex w-full max-w-[1720px] flex-col gap-3 px-4 py-3 sm:px-5 lg:flex-row lg:items-center lg:justify-between lg:px-6 xl:px-8">
        <div className="flex min-w-0 items-center gap-3">
          {branding.logo_url ? (
            <img
              src={branding.logo_url}
              alt=""
              className="h-6 w-6 rounded-md object-cover border border-white/10"
            />
          ) : null}
          <div className="min-w-0">
            <p className="truncate">{branding.company_name || branding.logo_text || 'SkyNet'}</p>
            <p className="truncate opacity-70">{branding.tagline || 'Runtime theme engine active'}</p>
          </div>
        </div>
        <div className="text-left lg:text-right">
          <p>{currentTheme?.name || 'Default Theme'}</p>
          <p className="opacity-70">{user?.username || user?.email || 'Operator session'}</p>
        </div>
      </div>
    </footer>
  )
}
