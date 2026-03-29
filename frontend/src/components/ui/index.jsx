// ─── Card ─────────────────────────────────────────────────────────────────────
export function Card({ children, className = '' }) {
  return (
    <div className={`bg-gray-900 border border-gray-800 rounded-xl p-5 ${className}`}>
      {children}
    </div>
  )
}

export function CardHeader({ children, action }) {
  return (
    <div className="flex items-center justify-between mb-4">
      <div>{children}</div>
      {action && <div>{action}</div>}
    </div>
  )
}

// ─── Stat Card ────────────────────────────────────────────────────────────────
export function StatCard({ label, value, change, icon: Icon, color = 'cyan', loading }) {
  const colors = {
    cyan: 'text-cyan-400 bg-cyan-400/10',
    green: 'text-green-400 bg-green-400/10',
    red: 'text-red-400 bg-red-400/10',
    yellow: 'text-yellow-400 bg-yellow-400/10',
    purple: 'text-purple-400 bg-purple-400/10',
    blue: 'text-blue-400 bg-blue-400/10',
  }
  const isPositive = typeof change === 'number' ? change >= 0 : null

  return (
    <Card>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-gray-400 mb-1">{label}</p>
          {loading ? (
            <div className="h-7 w-20 bg-gray-800 rounded animate-pulse" />
          ) : (
            <p className="text-2xl font-bold text-white">{value}</p>
          )}
          {change !== undefined && !loading && (
            <p className={`text-xs mt-1 ${isPositive ? 'text-green-400' : 'text-red-400'}`}>
              {isPositive ? '↑' : '↓'} {Math.abs(change)}% vs previous
            </p>
          )}
        </div>
        {Icon && (
          <div className={`p-2.5 rounded-lg ${colors[color]}`}>
            <Icon size={20} />
          </div>
        )}
      </div>
    </Card>
  )
}

// ─── Badge ────────────────────────────────────────────────────────────────────
const badgeVariants = {
  default: 'bg-gray-700 text-gray-300',
  success: 'bg-green-500/15 text-green-400 border border-green-500/20',
  danger: 'bg-red-500/15 text-red-400 border border-red-500/20',
  warning: 'bg-yellow-500/15 text-yellow-400 border border-yellow-500/20',
  info: 'bg-cyan-500/15 text-cyan-400 border border-cyan-500/20',
  purple: 'bg-purple-500/15 text-purple-400 border border-purple-500/20',
}

export function Badge({ children, variant = 'default', className = '' }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium ${badgeVariants[variant]} ${className}`}>
      {children}
    </span>
  )
}

// ─── Button ───────────────────────────────────────────────────────────────────
const btnVariants = {
  primary: 'bg-cyan-500 hover:bg-cyan-400 text-white',
  secondary: 'bg-gray-800 hover:bg-gray-700 text-gray-200 border border-gray-700',
  danger: 'bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/30',
  ghost: 'hover:bg-gray-800 text-gray-400 hover:text-white',
}

export function Button({ children, variant = 'primary', size = 'md', className = '', loading, icon: Icon, ...props }) {
  const sizes = { sm: 'px-3 py-1.5 text-xs', md: 'px-4 py-2 text-sm', lg: 'px-5 py-2.5 text-base' }
  return (
    <button
      className={`inline-flex items-center gap-2 rounded-lg font-medium transition disabled:opacity-50 disabled:cursor-not-allowed ${btnVariants[variant]} ${sizes[size]} ${className}`}
      disabled={loading || props.disabled}
      {...props}
    >
      {loading ? (
        <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
      ) : Icon ? (
        <Icon size={15} />
      ) : null}
      {children}
    </button>
  )
}

// ─── Table ────────────────────────────────────────────────────────────────────
export function Table({ columns, data, loading, emptyMessage = 'No data found', onRowClick }) {
  if (loading) {
    return (
      <div className="space-y-2">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-12 bg-gray-800 rounded-lg animate-pulse" />
        ))}
      </div>
    )
  }
  return (
    <div className="overflow-x-auto rounded-xl border border-gray-800">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-800">
            {columns.map((col) => (
              <th
                key={col.key}
                className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider"
                style={col.width ? { width: col.width } : {}}
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="px-4 py-10 text-center text-gray-500">
                {emptyMessage}
              </td>
            </tr>
          ) : (
            data.map((row, i) => (
              <tr
                key={row.id ?? i}
                onClick={() => onRowClick?.(row)}
                className={`border-b border-gray-800/50 transition ${
                  onRowClick ? 'cursor-pointer hover:bg-gray-800/50' : ''
                }`}
              >
                {columns.map((col) => (
                  <td key={col.key} className="px-4 py-3 text-gray-300">
                    {col.render ? col.render(row[col.key], row) : row[col.key]}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}

// ─── Pagination ───────────────────────────────────────────────────────────────
export function Pagination({ page, total, pageSize = 20, onChange }) {
  const totalPages = Math.ceil(total / pageSize)
  if (totalPages <= 1) return null
  return (
    <div className="flex items-center justify-between mt-4">
      <p className="text-xs text-gray-500">
        Showing {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} of {total}
      </p>
      <div className="flex gap-1">
        <Button variant="secondary" size="sm" disabled={page === 1} onClick={() => onChange(page - 1)}>
          Prev
        </Button>
        <Button variant="secondary" size="sm" disabled={page === totalPages} onClick={() => onChange(page + 1)}>
          Next
        </Button>
      </div>
    </div>
  )
}

// ─── Modal ────────────────────────────────────────────────────────────────────
import { X } from 'lucide-react'

export function Modal({ open, onClose, title, children, width = 'max-w-lg' }) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className={`relative bg-gray-900 border border-gray-700 rounded-2xl w-full ${width} shadow-2xl`}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
          <h2 className="text-base font-semibold text-white">{title}</h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-gray-800 text-gray-400 hover:text-white transition">
            <X size={18} />
          </button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  )
}

// ─── Input ────────────────────────────────────────────────────────────────────
export function Input({ label, error, className = '', ...props }) {
  return (
    <div className="space-y-1.5">
      {label && <label className="block text-sm text-gray-400">{label}</label>}
      <input
        className={`w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500 transition ${error ? 'border-red-500' : ''} ${className}`}
        {...props}
      />
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  )
}

// ─── Select ───────────────────────────────────────────────────────────────────
export function Select({ label, error, options = [], className = '', ...props }) {
  return (
    <div className="space-y-1.5">
      {label && <label className="block text-sm text-gray-400">{label}</label>}
      <select
        className={`w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500 transition ${error ? 'border-red-500' : ''} ${className}`}
        {...props}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  )
}

// ─── Toggle ───────────────────────────────────────────────────────────────────
export function Toggle({ checked, onChange, label, description }) {
  return (
    <div className="flex items-center justify-between py-3">
      <div>
        {label && <p className="text-sm font-medium text-white">{label}</p>}
        {description && <p className="text-xs text-gray-400 mt-0.5">{description}</p>}
      </div>
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
          checked ? 'bg-cyan-500' : 'bg-gray-700'
        }`}
      >
        <span
          className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
            checked ? 'translate-x-5' : 'translate-x-1'
          }`}
        />
      </button>
    </div>
  )
}

// ─── Alert ────────────────────────────────────────────────────────────────────
export function Alert({ type = 'info', children }) {
  const styles = {
    info: 'bg-cyan-500/10 border-cyan-500/20 text-cyan-300',
    warning: 'bg-yellow-500/10 border-yellow-500/20 text-yellow-300',
    danger: 'bg-red-500/10 border-red-500/20 text-red-300',
    success: 'bg-green-500/10 border-green-500/20 text-green-300',
  }
  return (
    <div className={`flex gap-3 p-4 rounded-lg border text-sm ${styles[type]}`}>
      {children}
    </div>
  )
}

// ─── Empty State ──────────────────────────────────────────────────────────────
export function EmptyState({ icon: Icon, title, description, action }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      {Icon && (
        <div className="p-4 bg-gray-800 rounded-full mb-4">
          <Icon size={28} className="text-gray-500" />
        </div>
      )}
      <p className="text-base font-medium text-white mb-1">{title}</p>
      {description && <p className="text-sm text-gray-500 max-w-xs">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

// ─── Spinner ──────────────────────────────────────────────────────────────────
export function Spinner({ size = 6 }) {
  return (
    <div className={`w-${size} h-${size} border-2 border-cyan-500 border-t-transparent rounded-full animate-spin`} />
  )
}
