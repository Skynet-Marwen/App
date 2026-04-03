import { Badge, Card } from '../../components/ui'

export default function SettingsSectionIntro({ section, loading, showFeatureStatusDetails }) {
  if (loading) {
    return <div className="h-40 animate-pulse rounded-2xl border border-cyan-500/10 bg-black/20" />
  }

  const liveCount = section.capabilities.filter((item) => item.status === 'live').length
  const partialCount = section.capabilities.filter((item) => item.status === 'partial').length

  return (
    <Card className="overflow-hidden">
      <div className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-3xl">
            <p className="text-[10px] font-mono uppercase tracking-[0.22em] text-cyan-400">Settings / {section.title}</p>
            <h2 className="mt-2 text-2xl font-semibold text-white">{section.title}</h2>
            <p className="mt-2 max-w-3xl text-sm text-gray-400">{section.description}</p>
          </div>
          {showFeatureStatusDetails ? (
            <div className="flex flex-wrap gap-2">
              <Badge variant="success">{liveCount} live</Badge>
              <Badge variant="warning">{partialCount} partial</Badge>
              <Badge variant="default">{section.capabilities.length - liveCount - partialCount} planned</Badge>
            </div>
          ) : null}
        </div>

        {showFeatureStatusDetails ? (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
            {section.capabilities.map((capability) => (
              <div key={capability.label} className="rounded-xl border border-cyan-500/10 bg-black/20 px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm text-white">{capability.label}</p>
                  <Badge variant={capability.status === 'live' ? 'success' : capability.status === 'partial' ? 'warning' : 'default'}>
                    {capability.status}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </Card>
  )
}
