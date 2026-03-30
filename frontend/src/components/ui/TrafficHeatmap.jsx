import { useMemo, useState } from 'react'
import { createPortal } from 'react-dom'

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
  if (intensity === 0) return 'rgb(10,15,40)'
  const r = Math.round(10 - intensity * 4)
  const g = Math.round(15 + intensity * 167)
  const b = Math.round(40  + intensity * 172)
  return `rgb(${r},${g},${b})`
}

function cellGlow(intensity) {
  if (intensity < 0.4) return 'none'
  const alpha = (((intensity - 0.4) / 0.6) * 0.8).toFixed(2)
  const spread = Math.round(4 + intensity * 10)
  return `0 0 ${spread}px rgba(6,182,212,${alpha})`
}

// ─── Container layer ──────────────────────────────────────────────────────────
export function TrafficHeatmap({ data, range, className = '' }) {
  const mode = TIME_MODES[range] || TIME_MODES['24h']
  const [tip, setTip] = useState(null)

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
        style={{ aspectRatio: GRID_RATIO }}>
        // NO DATA
      </div>
    )
  }

  return (
    <div className={`traffic-heatmap ${className}`}>

      {/* Meta row */}
      <div className="flex items-center gap-3 mb-3 text-[10px] font-mono">
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
      />

      {/* Color scale legend */}
      <div className="flex items-center gap-2 mt-3">
        <span className="text-[9px] font-mono text-gray-700 uppercase tracking-widest">Low</span>
        <div
          className="flex-1 h-1.5 rounded-full"
          style={{ background: 'linear-gradient(90deg, rgb(10,15,40), rgb(6,182,212))' }}
        />
        <span className="text-[9px] font-mono text-gray-700 uppercase tracking-widest">High</span>
      </div>

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
function HeatmapGrid({ data, mode, calOffset, range, setTip }) {
  const isCalendar   = !!mode.calendar
  const show7dLabels = range === '7d'

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

  return (
    <div className="flex gap-1.5" style={{ aspectRatio: GRID_RATIO }}>

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
        {isCalendar && (
          <div className="grid grid-cols-7 mb-[2px]" style={{ gap: '2px', flexShrink: 0 }}>
            {DOW_HDR.map((d, i) => (
              <div key={i} className="text-center text-[8px] font-mono text-gray-700">{d}</div>
            ))}
          </div>
        )}

        {/* Main grid — fills the remaining height so all modes share the same outer box */}
        <div
          style={{
            flex: 1,
            display: 'grid',
            gridTemplateColumns: `repeat(${cols}, 1fr)`,
            gridTemplateRows: `repeat(${rows}, 1fr)`,
            gap: '2px',
          }}
        >
          {cells.map(({ bucket, blank }, i) => (
            <HeatmapCell key={i} bucket={bucket} blank={blank} setTip={setTip} />
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Cell layer ───────────────────────────────────────────────────────────────
function HeatmapCell({ bucket, blank, setTip }) {
  const { count, timestamp, intensity } = bucket
  const bg   = blank ? 'rgba(255,255,255,0.02)' : cellColor(intensity)
  const glow = blank ? 'none' : cellGlow(intensity)

  return (
    <div
      style={{
        backgroundColor: bg,
        borderRadius: '2px',
        opacity: blank ? 0.15 : 1,
        cursor: !blank && count > 0 ? 'crosshair' : 'default',
        transition: 'transform 0.12s ease, box-shadow 0.12s ease',
        boxShadow: glow,
      }}
      onMouseEnter={(e) => {
        if (blank || count === 0) return
        e.currentTarget.style.transform = 'scale(1.25)'
        e.currentTarget.style.zIndex    = '10'
        e.currentTarget.style.position  = 'relative'
        e.currentTarget.style.boxShadow = '0 0 14px rgba(6,182,212,0.9)'
        setTip({ x: e.clientX, y: e.clientY, ts: timestamp, count })
      }}
      onMouseMove={(e) => {
        if (!blank && count > 0)
          setTip(prev => ({ ...prev, x: e.clientX, y: e.clientY }))
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'scale(1)'
        e.currentTarget.style.zIndex    = ''
        e.currentTarget.style.boxShadow = glow
        setTip(null)
      }}
    />
  )
}
