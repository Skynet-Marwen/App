// Alert, EmptyState, Spinner — extracted from index.jsx to keep it under 300 lines

// ─── Alert ────────────────────────────────────────────────────────────────────
export function Alert({ type = 'info', children }) {
  const styles = {
    info: 'bg-cyan-500/10 border-cyan-500/20 text-cyan-300',
    warning: 'bg-yellow-500/10 border-yellow-500/20 text-yellow-300',
    danger: 'bg-red-500/10 border-red-500/20 text-red-300',
    success: 'bg-green-500/10 border-green-500/20 text-green-300',
  }
  return (
    <div className={`flex gap-3 p-4 rounded-lg border text-sm font-mono ${styles[type]}`}>
      {children}
    </div>
  )
}

// ─── Empty State ──────────────────────────────────────────────────────────────
export function EmptyState({ icon: Icon, title, description, action }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      {Icon && (
        <div className="p-4 bg-black/40 border border-cyan-500/10 rounded-full mb-4">
          <Icon size={28} className="text-cyan-500/40" />
        </div>
      )}
      <p className="text-sm font-mono font-medium text-gray-400 mb-1">{title}</p>
      {description && <p className="text-xs text-gray-600 max-w-xs font-mono">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

// ─── Spinner ──────────────────────────────────────────────────────────────────
export function Spinner({ size = 6 }) {
  return (
    <div className={`w-${size} h-${size} border-2 border-cyan-500/30 border-t-cyan-400 rounded-full animate-spin`} />
  )
}
