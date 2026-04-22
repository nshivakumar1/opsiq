/**
 * ToolStream — live feed of tool_call / tool_result events while the agent runs.
 * Shown between the user's query and the (forthcoming) assistant answer.
 */
export default function ToolStream({ events }) {
  if (!events.length) return null

  return (
    <div className="mt-3 space-y-1 animate-fade-in">
      {events.map((ev, i) => (
        <ToolEvent key={i} event={ev} />
      ))}
    </div>
  )
}

function ToolEvent({ event }) {
  if (event.type === 'tool_call') {
    return (
      <div className="flex items-start gap-2 font-mono text-xs text-gray-500 animate-slide-up">
        <span className="text-indigo-400 mt-px shrink-0">→</span>
        <span>
          Calling{' '}
          <span className="text-indigo-300">{event.tool}</span>
        </span>
      </div>
    )
  }

  if (event.type === 'tool_result') {
    return (
      <div className="flex items-start gap-2 font-mono text-xs text-gray-600 animate-slide-up pl-4">
        <span className="text-emerald-600 mt-px shrink-0">✓</span>
        <span className="truncate max-w-md">
          <span className="text-emerald-700">{event.tool}</span>
          {event.result_preview && (
            <span className="text-gray-600">: {event.result_preview}</span>
          )}
        </span>
      </div>
    )
  }

  return null
}
