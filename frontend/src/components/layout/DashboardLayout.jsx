import Sidebar from './Sidebar'
import DashboardFooter from './DashboardFooter'
import OnboardingWizard from './OnboardingWizard'
import Topbar from './Topbar'

export default function DashboardLayout({ children, title, showRange, onRefresh, fullWidth = false }) {
  return (
    <div className="flex h-screen overflow-hidden" style={{ background: 'var(--theme-body-bg)' }}>
      <div className="fixed inset-0 pointer-events-none z-0"
        style={{ background: 'var(--theme-body-gradient)' }} />
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden relative z-10">
        <Topbar title={title} showRange={showRange} onRefresh={onRefresh} />
        <main
          className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden"
          style={{ padding: 'calc(1rem * var(--theme-density-scale)) calc(1rem * var(--theme-density-scale)) calc(1.25rem * var(--theme-density-scale))' }}
        >
          <div className={`mx-auto flex w-full flex-col gap-4 sm:gap-5 xl:gap-6 ${fullWidth ? 'max-w-none' : 'max-w-[1720px]'}`}>
            {children}
          </div>
        </main>
        <DashboardFooter />
        <OnboardingWizard />
      </div>
    </div>
  )
}
