/**
 * ToolStream — live feed of tool_call / tool_result events.
 * Each tool type gets a distinct color + icon.
 */

const TOOL_META = {
  github_list_prs:          { icon: '⑂',  color: '#6ee7b7', label: 'GitHub' },
  github_get_pr:            { icon: '⑂',  color: '#6ee7b7', label: 'GitHub' },
  github_list_commits:      { icon: '⑂',  color: '#6ee7b7', label: 'GitHub' },
  datadog_get_alerts:       { icon: '◈',  color: '#fca5a5', label: 'Datadog' },
  datadog_query_metrics:    { icon: '◈',  color: '#fca5a5', label: 'Datadog' },
  jira_get_issues:          { icon: '◉',  color: '#93c5fd', label: 'Jira' },
  jira_get_sprint:          { icon: '◉',  color: '#93c5fd', label: 'Jira' },
  confluence_search:        { icon: '◎',  color: '#67e8f9', label: 'Confluence' },
  slack_search_messages:    { icon: '◆',  color: '#fde047', label: 'Slack' },
  grafana_get_dashboard:    { icon: '◇',  color: '#fdba74', label: 'Grafana' },
  prometheus_query:         { icon: '▣',  color: '#f9a8d4', label: 'Prometheus' },
}

function toolMeta(toolName) {
  const key = Object.keys(TOOL_META).find(k => toolName?.includes(k.split('_')[0]))
  return TOOL_META[key] ?? { icon: '⬡', color: '#a5b4fc', label: toolName }
}

export default function ToolStream({ events, streaming }) {
  if (!events.length) return null

  return (
    <div
      className="rounded-xl px-3 py-2.5 space-y-1.5 animate-fade-in"
      style={{ background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.05)' }}
    >
      {/* Running indicator */}
      {streaming && (
        <div className="flex items-center gap-2 pb-1.5 mb-0.5" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
          <div className="flex gap-0.5">
            {[0,1,2,3,4,5,6,7].map(i => (
              <div
                key={i}
                className="w-0.5 rounded-full shimmer-bar"
                style={{
                  height: `${6 + Math.sin(i * 0.8) * 4}px`,
                  background: i % 2 === 0 ? 'rgba(6,182,212,0.5)' : 'rgba(139,92,246,0.5)',
                  animationDelay: `${i * 0.1}s`,
                }}
              />
            ))}
          </div>
          <span className="text-[10px] text-slate-600 font-mono">agent running</span>
        </div>
      )}

      {events.map((ev, i) => (
        <ToolEvent key={i} event={ev} />
      ))}
    </div>
  )
}

function ToolEvent({ event }) {
  const meta = toolMeta(event.tool)

  if (event.type === 'tool_call') {
    return (
      <div className="flex items-start gap-2 font-mono text-xs animate-slide-up">
        <span className="shrink-0 text-[11px] mt-px" style={{ color: meta.color }}>{meta.icon}</span>
        <span className="text-slate-500">
          Calling{' '}
          <span className="font-semibold" style={{ color: meta.color }}>{event.tool}</span>
        </span>
      </div>
    )
  }

  if (event.type === 'tool_result') {
    return (
      <div className="flex items-start gap-2 font-mono text-xs animate-slide-up pl-3">
        <span className="shrink-0 text-emerald-500 mt-px">✓</span>
        <span className="truncate max-w-md" style={{ color: meta.color, opacity: 0.7 }}>
          {event.tool}
          {event.result_preview && (
            <span className="text-slate-600">: {event.result_preview}</span>
          )}
        </span>
      </div>
    )
  }

  return null
}
