const COUNTRY_LOCATIONS = {
  USA: { lat: 37.0902, lon: -95.7129, tone: 'danger' },
  Canada: { lat: 56.1304, lon: -106.3468, tone: 'info' },
  Brazil: { lat: -14.235, lon: -51.9253, tone: 'info' },
  Germany: { lat: 51.1657, lon: 10.4515, tone: 'danger' },
  France: { lat: 46.2276, lon: 2.2137, tone: 'info' },
  UK: { lat: 55.3781, lon: -3.436, tone: 'info' },
  Russia: { lat: 61.524, lon: 105.3188, tone: 'warning' },
  China: { lat: 35.8617, lon: 104.1954, tone: 'danger' },
  India: { lat: 20.5937, lon: 78.9629, tone: 'info' },
  Japan: { lat: 36.2048, lon: 138.2529, tone: 'info' },
  Australia: { lat: -25.2744, lon: 133.7751, tone: 'info' },
}

const TONE_STYLES = {
  info: { fill: 'rgba(34,211,238,0.9)', ring: 'rgba(34,211,238,0.28)' },
  warning: { fill: 'rgba(251,191,36,0.92)', ring: 'rgba(251,191,36,0.28)' },
  danger: { fill: 'rgba(248,113,113,0.92)', ring: 'rgba(248,113,113,0.28)' },
}

const clampPercent = (value) => {
  const numeric = Number(value) || 0
  return Math.max(0, Math.min(100, numeric))
}

function projectToGlobe(lat, lon) {
  const latRad = (lat * Math.PI) / 180
  const lonRad = ((lon + 18) * Math.PI) / 180
  const x = 160 + Math.sin(lonRad) * Math.cos(latRad) * 90
  const y = 160 - Math.sin(latRad) * 72
  const depth = 0.45 + ((Math.cos(lonRad) * Math.cos(latRad) + 1) / 2) * 0.55
  return { x, y, depth }
}

export function WorldGlobe({ countries = [], showList = true }) {
  const markers = countries
    .map((country) => {
      const location = COUNTRY_LOCATIONS[country.country]
      if (!location) return null

      const projected = projectToGlobe(location.lat, location.lon)
      const size = 3 + clampPercent(country.percent) / 18
      const style = TONE_STYLES[location.tone] || TONE_STYLES.info

      return {
        ...projected,
        key: country.country,
        label: `${country.flag || ''} ${country.country}`.trim(),
        percent: Number(country.percent) || 0,
        size,
        style,
      }
    })
    .filter(Boolean)
    .sort((left, right) => left.depth - right.depth)

  return (
    <div className="w-full">
      <div className="relative isolate mx-auto aspect-square w-full max-w-[10rem] overflow-hidden rounded-[1.2rem] border border-cyan-500/10 bg-black/45 shadow-[0_12px_30px_rgba(0,0,0,0.18)]">
        <div
          className="pointer-events-none absolute inset-0"
          style={{ background: 'radial-gradient(circle at 50% 44%, rgba(34,211,238,0.1), transparent 54%)' }}
        />
        <div
          className="pointer-events-none absolute inset-0 opacity-40"
          style={{ backgroundImage: 'linear-gradient(180deg, rgba(255,255,255,0.04) 0, transparent 2px)', backgroundSize: '100% 8px' }}
        />

        <div className="pointer-events-none absolute left-3 top-3 z-[2] rounded-full border border-cyan-500/15 bg-black/50 px-2 py-0.5">
          <p className="text-[9px] font-mono uppercase tracking-[0.2em] text-cyan-300">Geo Mesh</p>
        </div>

        <svg viewBox="0 0 320 320" className="relative z-[1] block h-full w-full" aria-hidden="true">
          <defs>
            <radialGradient id="globeFill" cx="50%" cy="40%" r="65%">
              <stop offset="0%" stopColor="rgba(34,211,238,0.18)" />
              <stop offset="65%" stopColor="rgba(10,18,32,0.8)" />
              <stop offset="100%" stopColor="rgba(4,8,20,0.94)" />
            </radialGradient>
            <clipPath id="globeClip">
              <circle cx="160" cy="160" r="112" />
            </clipPath>
          </defs>

          <circle cx="160" cy="160" r="112" fill="url(#globeFill)" stroke="rgba(34,211,238,0.18)" strokeWidth="2" />
          <ellipse cx="160" cy="160" rx="112" ry="46" fill="none" stroke="rgba(34,211,238,0.12)" strokeWidth="1" />
          <ellipse cx="160" cy="160" rx="112" ry="78" fill="none" stroke="rgba(34,211,238,0.1)" strokeWidth="1" />
          <ellipse cx="160" cy="160" rx="88" ry="112" fill="none" stroke="rgba(34,211,238,0.12)" strokeWidth="1" />
          <ellipse cx="160" cy="160" rx="48" ry="112" fill="none" stroke="rgba(34,211,238,0.1)" strokeWidth="1" />
          <ellipse cx="160" cy="160" rx="112" ry="112" fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="10" />

          <g clipPath="url(#globeClip)" opacity="0.26">
            <path d="M70 120c16-28 52-48 88-42 18 3 34 11 46 24 8 9 8 19-4 24-16 7-31 3-44 7-21 6-28 28-50 31-19 3-45-9-48-24-2-8 4-14 12-20Z" fill="rgba(34,211,238,0.22)" />
            <path d="M168 106c17-14 39-18 60-12 23 6 42 20 51 40 5 10-1 18-15 18-16 1-29-8-45-6-24 2-35 24-57 21-12-2-19-8-18-18 1-17 8-31 24-43Z" fill="rgba(34,211,238,0.18)" />
            <path d="M186 190c14-7 32-8 47-4 16 4 28 13 34 25 3 7-2 12-11 13-17 2-28-7-44-5-11 1-18 9-28 11-18 5-34-4-35-17-1-11 14-18 37-23Z" fill="rgba(34,211,238,0.16)" />
          </g>

          {markers.map((marker) => (
            <g key={marker.key} opacity={marker.depth}>
              <circle cx={marker.x} cy={marker.y} r={marker.size + 3} fill={marker.style.ring} />
              <circle cx={marker.x} cy={marker.y} r={marker.size} fill={marker.style.fill} />
            </g>
          ))}
        </svg>
      </div>

      {showList && (
        <div className="mt-3 space-y-1.5">
          {countries.length > 0 ? countries.slice(0, 5).map((country) => (
            <div key={country.country} className="flex items-center gap-2">
              <span className="text-sm">{country.flag}</span>
              <div className="min-w-0 flex-1">
                <div className="mb-0.5 flex justify-between">
                  <span className="truncate text-xs font-mono text-gray-400">{country.country}</span>
                  <span className="text-xs font-mono text-gray-600">{country.percent}%</span>
                </div>
                <div className="h-1 overflow-hidden rounded-full border border-cyan-500/10 bg-black/60">
                  <div
                    className="h-full rounded-full bg-cyan-500"
                    style={{ width: `${country.percent}%` }}
                  />
                </div>
              </div>
            </div>
          )) : (
            <p className="pt-2 text-center text-xs font-mono text-gray-700">// AWAITING GEO DATA</p>
          )}
        </div>
      )}
    </div>
  )
}
