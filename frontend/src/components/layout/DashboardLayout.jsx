import Sidebar from './Sidebar'
import Topbar from './Topbar'

export default function DashboardLayout({ children, title, showRange, onRefresh }) {
  return (
    <div className="flex min-h-screen" style={{ background: '#050505' }}>
      <div className="fixed inset-0 pointer-events-none z-0"
        style={{ background: 'radial-gradient(ellipse at 50% 25%, transparent 30%, rgba(0,0,0,0.82) 100%)' }} />
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 relative z-10">
        <Topbar title={title} showRange={showRange} onRefresh={onRefresh} />
        <main className="flex-1 p-6 overflow-auto">{children}</main>
      </div>
    </div>
  )
}
