import { useMemo } from 'react'

const TIME_MODES = {
  '1h': { cols: 10, rows: 6, bucket: 'minute', total: 60 },
  '24h': { cols: 16, rows: 6, bucket: '15min', total: 96 },
  '7d': { cols: 24, rows: 7, bucket: 'hour', total: 168 },
  '30d': { cols: 7, rows: 5, bucket: 'day', total: 30 }, // approx, calendar layout
}

// Container layer - data handling + mode switching
export function TrafficHeatmap({ data, range, className = '' }) {
  const mode = TIME_MODES[range] || TIME_MODES['24h']

  // Normalize data: compute max, scale 0-1
  const normalized = useMemo(() => {
    if (!data?.length) return []
    const max = Math.max(...data.map(d => d.count || 0), 1)
    return data.map(d => ({
      ...d,
      intensity: (d.count || 0) / max,
    }))
  }, [data])

  return (
    <div className={`traffic-heatmap ${className}`}>
      <HeatmapGrid data={normalized} mode={mode} />
    </div>
  )
}

// Grid layer - layout rendering
function HeatmapGrid({ data, mode }) {
  const gridStyle = {
    display: 'grid',
    gridTemplateColumns: `repeat(${mode.cols}, 1fr)`,
    gridTemplateRows: `repeat(${mode.rows}, 1fr)`,
    gap: '2px',
    width: '100%',
    aspectRatio: mode.cols / mode.rows,
  }

  return (
    <div className="heatmap-grid" style={gridStyle}>
      {Array.from({ length: mode.total }, (_, i) => {
        const bucket = data[i] || { count: 0, timestamp: '', intensity: 0 }
        return <HeatmapCell key={i} bucket={bucket} />
      })}
    </div>
  )
}

// Cell layer - visual unit
function HeatmapCell({ bucket }) {
  const { count, timestamp, intensity } = bucket

  // Color: dark navy (low) to neon cyan (high)
  const color = intensity === 0
    ? 'rgb(23, 37, 84)' // dark navy
    : `rgb(${Math.round(6 + intensity * 250)}, ${Math.round(182 + intensity * 73)}, ${Math.round(212 + intensity * 43)})`

  const cellStyle = {
    backgroundColor: color,
    borderRadius: '2px',
    cursor: count > 0 ? 'pointer' : 'default',
    transition: 'all 0.2s ease',
  }

  return (
    <div
      className="heatmap-cell"
      style={cellStyle}
      title={count > 0 ? `${timestamp}: ${count} requests` : ''}
      onMouseEnter={(e) => {
        if (count > 0) {
          e.target.style.transform = 'scale(1.1)'
          e.target.style.boxShadow = '0 0 8px rgba(6, 182, 212, 0.5)'
        }
      }}
      onMouseLeave={(e) => {
        e.target.style.transform = 'scale(1)'
        e.target.style.boxShadow = 'none'
      }}
    />
  )
}