// Wireframe holographic globe — pure SVG, no dependencies
// Country positions are approximate (orthographic projection, centered ~15°E)

const KNOWN_POSITIONS = {
  USA:       { cx: 42,  cy: 60,  color: '#ef4444' },
  Canada:    { cx: 50,  cy: 46,  color: '#06b6d4' },
  Brazil:    { cx: 78,  cy: 100, color: '#06b6d4' },
  Germany:   { cx: 118, cy: 50,  color: '#ef4444' },
  France:    { cx: 112, cy: 54,  color: '#06b6d4' },
  UK:        { cx: 108, cy: 47,  color: '#06b6d4' },
  Russia:    { cx: 155, cy: 40,  color: '#ef4444' },
  China:     { cx: 165, cy: 58,  color: '#f59e0b' },
  India:     { cx: 152, cy: 70,  color: '#06b6d4' },
  Japan:     { cx: 178, cy: 55,  color: '#06b6d4' },
  Australia: { cx: 172, cy: 110, color: '#06b6d4' },
}

export function WorldGlobe({ countries = [] }) {
  // Merge live API data over defaults
  const dots = Object.entries(KNOWN_POSITIONS).map(([name, pos]) => {
    const live = countries.find(c => c.country === name)
    return { name, ...pos, active: !!live, count: live?.count ?? 0 }
  })

  return (
    <div className="w-full">
      <svg viewBox="0 0 210 160" className="w-full" style={{ filter: 'drop-shadow(0 0 8px rgba(6,182,212,0.18))' }}>
        <defs>
          <clipPath id="globe-clip">
            <circle cx="105" cy="80" r="68" />
          </clipPath>
          <radialGradient id="globe-bg" cx="40%" cy="35%">
            <stop offset="0%" stopColor="rgba(6,182,212,0.06)" />
            <stop offset="100%" stopColor="rgba(0,0,0,0)" />
          </radialGradient>
        </defs>

        {/* Globe fill */}
        <circle cx="105" cy="80" r="68" fill="url(#globe-bg)" />

        {/* Grid lines clipped to globe */}
        <g clipPath="url(#globe-clip)" stroke="rgba(6,182,212,0.18)" fill="none" strokeWidth="0.6">
          {/* Latitude lines */}
          <ellipse cx="105" cy="56" rx="57" ry="7" />
          <ellipse cx="105" cy="68" rx="66" ry="4.5" />
          <ellipse cx="105" cy="80" rx="68" ry="2.5" />
          <ellipse cx="105" cy="92" rx="66" ry="4.5" />
          <ellipse cx="105" cy="104" rx="57" ry="7" />
          {/* Longitude lines */}
          <line x1="105" y1="12" x2="105" y2="148" strokeWidth="0.5" />
          <ellipse cx="105" cy="80" rx="28" ry="68" />
          <ellipse cx="105" cy="80" rx="55" ry="68" />
        </g>

        {/* Outer ring */}
        <circle cx="105" cy="80" r="68" stroke="rgba(6,182,212,0.45)" fill="none" strokeWidth="0.8" />

        {/* Sweep line (animated) */}
        <g clipPath="url(#globe-clip)">
          <line x1="105" y1="12" x2="105" y2="148"
            stroke="rgba(6,182,212,0.5)" strokeWidth="1"
            className="animate-hud-sweep"
            style={{ transformOrigin: '105px 80px', animation: 'radar-spin 8s linear infinite' }} />
        </g>

        {/* Country dots */}
        {dots.map((d) => (
          <g key={d.name}>
            {d.active && (
              <circle cx={d.cx} cy={d.cy} r="5" fill={d.color} fillOpacity="0.15"
                className="animate-hud-dot" style={{ color: d.color }} />
            )}
            <circle cx={d.cx} cy={d.cy} r="2.2" fill={d.color}
              style={{ filter: `drop-shadow(0 0 4px ${d.color})` }} />
          </g>
        ))}
      </svg>

      {/* Country list */}
      <div className="mt-3 space-y-1.5">
        {countries.length > 0 ? countries.slice(0, 5).map((c) => (
          <div key={c.country} className="flex items-center gap-2">
            <span className="text-sm">{c.flag}</span>
            <div className="flex-1 min-w-0">
              <div className="flex justify-between mb-0.5">
                <span className="text-xs font-mono text-gray-400 truncate">{c.country}</span>
                <span className="text-xs font-mono text-gray-600">{c.percent}%</span>
              </div>
              <div className="h-1 bg-black/60 rounded-full overflow-hidden border border-cyan-500/10">
                <div className="h-full bg-cyan-500 rounded-full" style={{ width: `${c.percent}%`, boxShadow: '0 0 6px rgba(6,182,212,0.6)' }} />
              </div>
            </div>
          </div>
        )) : (
          <p className="text-xs font-mono text-gray-700 text-center pt-2">// AWAITING GEO DATA</p>
        )}
      </div>
    </div>
  )
}
