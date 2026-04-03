import Sidebar from './Sidebar'
import DashboardFooter from './DashboardFooter'
import OnboardingWizard from './OnboardingWizard'
import Topbar from './Topbar'
import { useThemeStore } from '../../store/themeStore'
import { getThemeContentWidthClass } from '../../services/themeEngine'

export default function DashboardLayout({ children, title, showRange, onRefresh, fullWidth = false }) {
  const currentTheme = useThemeStore((state) => state.currentTheme)
  const layout = currentTheme?.layout || {}
  const shellMode = layout.shell_mode || 'fixed'
  const contentWidthClass = getThemeContentWidthClass(layout, fullWidth)
  const mainPadding = layout.density === 'compact'
    ? '0.85rem'
    : layout.density === 'spacious'
      ? '1.25rem'
      : '1rem'

  return (
    <div className={`flex ${shellMode === 'document' ? 'min-h-screen' : 'h-screen overflow-hidden'}`} style={{ background: 'var(--theme-body-bg)' }}>
      <div className="fixed inset-0 pointer-events-none z-0"
        style={{ background: 'var(--theme-body-gradient)' }} />
      <Sidebar />
      <div className={`flex-1 flex flex-col min-w-0 relative z-10 ${shellMode === 'document' ? '' : 'h-screen overflow-hidden'}`}>
        <Topbar title={title} showRange={showRange} onRefresh={onRefresh} />
        <main
          className={shellMode === 'document' ? 'flex-1 overflow-visible' : 'flex-1 min-h-0 overflow-y-auto overflow-x-hidden'}
          style={{ padding: `${mainPadding} ${mainPadding} calc(${mainPadding} * 1.25)` }}
        >
          <div className={`mx-auto flex w-full flex-col gap-4 sm:gap-5 xl:gap-6 ${contentWidthClass}`}>
            {children}
          </div>
        </main>
        <DashboardFooter />
        <OnboardingWizard />
      </div>
    </div>
  )
}
