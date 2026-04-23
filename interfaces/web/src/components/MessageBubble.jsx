import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import ToolStream from './ToolStream.jsx'

export default function MessageBubble({ message }) {
  return message.role === 'user'
    ? <UserBubble message={message} />
    : <AssistantBubble message={message} />
}

/* ── User bubble ─────────────────────────────────────── */
function UserBubble({ message }) {
  return (
    <div className="flex justify-end animate-slide-up">
      <div
        className="max-w-[72%] rounded-2xl rounded-tr-sm px-4 py-3"
        style={{
          background: '#7c3aed',
          boxShadow: '0 4px 20px rgba(124,58,237,0.3)',
        }}
      >
        <p className="text-sm text-white leading-relaxed whitespace-pre-wrap break-words">
          {message.content}
        </p>
      </div>
    </div>
  )
}

/* ── Assistant bubble ────────────────────────────────── */
function AssistantBubble({ message }) {
  const isStreaming  = message.streaming
  const hasContent   = !!message.content
  const hasToolEvents = message.toolEvents?.length > 0

  return (
    <div className="flex justify-start animate-slide-up">
      {/* Avatar */}
      <div
        className="shrink-0 mr-3 mt-0.5 w-7 h-7 rounded-lg flex items-center justify-center text-[11px] font-bold"
        style={{
          background: 'rgba(124,58,237,0.15)',
          border: '1px solid rgba(124,58,237,0.3)',
          boxShadow: '0 0 10px rgba(124,58,237,0.15)',
        }}
      >
        ⚡
      </div>

      <div className="max-w-[78%] min-w-0 space-y-2">
        {/* Tool events */}
        {(hasToolEvents || (isStreaming && !hasContent)) && (
          <div>
            {isStreaming && !hasToolEvents && <ThinkingDots />}
            <ToolStream events={message.toolEvents ?? []} streaming={isStreaming} />
          </div>
        )}

        {/* Answer */}
        {hasContent && (
          <div
            className="rounded-2xl rounded-tl-sm px-4 py-3 relative overflow-hidden"
            style={{
              background: message.isError ? 'rgba(240,136,62,0.06)' : 'rgba(255,255,255,0.04)',
              border: `1px solid ${message.isError ? 'rgba(240,136,62,0.25)' : 'rgba(255,255,255,0.08)'}`,
            }}
          >
            {/* Left accent — amber for errors, violet for normal */}
            <div
              className="absolute left-0 top-3 bottom-3 w-px rounded-full"
              style={{
                background: message.isError
                  ? 'linear-gradient(to bottom, transparent, #f0883e, transparent)'
                  : 'linear-gradient(to bottom, transparent, #7c3aed, transparent)',
              }}
            />

            <div className="prose-opsiq text-sm pl-3" style={{ color: message.isError ? '#f0883e' : undefined }}>
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {message.content}
              </ReactMarkdown>
            </div>

            {/* Streaming cursor */}
            {isStreaming && hasContent && (
              <span
                className="inline-block w-0.5 h-3.5 ml-0.5 align-middle animate-pulse"
                style={{ background: '#7c3aed' }}
              />
            )}

            {message.toolsUsed?.length > 0 && (
              <SourcesFooter tools={message.toolsUsed} />
            )}
          </div>
        )}
      </div>
    </div>
  )
}

/* ── Thinking dots ───────────────────────────────────── */
function ThinkingDots() {
  return (
    <div className="flex items-center gap-1.5 px-1 py-2">
      {[0, 1, 2].map(i => (
        <span
          key={i}
          className="w-1.5 h-1.5 rounded-full animate-pulse-dot"
          style={{
            background: '#7c3aed',
            animationDelay: `${i * 0.2}s`,
            opacity: 0.7,
          }}
        />
      ))}
      <span className="text-[11px] ml-1 font-mono" style={{ color: 'rgba(255,255,255,0.25)' }}>thinking…</span>
    </div>
  )
}

/* ── Sources footer ──────────────────────────────────── */
function SourcesFooter({ tools }) {
  return (
    <div
      className="mt-3 pt-2.5 flex flex-wrap gap-1.5 pl-3"
      style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}
    >
      <span className="text-[10px] self-center mr-0.5" style={{ color: 'rgba(255,255,255,0.2)' }}>via</span>
      {tools.map(tool => (
        <span
          key={tool}
          className="font-mono text-[10px] px-2 py-0.5 rounded-full"
          style={{
            background: 'rgba(124,58,237,0.12)',
            border: '1px solid rgba(124,58,237,0.25)',
            color: '#a78bfa',
          }}
        >
          {tool}
        </span>
      ))}
    </div>
  )
}
