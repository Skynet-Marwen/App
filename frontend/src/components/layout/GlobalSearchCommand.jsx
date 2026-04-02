import { Search } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { Badge } from '../ui'
import { useDashboardSearch } from '../../hooks/useDashboardSearch'


export default function GlobalSearchCommand() {
  const navigate = useNavigate()
  const rootRef = useRef(null)
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const { results, loading } = useDashboardSearch(query)

  useEffect(() => {
    if (!open) return undefined
    const handlePointerDown = (event) => {
      if (!rootRef.current?.contains(event.target)) {
        setOpen(false)
      }
    }
    window.addEventListener('pointerdown', handlePointerDown)
    return () => window.removeEventListener('pointerdown', handlePointerDown)
  }, [open])

  const handleSelect = (route) => {
    navigate(route)
    setOpen(false)
    setQuery('')
  }

  return (
    <div ref={rootRef} className="relative w-full max-w-xl">
      <div
        className="flex items-center gap-2 rounded-xl border px-3 py-2"
        style={{ background: 'rgba(0,0,0,0.24)', borderColor: 'var(--theme-header-border)' }}
      >
        <Search size={14} className="text-cyan-400" />
        <input
          value={query}
          onChange={(event) => {
            setQuery(event.target.value)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          placeholder="Search visitors, devices, portal users..."
          className="w-full bg-transparent text-sm text-white placeholder-gray-500 focus:outline-none"
        />
        {results?.totals?.overall ? <Badge variant="info">{results.totals.overall} matches</Badge> : null}
      </div>

      {open && (query.trim().length >= 2 || loading) ? (
        <div
          className="absolute left-0 right-0 top-[calc(100%+0.5rem)] z-50 overflow-hidden rounded-2xl border"
          style={{ background: 'rgba(2,6,23,0.97)', borderColor: 'var(--theme-panel-border)', backdropFilter: 'blur(12px)' }}
        >
          <div className="border-b px-4 py-3" style={{ borderColor: 'var(--theme-panel-border)' }}>
            <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-cyan-400">Global Search</p>
            <p className="mt-1 text-xs text-gray-500">Jump straight to the matching dashboard surface.</p>
          </div>

          <div className="max-h-[24rem] overflow-y-auto px-4 py-3">
            {loading ? (
              <p className="py-10 text-center text-xs font-mono text-gray-500">Searching...</p>
            ) : results?.sections?.some((section) => section.items.length > 0) ? (
              <div className="space-y-4">
                {results.sections.filter((section) => section.items.length > 0).map((section) => (
                  <div key={section.key} className="space-y-2">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-gray-500">{section.label}</p>
                      <Badge variant="default">{section.total}</Badge>
                    </div>
                    {section.items.map((item) => (
                      <button
                        key={`${section.key}:${item.id}`}
                        type="button"
                        onClick={() => handleSelect(item.route)}
                        className="w-full rounded-xl border px-3 py-2 text-left transition hover:border-cyan-500/30 hover:bg-cyan-500/5"
                        style={{ borderColor: 'rgba(34,211,238,0.08)', background: 'rgba(255,255,255,0.02)' }}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-sm text-white">{item.title}</p>
                            {item.subtitle ? <p className="mt-1 truncate text-xs text-gray-500">{item.subtitle}</p> : null}
                          </div>
                          {item.status ? <Badge variant="default">{item.status}</Badge> : null}
                        </div>
                        {item.meta ? <p className="mt-2 text-[11px] font-mono text-cyan-400">{item.meta}</p> : null}
                      </button>
                    ))}
                  </div>
                ))}
              </div>
            ) : (
              <p className="py-10 text-center text-xs font-mono text-gray-500">No matching entities found.</p>
            )}
          </div>
        </div>
      ) : null}
    </div>
  )
}
