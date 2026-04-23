export default function ToolStream({ events, streaming }) {
  if (!events.length) return null

  return (
    <div
      className="rounded-xl px-4 py-3 space-y-2 animate-fade-in"
      style={{
        background: 'rgba(124,58,237,0.05)',
        border: '1px solid rgba(124,58,237,0.15)',
      }}
    >
      {/* Running indicator */}
      {streaming && (
        <div className="flex items-center gap-2 pb-2 mb-0.5" style={{ borderBottom: '1px solid rgba(124,58,237,0.1)' }}>
          <div className="flex items-end gap-0.5 h-4">
            {[0,1,2,3,4].map(i => (
              <div
                key={i}
                className="w-0.5 rounded-full shimmer-bar"
                style={{
                  height: `${8 + Math.abs(Math.sin(i)) * 8}px`,
                  background: '#7c3aed',
                  opacity: 0.5 + i * 0.1,
                  animationDelay: `${i * 0.12}s`,
                }}
              />
            ))}
          </div>
          <span className="text-[10px] font-mono uppercase tracking-widest" style={{ color: 'rgba(167,139,250,0.5)' }}>
            running
          </span>
        </div>
      )}

      {events.map((ev, i) => (
        <ToolEvent key={i} event={ev} />
      ))}
    </div>
  )
}

function ToolEvent({ event }) {
  if (event.type === 'tool_call') {
    return (
      <div className="flex items-start gap-2 font-mono text-xs animate-slide-up">
        <span style={{ color: '#7c3aed' }} className="shrink-0 mt-px">→</span>
        <span style={{ color: 'rgba(255,255,255,0.35)' }}>
          Calling{' '}
          <span style={{ color: '#a78bfa', fontWeight: 600 }}>{event.tool}</span>
        </span>
      </div>
    )
  }

  if (event.type === 'tool_result') {
    return (
      <div className="flex items-start gap-2 font-mono text-xs animate-slide-up pl-4">
        <span className="shrink-0 mt-px" style={{ color: '#4ade80' }}>✓</span>
        <span className="truncate max-w-sm" style={{ color: 'rgba(167,139,250,0.5)' }}>
          {event.tool}
          {event.result_preview && (
            <span style={{ color: 'rgba(255,255,255,0.2)' }}>: {event.result_preview}</span>
          )}
        </span>
      </div>
    )
  }

  return null
}
