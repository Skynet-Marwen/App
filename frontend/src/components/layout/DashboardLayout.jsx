import Sidebar from './Sidebar'
import Topbar from './Topbar'

export default function DashboardLayout({ children, title, showRange, onRefresh }) {
  return (
    <div className="flex min-h-screen bg-gray-950">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar title={title} showRange={showRange} onRefresh={onRefresh} />
        <main className="flex-1 p-6 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  )
}
