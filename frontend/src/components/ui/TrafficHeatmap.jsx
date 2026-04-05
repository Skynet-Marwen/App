import { useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import './TrafficHeatmap.css'

// 7d (24×7) is the visual reference — all modes occupy this exact space
const GRID_RATIO = '24 / 7'

const TIME_MODES = {
  '1h':  { cols: 10, rows: 6, total: 60,  label: '1 cell = 1 min' },
  '24h': { cols: 16, rows: 6, total: 96,  label: '1 cell = 15 min' },
  '7d':  { cols: 24, rows: 7, total: 168, label: '1 cell = 1 hour' },
  '30d': { cols: 7,           total: 30,  label: '1 cell = 1 day', calendar: true },
}

const DOW_HDR  = ['S', 'M', 'T', 'W', 'T', 'F', 'S']
const DAY_ABBR = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function cellColor(intensity) {
  if (intensity === 0) return 'rgba(3,8,20,0.22)'
  const eased = Math.pow(intensity, 0.82)
  const r = Math.round(4 + eased * 18)
  const g = Math.round(11 + eased * 171)
  const b = Math.round(24 + eased * 188)
  const alpha = (0.24 + eased * 0.58).toFixed(2)
  return `rgba(${r},${g},${b},${alpha})`
}

function cellGlow(intensity) {
  if (intensity <= 0) return 'none'
  const alpha = (0.1 + intensity * 0.42).toFixed(2)
  const spread = Math.round(5 + intensity * 12)
  return `0 0 ${spread}px rgba(6,182,212,${alpha})`
}

function cellHoverGlow(intensity) {
  const alpha = (0.42 + intensity * 0.5).toFixed(2)
  const spread = Math.round(12 + intensity * 16)
  return `0 0 ${spread}px rgba(34,211,238,${alpha})`
}

// ─── Container layer ──────────────────────────────────────────────────────────
export function TrafficHeatmap({ data, range, className = '', compact = false, fill = false }) {
  const mode = TIME_MODES[range] || TIME_MODES['24h']
  const [tip, setTip] = useState(null)
  const ratio = compact ? '24 / 3.2' : GRID_RATIO

  const { normalized, calOffset } = useMemo(() => {
    if (!data?.length) return { normalized: [], calOffset: 0 }
    const max = Math.max(...data.map(d => d.count || 0), 1)
    const calOffset = mode.calendar
      ? new Date(data[0].timestamp.replace(' ', 'T') + 'Z').getDay()
      : 0
    return {
      normalized: data.map(d => ({ ...d, intensity: (d.count || 0) / max })),
      calOffset,
    }
  }, [data, mode.calendar])

  const totalHits = useMemo(
    () => (data || []).reduce((s, d) => s + (d.count || 0), 0),
    [data]
  )
  const peakCount = useMemo(
    () => Math.max(...(data || []).map(d => d.count || 0), 0),
    [data]
  )

  if (!data?.length) {
    return (
      <div className={`flex items-center justify-center text-xs font-mono text-gray-700 ${className}`}
        style={fill ? { width: '100%', height: '100%' } : { aspectRatio: ratio }}>
        // NO DATA
      </div>
    )
  }

  if (fill) {
    return (
      <div className={`traffic-heatmap flex min-h-0 flex-col ${className}`}>
        {/* Meta strip */}
        <div className="mb-1.5 flex shrink-0 items-center gap-2 font-mono text-[9px]">
          <span className="text-gray-600">
            TOTAL <span className="text-cyan-400">{totalHits.toLocaleString()}</span>
          </span>
          {peakCount > 0 && (
            <span className="text-gray-600">
              PEAK <span className="text-cyan-400">{peakCount.toLocaleString()}</span>
            </span>
          )}
          <span className="ml-auto uppercase tracking-widest text-gray-700">{mode.label}</span>
        </div>
        {/* Grid fills remaining height, cells stay square */}
        <HeatmapGrid
          data={normalized}
          mode={mode}
          calOffset={calOffset}
          range={range}
          setTip={setTip}
          compact
          fill
        />
        {tip && createPortal(
          <div style={{ position: 'fixed', left: tip.x + 16, top: tip.y - 58, zIndex: 9999, pointerEvents: 'none' }}>
            <div style={{ background: 'rgba(2,6,23,0.97)', backdropFilter: 'blur(8px)', border: '1px solid rgba(6,182,212,0.25)', borderRadius: '4px', padding: '6px 10px', fontFamily: 'monospace', fontSize: '10px', lineHeight: '1.5', whiteSpace: 'nowrap' }}>
              <div style={{ color: '#6b7280', marginBottom: '2px' }}>{tip.ts}</div>
              <div style={{ color: '#22d3ee', fontWeight: 700 }}>{tip.count.toLocaleString()} requests</div>
            </div>
          </div>,
          document.body
        )}
      </div>
    )
  }

  return (
    <div className={`traffic-heatmap ${className}`}>

      {/* Meta row */}
      <div className={`flex items-center font-mono ${compact ? 'mb-2 gap-2 text-[9px]' : 'mb-3 gap-3 text-[10px]'}`}>
        <span className="text-gray-600">
          TOTAL <span className="text-cyan-400">{totalHits.toLocaleString()}</span> hits
        </span>
        {peakCount > 0 && (
          <span className="text-gray-600">
            PEAK <span className="text-cyan-400">{peakCount.toLocaleString()}</span>
          </span>
        )}
        <span className="ml-auto text-gray-700 uppercase text-[9px] tracking-widest">
          {mode.label}
        </span>
      </div>

      {/* Grid */}
      <HeatmapGrid
        data={normalized}
        mode={mode}
        calOffset={calOffset}
        range={range}
        setTip={setTip}
        compact={compact}
      />

      {/* Color scale legend */}
      {!compact && (
        <div className="mt-3 flex items-center gap-2">
          <span className="text-[9px] font-mono uppercase tracking-widest text-gray-700">Low</span>
          <div
            className="h-1.5 flex-1 rounded-full"
            style={{ background: 'linear-gradient(90deg, rgba(3,8,20,0.88), rgba(6,182,212,0.92))' }}
          />
          <span className="text-[9px] font-mono uppercase tracking-widest text-gray-700">High</span>
        </div>
      )}

      {/* Tooltip — portalled to body so fixed positioning is never broken by
          ancestor transforms/filters in the dashboard layout */}
      {tip && createPortal(
        <div
          style={{
            position: 'fixed',
            left: tip.x + 16,
            top:  tip.y - 58,
            zIndex: 9999,
            pointerEvents: 'none',
          }}
        >
          <div style={{
            background: 'rgba(2,6,23,0.97)',
            backdropFilter: 'blur(8px)',
            border: '1px solid rgba(6,182,212,0.25)',
            borderRadius: '4px',
            padding: '6px 10px',
            fontFamily: 'monospace',
            fontSize: '10px',
            lineHeight: '1.5',
            whiteSpace: 'nowrap',
          }}>
            <div style={{ color: '#6b7280', marginBottom: '2px' }}>{tip.ts}</div>
            <div style={{ color: '#22d3ee', fontWeight: 700 }}>{tip.count.toLocaleString()} requests</div>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}

// ─── Grid layer ───────────────────────────────────────────────────────────────
function HeatmapGrid({ data, mode, calOffset, range, setTip, compact, fill = false }) {
  const isCalendar   = !!mode.calendar
  const show7dLabels = range === '7d' && !compact

  const { cells, rows } = useMemo(() => {
    if (!isCalendar) {
      return {
        cells: Array.from({ length: mode.total }, (_, i) => ({
          bucket: data[i] || { count: 0, timestamp: '', intensity: 0 },
          blank:  i >= data.length,
        })),
        rows: mode.rows,
      }
    }
    const rows = Math.ceil((calOffset + mode.total) / 7)
    const totalCells = rows * 7
    return {
      cells: Array.from({ length: totalCells }, (_, i) => {
        const di = i - calOffset
        return {
          bucket: (di >= 0 && di < data.length)
            ? data[di]
            : { count: 0, timestamp: '', intensity: 0 },
          blank: di < 0 || di >= data.length,
        }
      }),
      rows,
    }
  }, [data, mode, calOffset, isCalendar])

  const dayLabels = useMemo(() => {
    if (!show7dLabels || !data[0]?.timestamp) return []
    const start = new Date(data[0].timestamp.replace(' ', 'T') + 'Z')
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start)
      d.setUTCDate(d.getUTCDate() + i)
      return DAY_ABBR[d.getUTCDay()]
    })
  }, [show7dLabels, data])

  const cols = isCalendar ? 7 : mode.cols
  const cellGap = compact ? '1px' : '2px'
  const ratio = compact ? '24 / 3.2' : GRID_RATIO

  // ── Fill mode: square cells, stable height ───────────────────────────────────
  if (fill) {
    return (
      // position:relative container — flex:1 but absolute children can't push it taller
      <div style={{ flex: 1, minHeight: 0, position: 'relative' }}>
        {/* absolute fill → centering layer has a defined size so max-height:100% works */}
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
          {/* aspect-ratio = cols/rows → every cell is square regardless of range */}
          <div style={{ aspectRatio: `${cols} / ${rows}`, maxWidth: '100%', maxHeight: '100%', width: '100%' }}>
            <div style={{ width: '100%', height: '100%', display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gridTemplateRows: `repeat(${rows}, 1fr)`, gap: '1px' }}>
              {cells.map(({ bucket, blank }, i) => (
                <HeatmapCell key={i} bucket={bucket} blank={blank} setTip={setTip} compact />
              ))}
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ── Normal mode ───────────────────────────────────────────────────────────────
  return (
    <div className={`${compact ? 'flex gap-1' : 'flex gap-1.5'}`} style={{ aspectRatio: ratio }}>

      {/* 7d: Y-axis day labels */}
      {show7dLabels && (
        <div style={{ display: 'grid', gridTemplateRows: 'repeat(7,1fr)', gap: '2px', alignSelf: 'stretch', flexShrink: 0 }}>
          {dayLabels.map((d, i) => (
            <div key={i} className="flex items-center justify-end text-[8px] font-mono text-gray-700 pr-1.5">
              {d}
            </div>
          ))}
        </div>
      )}

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {/* 30d: day-of-week header */}
        {isCalendar && !compact && (
          <div className="mb-[2px] grid grid-cols-7" style={{ gap: cellGap, flexShrink: 0 }}>
            {DOW_HDR.map((d, i) => (
              <div key={i} className="text-center text-[8px] font-mono text-gray-700">{d}</div>
            ))}
          </div>
        )}

        <div style={{ flex: 1, minHeight: 0, display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gridTemplateRows: `repeat(${rows}, 1fr)`, gap: cellGap }}>
          {cells.map(({ bucket, blank }, i) => (
            <HeatmapCell key={i} bucket={bucket} blank={blank} setTip={setTip} compact={compact} />
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Cell layer ───────────────────────────────────────────────────────────────
function HeatmapCell({ bucket, blank, setTip, compact }) {
  const { count, timestamp, intensity } = bucket
  const active = !blank && count > 0
  const bg = blank ? 'rgba(255,255,255,0.02)' : cellColor(intensity)
  const glow = blank ? 'none' : cellGlow(intensity)
  const hoverGlow = blank ? 'none' : cellHoverGlow(intensity)
  const drift = `${Math.round(5 + intensity * 9)}px`
  const driftStart = `${Math.round((5 + intensity * 9) * -0.45)}px`
  const pulseDuration = `${(4.8 - intensity * 2.3).toFixed(2)}s`
  const starDuration = `${(6.4 - intensity * 2.8).toFixed(2)}s`
  const sparkOpacity = (0.16 + intensity * 0.48).toFixed(2)
  const nebulaOpacity = (0.2 + intensity * 0.52).toFixed(2)
  const sparkSize = `${Math.round(18 + intensity * 18)}px`
  const sparkSizeAlt = `${Math.round(28 + intensity * 26)}px`

  return (
    <div
      className={[
        'traffic-heatmap__cell',
        blank ? 'traffic-heatmap__cell--blank' : '',
        active ? 'traffic-heatmap__cell--active traffic-heatmap__cell--interactive' : '',
        compact ? 'traffic-heatmap__cell--compact' : '',
      ].filter(Boolean).join(' ')}
      style={{
        backgroundColor: bg,
        opacity: blank ? 0.15 : 1,
        cursor: !blank && count > 0 ? 'crosshair' : 'default',
        boxShadow: glow,
        '--cell-glow': glow,
        '--cell-hover-glow': hoverGlow,
        '--pulse-duration': pulseDuration,
        '--spark-opacity': sparkOpacity,
        '--nebula-opacity': nebulaOpacity,
        '--drift-distance': drift,
        '--drift-start': driftStart,
        '--spark-size': sparkSize,
        '--spark-size-alt': sparkSizeAlt,
        '--star-duration': starDuration,
      }}
      onMouseEnter={(e) => {
        if (blank || count === 0) return
        setTip({ x: e.clientX, y: e.clientY, ts: timestamp, count })
      }}
      onMouseMove={(e) => {
        if (!blank && count > 0)
          setTip(prev => ({ ...prev, x: e.clientX, y: e.clientY }))
      }}
      onMouseLeave={() => {
        setTip(null)
      }}
    />
  )
}
