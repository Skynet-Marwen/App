import { useState, useEffect } from 'react'
import { X } from 'lucide-react'
export { Alert, EmptyState, Spinner } from './extras'

// ─── Card ─────────────────────────────────────────────────────────────────────
export function Card({ children, className = '' }) {
  return (
    <div className={`relative overflow-hidden rounded-xl border border-cyan-500/10 animate-border-breathe ${className}`}
      style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(10px)' }}>
      <div className="absolute inset-0 pointer-events-none rounded-xl"
        style={{ backgroundImage: 'repeating-linear-gradient(0deg,rgba(255,255,255,0.018) 0px,rgba(255,255,255,0.018) 1px,transparent 1px,transparent 4px)' }} />
      <span className="absolute top-0 left-0 w-3 h-3 border-t border-l border-cyan-500/40 z-10 pointer-events-none" />
      <span className="absolute top-0 right-0 w-3 h-3 border-t border-r border-cyan-500/40 z-10 pointer-events-none" />
      <span className="absolute bottom-0 left-0 w-3 h-3 border-b border-l border-cyan-500/40 z-10 pointer-events-none" />
      <span className="absolute bottom-0 right-0 w-3 h-3 border-b border-r border-cyan-500/40 z-10 pointer-events-none" />
      <div className="p-5 relative z-[1]">{children}</div>
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
const COLORS = {
  cyan:   { t: 'text-cyan-400',   bg: 'bg-cyan-400/10',   b: 'border-cyan-500/25',   glow: 'rgba(6,182,212,0.45)' },
  green:  { t: 'text-green-400',  bg: 'bg-green-400/10',  b: 'border-green-500/25',  glow: 'rgba(34,197,94,0.45)' },
  red:    { t: 'text-red-400',    bg: 'bg-red-400/10',    b: 'border-red-500/25',    glow: 'rgba(239,68,68,0.45)' },
  yellow: { t: 'text-yellow-400', bg: 'bg-yellow-400/10', b: 'border-yellow-500/25', glow: 'rgba(234,179,8,0.45)' },
  purple: { t: 'text-purple-400', bg: 'bg-purple-400/10', b: 'border-purple-500/25', glow: 'rgba(168,85,247,0.45)' },
  blue:   { t: 'text-blue-400',   bg: 'bg-blue-400/10',   b: 'border-blue-500/25',   glow: 'rgba(96,165,250,0.45)' },
}

export function StatCard({ label, value, rawValue, change, icon: Icon, color = 'cyan', loading }) {
  const [displayed, setDisplayed] = useState(0)

  useEffect(() => {
    if (typeof rawValue !== 'number' || loading) return
    const end = rawValue
    const duration = 700
    const startTime = performance.now()
    const tick = (now) => {
      const t = Math.min((now - startTime) / duration, 1)
      const ease = 1 - Math.pow(1 - t, 3)
      setDisplayed(Math.round(end * ease))
      if (t < 1) requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  }, [rawValue, loading])

  const C = COLORS[color]
  const isPositive = typeof change === 'number' ? change >= 0 : null
  const displayStr = typeof rawValue === 'number' && !loading ? displayed.toLocaleString() : value

  return (
    <div className={`relative overflow-hidden rounded-xl border ${C.b} animate-border-breathe`}
      style={{ background: 'rgba(0,0,0,0.62)', backdropFilter: 'blur(10px)' }}>
      <div className="absolute inset-0 pointer-events-none"
        style={{ backgroundImage: 'repeating-linear-gradient(0deg,rgba(255,255,255,0.018) 0px,rgba(255,255,255,0.018) 1px,transparent 1px,transparent 4px)' }} />
      <span className="absolute top-0 left-0 w-2.5 h-2.5 border-t border-l border-cyan-500/60" />
      <span className="absolute top-0 right-0 w-2.5 h-2.5 border-t border-r border-cyan-500/60" />
      <span className="absolute bottom-0 left-0 w-2.5 h-2.5 border-b border-l border-cyan-500/60" />
      <span className="absolute bottom-0 right-0 w-2.5 h-2.5 border-b border-r border-cyan-500/60" />
      <div className="relative p-4 flex items-start justify-between z-[1]">
        <div>
          <p className="text-[10px] text-gray-500 mb-1 uppercase tracking-[0.18em] font-mono">{label}</p>
          {loading ? (
            <div className="h-7 w-20 bg-gray-800/60 rounded animate-pulse" />
          ) : (
            <p key={displayStr} className={`text-2xl font-bold font-mono ${C.t} neon-text-cyan animate-count-slide`}>
              {displayStr}
            </p>
          )}
          {change !== undefined && !loading && (
            <p className={`text-[10px] mt-1 font-mono ${isPositive ? 'text-green-400' : 'text-red-400'}`}>
              {isPositive ? '▲' : '▼'} {Math.abs(change)}%
            </p>
          )}
        </div>
        {Icon && (
          <div className={`p-2 rounded-lg ${C.bg} border ${C.b} flex-shrink-0`}
            style={{ boxShadow: `0 0 14px ${C.glow}` }}>
            <Icon size={16} className={C.t} />
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Badge ────────────────────────────────────────────────────────────────────
const badgeVariants = {
  default: 'bg-gray-800/80 text-gray-300 border border-gray-700/50',
  success: 'bg-green-500/10 text-green-400 border border-green-500/25',
  danger:  'bg-red-500/10  text-red-400  border border-red-500/25',
  warning: 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/25',
  info:    'bg-cyan-500/10 text-cyan-400 border border-cyan-500/25',
  purple:  'bg-purple-500/10 text-purple-400 border border-purple-500/25',
}

export function Badge({ children, variant = 'default', className = '' }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-mono font-medium ${badgeVariants[variant]} ${className}`}>
      {children}
    </span>
  )
}

// ─── Button ───────────────────────────────────────────────────────────────────
const btnVariants = {
  primary:   'bg-cyan-500 hover:bg-cyan-400 text-white font-mono',
  secondary: 'bg-black/60 hover:bg-black/80 text-gray-300 border border-gray-700/60 font-mono',
  danger:    'bg-red-500/15 hover:bg-red-500/25 text-red-400 border border-red-500/30 font-mono',
  ghost:     'hover:bg-cyan-500/5 text-gray-500 hover:text-gray-200 font-mono',
  neon:      'bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 font-mono',
}

export function Button({ children, variant = 'primary', size = 'md', className = '', loading, icon: Icon, ...props }) {
  const sizes = { sm: 'px-3 py-1.5 text-xs', md: 'px-4 py-2 text-sm', lg: 'px-5 py-2.5 text-base' }
  return (
    <button
      className={`inline-flex items-center gap-2 rounded-lg font-medium transition disabled:opacity-40 disabled:cursor-not-allowed ${btnVariants[variant]} ${sizes[size]} ${className}`}
      disabled={loading || props.disabled}
      {...props}
    >
      {loading ? (
        <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
      ) : Icon ? <Icon size={14} /> : null}
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
          <div key={i} className="h-12 bg-black/40 rounded-lg animate-pulse border border-cyan-500/5" />
        ))}
      </div>
    )
  }
  return (
    <div className="overflow-x-auto rounded-xl border border-cyan-500/10">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-cyan-500/10" style={{ background: 'rgba(0,0,0,0.4)' }}>
            {columns.map((col) => (
              <th key={col.key} className="px-4 py-3 text-left text-[10px] font-mono font-medium text-gray-500 uppercase tracking-widest"
                style={col.width ? { width: col.width } : {}}>
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.length === 0 ? (
            <tr><td colSpan={columns.length} className="px-4 py-10 text-center text-gray-600 font-mono text-xs">
              {emptyMessage}
            </td></tr>
          ) : data.map((row, i) => (
            <tr key={row.id ?? i} onClick={() => onRowClick?.(row)}
              className={`border-b border-cyan-500/5 transition ${onRowClick ? 'cursor-pointer hover:bg-cyan-500/4' : ''}`}>
              {columns.map((col) => (
                <td key={col.key} className="px-4 py-3 text-gray-300">
                  {col.render ? col.render(row[col.key], row) : row[col.key]}
                </td>
              ))}
            </tr>
          ))}
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
      <p className="text-xs text-gray-600 font-mono">
        {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} / {total}
      </p>
      <div className="flex gap-1">
        <Button variant="secondary" size="sm" disabled={page === 1} onClick={() => onChange(page - 1)}>Prev</Button>
        <Button variant="secondary" size="sm" disabled={page === totalPages} onClick={() => onChange(page + 1)}>Next</Button>
      </div>
    </div>
  )
}

// ─── Modal ────────────────────────────────────────────────────────────────────
export function Modal({ open, onClose, title, children, width = 'max-w-lg' }) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className={`relative w-full ${width} shadow-2xl rounded-2xl border border-cyan-500/15`}
        style={{ background: 'rgba(4,4,4,0.96)', backdropFilter: 'blur(16px)' }}>
        <span className="absolute top-0 left-0 w-4 h-4 border-t border-l border-cyan-500/50 rounded-tl-2xl" />
        <span className="absolute top-0 right-0 w-4 h-4 border-t border-r border-cyan-500/50 rounded-tr-2xl" />
        <span className="absolute bottom-0 left-0 w-4 h-4 border-b border-l border-cyan-500/50 rounded-bl-2xl" />
        <span className="absolute bottom-0 right-0 w-4 h-4 border-b border-r border-cyan-500/50 rounded-br-2xl" />
        <div className="flex items-center justify-between px-6 py-4 border-b border-cyan-500/10">
          <h2 className="text-sm font-mono font-semibold text-cyan-400 uppercase tracking-widest">{title}</h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-cyan-500/10 text-gray-500 hover:text-cyan-400 transition">
            <X size={16} />
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
      {label && <label className="block text-xs text-gray-500 font-mono uppercase tracking-wider">{label}</label>}
      <input
        className={`w-full border rounded-lg px-3 py-2 text-sm text-gray-200 font-mono placeholder-gray-600 focus:outline-none focus:border-cyan-500/60 transition ${error ? 'border-red-500/50' : 'border-cyan-500/15'} ${className}`}
        style={{ background: 'rgba(0,0,0,0.6)' }}
        {...props}
      />
      {error && <p className="text-xs text-red-400 font-mono">{error}</p>}
    </div>
  )
}

// ─── Select ───────────────────────────────────────────────────────────────────
export function Select({ label, error, options = [], className = '', ...props }) {
  return (
    <div className="space-y-1.5">
      {label && <label className="block text-xs text-gray-500 font-mono uppercase tracking-wider">{label}</label>}
      <select
        className={`w-full border rounded-lg px-3 py-2 text-sm text-gray-200 font-mono focus:outline-none focus:border-cyan-500/60 transition ${error ? 'border-red-500/50' : 'border-cyan-500/15'} ${className}`}
        style={{ background: 'rgba(0,0,0,0.8)' }}
        {...props}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
      {error && <p className="text-xs text-red-400 font-mono">{error}</p>}
    </div>
  )
}

// ─── Toggle ───────────────────────────────────────────────────────────────────
export function Toggle({ checked, onChange, label, description }) {
  return (
    <div className="flex items-center justify-between py-3">
      <div>
        {label && <p className="text-sm font-mono font-medium text-gray-300">{label}</p>}
        {description && <p className="text-xs text-gray-600 mt-0.5 font-mono">{description}</p>}
      </div>
      <button type="button" onClick={() => onChange(!checked)}
        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${checked ? 'bg-cyan-500' : 'bg-gray-800 border border-gray-700'}`}>
        <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${checked ? 'translate-x-5' : 'translate-x-1'}`} />
      </button>
    </div>
  )
}
