import { useState, useEffect } from 'react'
import { X } from 'lucide-react'
export { Alert, EmptyState, Spinner } from './extras'

function expandModalWidth(width) {
  const widthMap = {
    'max-w-sm': 'max-w-xl',
    'max-w-md': 'max-w-2xl',
    'max-w-lg': 'max-w-4xl',
    'max-w-xl': 'max-w-5xl',
    'max-w-2xl': 'max-w-6xl',
    'max-w-3xl': 'max-w-7xl',
    'max-w-4xl': 'max-w-[92vw]',
    'max-w-5xl': 'max-w-[94vw]',
    'max-w-6xl': 'max-w-[95vw]',
    'max-w-7xl': 'max-w-[96vw]',
  }
  return widthMap[width] || width
}

// ─── Card ─────────────────────────────────────────────────────────────────────
export function Card({ children, className = '' }) {
  return (
    <div className={`relative overflow-hidden rounded-xl border border-cyan-500/10 ${className}`}
      style={{ background: 'var(--theme-panel-bg)', borderColor: 'var(--theme-panel-border)', boxShadow: '0 10px 30px rgba(0, 0, 0, 0.18)', backdropFilter: 'blur(10px)' }}>
      <div className="absolute inset-0 pointer-events-none rounded-xl"
        style={{ backgroundImage: 'repeating-linear-gradient(0deg,rgba(255,255,255,0.018) 0px,rgba(255,255,255,0.018) 1px,transparent 1px,transparent 4px)' }} />
      <span className="absolute top-0 left-0 w-3 h-3 border-t border-l border-cyan-500/40 z-10 pointer-events-none" />
      <span className="absolute top-0 right-0 w-3 h-3 border-t border-r border-cyan-500/40 z-10 pointer-events-none" />
      <span className="absolute bottom-0 left-0 w-3 h-3 border-b border-l border-cyan-500/40 z-10 pointer-events-none" />
      <span className="absolute bottom-0 right-0 w-3 h-3 border-b border-r border-cyan-500/40 z-10 pointer-events-none" />
      <div className="relative z-[1] h-full p-4 sm:p-5 xl:p-6">{children}</div>
    </div>
  )
}

export function CardHeader({ children, action }) {
  return (
    <div className="flex flex-col gap-3 mb-4 lg:flex-row lg:items-center lg:justify-between">
      <div className="min-w-0">{children}</div>
      {action && <div className="flex max-w-full flex-wrap items-center gap-2 lg:flex-shrink-0 lg:justify-end">{action}</div>}
    </div>
  )
}

// ─── Stat Card ────────────────────────────────────────────────────────────────
const COLORS = {
  cyan:   { t: 'text-cyan-400',   bg: 'bg-cyan-400/10',   b: 'border-cyan-500/25' },
  green:  { t: 'text-green-400',  bg: 'bg-green-400/10',  b: 'border-green-500/25' },
  red:    { t: 'text-red-400',    bg: 'bg-red-400/10',    b: 'border-red-500/25' },
  yellow: { t: 'text-yellow-400', bg: 'bg-yellow-400/10', b: 'border-yellow-500/25' },
  purple: { t: 'text-purple-400', bg: 'bg-purple-400/10', b: 'border-purple-500/25' },
  blue:   { t: 'text-blue-400',   bg: 'bg-blue-400/10',   b: 'border-blue-500/25' },
}

export function StatCard({ label, value, rawValue, change, icon: Icon, color = 'cyan', loading, compact = false, nano = false }) {
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
  const shellClassName = nano ? 'min-h-[2.1rem]' : compact ? 'min-h-[4.4rem]' : ''
  const bodyClassName = nano ? 'p-2 gap-2' : compact ? 'p-3 gap-3' : 'p-4'
  const labelClassName = nano ? 'text-[8px] tracking-[0.14em]' : compact ? 'mb-0.5 text-[9px] tracking-[0.16em]' : 'mb-1 text-[10px] tracking-[0.18em]'
  const valueClassName = nano ? 'text-sm leading-none' : compact ? 'text-lg' : 'text-2xl'
  const changeClassName = nano ? 'text-[8px]' : compact ? 'mt-0.5 text-[9px]' : 'mt-1 text-[10px]'
  const iconWrapClassName = nano ? 'p-1' : compact ? 'p-1.5' : 'p-2'
  const iconSize = nano ? 11 : compact ? 14 : 16

  return (
    <div className={`relative overflow-hidden rounded-lg border ${C.b} ${shellClassName}`}
      style={{ background: 'rgba(0,0,0,0.62)', backdropFilter: 'blur(10px)' }}>
      <div className="absolute inset-0 pointer-events-none"
        style={{ backgroundImage: 'repeating-linear-gradient(0deg,rgba(255,255,255,0.018) 0px,rgba(255,255,255,0.018) 1px,transparent 1px,transparent 4px)' }} />
      <span className="absolute top-0 left-0 w-2 h-2 border-t border-l border-cyan-500/60" />
      <span className="absolute top-0 right-0 w-2 h-2 border-t border-r border-cyan-500/60" />
      <span className="absolute bottom-0 left-0 w-2 h-2 border-b border-l border-cyan-500/60" />
      <span className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-cyan-500/60" />
      <div className={`relative z-[1] flex items-center justify-between ${bodyClassName}`}>
        <div>
          <p className={`font-mono uppercase text-gray-500 ${labelClassName}`}>{label}</p>
          {loading ? (
            <div className={`${nano ? 'h-4 w-12' : compact ? 'h-6 w-16' : 'h-7 w-20'} rounded bg-gray-800/60 animate-pulse`} />
          ) : (
            <p key={displayStr} className={`${valueClassName} font-mono font-bold ${C.t} animate-count-slide`}>
              {displayStr}
            </p>
          )}
          {change !== undefined && !loading && !nano && (
            <p className={`font-mono ${changeClassName} ${isPositive ? 'text-green-400' : 'text-red-400'}`}>
              {isPositive ? '▲' : '▼'} {Math.abs(change)}%
            </p>
          )}
        </div>
        {Icon && (
          <div className={`${iconWrapClassName} rounded-md ${C.bg} border ${C.b} flex-shrink-0`}>
            <Icon size={iconSize} className={C.t} />
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
      className={`inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg font-medium transition disabled:opacity-40 disabled:cursor-not-allowed ${btnVariants[variant]} ${sizes[size]} ${className}`}
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
    <div className="overflow-x-auto overscroll-x-contain rounded-xl border border-cyan-500/10">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="border-b border-cyan-500/10" style={{ background: 'var(--theme-panel-soft)', borderColor: 'var(--theme-panel-border)' }}>
            {columns.map((col) => (
              <th key={col.key} className="px-4 py-3 text-left text-[10px] font-mono font-medium text-gray-500 uppercase tracking-widest xl:px-5"
                style={col.width ? { width: col.width } : {}}>
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.length === 0 ? (
            <tr><td colSpan={columns.length} className="px-4 py-10 text-center text-gray-600 font-mono text-xs xl:px-5">
              {emptyMessage}
            </td></tr>
          ) : data.map((row, i) => (
            <tr key={row.id ?? i} onClick={() => onRowClick?.(row)}
              className={`border-b border-cyan-500/5 transition ${onRowClick ? 'cursor-pointer hover:bg-cyan-500/4' : ''}`}>
              {columns.map((col) => (
                <td key={col.key} className="px-4 py-3 align-top text-gray-300 xl:px-5">
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
    <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-xs text-gray-600 font-mono">
        {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} / {total}
      </p>
      <div className="flex flex-wrap gap-1">
        <Button variant="secondary" size="sm" disabled={page === 1} onClick={() => onChange(page - 1)}>Prev</Button>
        <Button variant="secondary" size="sm" disabled={page === totalPages} onClick={() => onChange(page + 1)}>Next</Button>
      </div>
    </div>
  )
}

export function PageToolbar({ children, className = '' }) {
  return (
    <div className={`mb-5 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between ${className}`}>
      {children}
    </div>
  )
}

export function SegmentedTabs({ items, value, onChange, className = '' }) {
  return (
    <div className={`inline-flex max-w-full flex-wrap gap-1 rounded-xl border border-cyan-500/10 bg-black/35 p-1 ${className}`}>
      {items.map((item) => (
        <button
          key={item.value}
          type="button"
          onClick={() => onChange(item.value)}
          className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
            value === item.value
              ? 'border border-cyan-500/40 bg-cyan-500/15 text-cyan-300'
              : 'border border-transparent text-gray-400 hover:bg-cyan-500/5 hover:text-gray-200'
          }`}
        >
          {item.label}
        </button>
      ))}
    </div>
  )
}

// ─── Modal ────────────────────────────────────────────────────────────────────
export function Modal({
  open,
  onClose,
  title,
  children,
  width = 'max-w-lg',
  panelClassName = '',
  bodyClassName = '',
  fullHeight = false,
}) {
  useEffect(() => {
    if (!open) return undefined
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') onClose?.()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [open, onClose])

  if (!open) return null
  const expandedWidth = expandModalWidth(width)
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto p-3 sm:p-4 lg:p-6">
      <div className="fixed inset-0 bg-black/70 backdrop-blur-sm" onMouseDown={onClose} />
      <div
        className={`relative min-h-full flex justify-center ${fullHeight ? 'items-stretch' : 'items-center'}`}
        onMouseDown={(event) => {
          if (event.target === event.currentTarget) onClose?.()
        }}
      >
        <div
          className={`relative w-full ${expandedWidth} flex flex-col overflow-hidden rounded-2xl border border-cyan-500/15 shadow-2xl ${fullHeight ? 'h-[calc(100dvh-1.5rem)] sm:h-[calc(100dvh-2rem)] lg:h-[calc(100dvh-3rem)]' : 'max-h-[calc(100dvh-1.5rem)] sm:max-h-[calc(100dvh-2rem)]'} ${panelClassName}`}
          style={{ background: 'var(--theme-panel)', borderColor: 'var(--theme-panel-border)', boxShadow: '0 20px 48px rgba(0, 0, 0, 0.35)', backdropFilter: 'blur(16px)' }}
          onMouseDown={(event) => event.stopPropagation()}
        >
          <span className="absolute top-0 left-0 w-4 h-4 border-t border-l border-cyan-500/50 rounded-tl-2xl" />
          <span className="absolute top-0 right-0 w-4 h-4 border-t border-r border-cyan-500/50 rounded-tr-2xl" />
          <span className="absolute bottom-0 left-0 w-4 h-4 border-b border-l border-cyan-500/50 rounded-bl-2xl" />
          <span className="absolute bottom-0 right-0 w-4 h-4 border-b border-r border-cyan-500/50 rounded-br-2xl" />
          <div
            className="sticky top-0 z-10 flex items-center justify-between gap-4 px-4 py-4 sm:px-6 border-b border-cyan-500/10"
            style={{ background: 'var(--theme-panel)', borderColor: 'var(--theme-panel-border)' }}
          >
            <h2 className="min-w-0 truncate text-sm font-mono font-semibold text-cyan-400 uppercase tracking-widest">{title}</h2>
            <button onClick={onClose} className="p-1 rounded hover:bg-cyan-500/10 text-gray-500 hover:text-cyan-400 transition flex-shrink-0">
              <X size={16} />
            </button>
          </div>
          <div className={`min-h-0 flex-1 overflow-y-auto px-4 pb-4 pt-4 sm:px-6 sm:pb-6 ${bodyClassName}`}>
            {children}
          </div>
        </div>
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
        className={`w-full border rounded-lg px-3 py-2 text-sm text-gray-200 font-mono placeholder-gray-600 focus:outline-none focus:border-cyan-500/60 hover:border-cyan-500/30 transition ${error ? 'border-red-500/50' : 'border-cyan-500/15'} ${className}`}
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
export function Toggle({ checked, onChange, label, description, disabled = false }) {
  return (
    <div className={`flex items-center justify-between gap-3 py-3 ${disabled ? 'opacity-60' : ''}`}>
      <div>
        {label && <p className="text-sm font-mono font-medium text-gray-300">{label}</p>}
        {description && <p className="text-xs text-gray-600 mt-0.5 font-mono">{description}</p>}
      </div>
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && onChange(!checked)}
        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
          checked ? 'bg-cyan-500' : 'bg-gray-800 border border-gray-700'
        } ${disabled ? 'cursor-not-allowed' : ''}`}
      >
        <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${checked ? 'translate-x-5' : 'translate-x-1'}`} />
      </button>
    </div>
  )
}
