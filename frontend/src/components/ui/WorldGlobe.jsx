import { useEffect, useMemo, useRef } from 'react'
import createGlobe from 'cobe'

const COUNTRY_LOCATIONS = {
  USA: { lat: 37.0902, lon: -95.7129, color: [0.94, 0.27, 0.27] },
  Canada: { lat: 56.1304, lon: -106.3468, color: [0.13, 0.83, 0.93] },
  Brazil: { lat: -14.235, lon: -51.9253, color: [0.13, 0.83, 0.93] },
  Germany: { lat: 51.1657, lon: 10.4515, color: [0.94, 0.27, 0.27] },
  France: { lat: 46.2276, lon: 2.2137, color: [0.13, 0.83, 0.93] },
  UK: { lat: 55.3781, lon: -3.436, color: [0.13, 0.83, 0.93] },
  Russia: { lat: 61.524, lon: 105.3188, color: [0.96, 0.62, 0.16] },
  China: { lat: 35.8617, lon: 104.1954, color: [0.94, 0.27, 0.27] },
  India: { lat: 20.5937, lon: 78.9629, color: [0.13, 0.83, 0.93] },
  Japan: { lat: 36.2048, lon: 138.2529, color: [0.13, 0.83, 0.93] },
  Australia: { lat: -25.2744, lon: 133.7751, color: [0.13, 0.83, 0.93] },
}

const clampPercent = (value) => {
  const numeric = Number(value) || 0
  return Math.max(0, Math.min(100, numeric))
}

export function WorldGlobe({ countries = [], showList = true }) {
  const canvasRef = useRef(null)
  const shellRef = useRef(null)

  const markers = useMemo(() => {
    return countries
      .map((country) => {
        const base = COUNTRY_LOCATIONS[country.country]
        if (!base) return null

        return {
          location: [base.lat, base.lon],
          size: 0.06 + clampPercent(country.percent) / 1800,
          color: base.color,
        }
      })
      .filter(Boolean)
  }, [countries])

  useEffect(() => {
    const canvas = canvasRef.current
    const shell = shellRef.current
    if (!canvas || !shell) return undefined

    let width = 0
    let phi = 0.45
    let globe = null
    let frameId = 0

    const build = () => {
      const nextWidth = Math.max(shell.clientWidth, 320)
      if (Math.abs(nextWidth - width) < 2 && globe) return

      width = nextWidth
      if (globe) globe.destroy()

      globe = createGlobe(canvas, {
        devicePixelRatio: Math.min(window.devicePixelRatio || 1, 2),
        width: width * 2,
        height: width * 2,
        phi,
        theta: 0.2,
        dark: 0.18,
        diffuse: 1.8,
        scale: 1.02,
        mapSamples: 30000,
        mapBrightness: 14,
        mapBaseBrightness: 0.12,
        baseColor: [0.16, 0.68, 0.82],
        markerColor: [0.13, 0.83, 0.93],
        glowColor: [0.1, 0.76, 0.88],
        offset: [0, 0],
        markers,
        markerElevation: 0.04,
        opacity: 0.96,
      })
    }

    build()

    const animate = () => {
      phi += 0.0035
      globe?.update({ phi })
      frameId = window.requestAnimationFrame(animate)
    }

    frameId = window.requestAnimationFrame(animate)

    const observer = new ResizeObserver(() => build())
    observer.observe(shell)

    return () => {
      observer.disconnect()
      window.cancelAnimationFrame(frameId)
      if (globe) globe.destroy()
    }
  }, [markers])

  return (
    <div className="w-full">
      <div
        ref={shellRef}
        className="relative isolate mx-auto aspect-square w-full max-w-[360px] overflow-hidden rounded-[1.4rem] border border-cyan-500/10 bg-black/45 shadow-[0_0_36px_rgba(6,182,212,0.12)]"
      >
        <div
          className="pointer-events-none absolute inset-0"
          style={{ background: 'radial-gradient(circle at 50% 42%, rgba(34,211,238,0.08), transparent 48%)' }}
        />
        <div
          className="pointer-events-none absolute inset-0 opacity-40"
          style={{ backgroundImage: 'linear-gradient(180deg, rgba(255,255,255,0.04) 0, transparent 2px)', backgroundSize: '100% 8px' }}
        />
        <div
          className="pointer-events-none absolute inset-y-0 left-1/2 w-24 -translate-x-1/2 blur-2xl"
          style={{ background: 'linear-gradient(180deg, transparent, rgba(34,211,238,0.08), transparent)' }}
        />

        <div className="pointer-events-none absolute left-4 top-4 z-[2] rounded-full border border-cyan-500/15 bg-black/45 px-3 py-1">
          <p className="text-[10px] font-mono uppercase tracking-[0.22em] text-cyan-300">Geo Threat Mesh</p>
        </div>

        <canvas
          ref={canvasRef}
          className="relative z-[1] block h-full w-full"
          style={{ width: '100%', height: '100%' }}
          aria-hidden="true"
        />
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
                    style={{ width: `${country.percent}%`, boxShadow: '0 0 6px rgba(6,182,212,0.6)' }}
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
