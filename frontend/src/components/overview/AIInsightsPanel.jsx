/**
 * AIInsightsPanel — 3-5 human-readable insights from security data synthesis.
 * Answers: Why is the system at this risk level? What patterns are active?
 * compact=true renders a single horizontal pill strip (no vertical growth).
 */
export default function AIInsightsPanel({ insights = [], loading, compact = false }) {
  if (loading || !insights.length) return null

  if (compact) {
    return (
      <div className="flex items-center gap-2 overflow-x-auto rounded-lg border border-cyan-500/10 bg-black/20 px-3 py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <span className="shrink-0 text-cyan-400 text-xs">◈</span>
        <span className="shrink-0 text-[10px] font-mono uppercase tracking-widest text-cyan-400">Insights</span>
        <span className="shrink-0 text-gray-700 text-[10px]">·</span>
        {insights.slice(0, 4).map((insight, i) => (
          <span key={i} className="shrink-0 rounded-md border border-cyan-500/10 bg-black/20 px-2.5 py-1 text-[10px] font-mono text-gray-400 whitespace-nowrap">
            › {insight}
          </span>
        ))}
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-cyan-500/10 bg-black/20 p-4">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-cyan-400 text-sm">◈</span>
        <p className="text-[10px] font-mono uppercase tracking-widest text-cyan-400">AI Insights</p>
        <span className="text-[10px] font-mono text-gray-600">— {insights.length} pattern{insights.length > 1 ? 's' : ''} detected</span>
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {insights.map((insight, i) => (
          <div key={i} className="flex items-start gap-2 rounded-lg border border-cyan-500/8 bg-black/20 px-3 py-2.5">
            <span className="text-cyan-500 flex-shrink-0 mt-0.5">›</span>
            <p className="text-xs text-gray-300 leading-relaxed">{insight}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
