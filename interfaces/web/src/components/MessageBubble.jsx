import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import ToolStream from './ToolStream.jsx'

export default function MessageBubble({ message }) {
  return message.role === 'user'
    ? <UserBubble message={message} />
    : <AssistantBubble message={message} />
}

/* ── User bubble ─────────────────────────────────────────── */
function UserBubble({ message }) {
  return (
    <div className="flex justify-end animate-slide-up">
      <div
        className="max-w-[75%] rounded-2xl rounded-tr-sm px-4 py-3 shadow-lg"
        style={{
          background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
          boxShadow: '0 4px 24px rgba(99,102,241,0.25)',
        }}
      >
        <p className="text-sm text-white/95 whitespace-pre-wrap break-words leading-relaxed">
          {message.content}
        </p>
      </div>
    </div>
  )
}

/* ── Assistant bubble ────────────────────────────────────── */
function AssistantBubble({ message }) {
  const isStreaming  = message.streaming
  const hasContent   = !!message.content
  const hasToolEvents = message.toolEvents?.length > 0

  return (
    <div className="flex justify-start animate-slide-up">
      {/* Avatar */}
      <div className="shrink-0 mr-3 mt-0.5">
        <div className="relative w-7 h-7">
          <div className="absolute inset-0 rounded-lg bg-gradient-to-br from-cyan-500 to-violet-600 opacity-30 blur-sm" />
          <div
            className="relative w-7 h-7 rounded-lg flex items-center justify-center text-[11px]"
            style={{ background: 'linear-gradient(135deg, rgba(6,182,212,0.2), rgba(139,92,246,0.2))', border: '1px solid rgba(6,182,212,0.3)' }}
          >
            ⚡
          </div>
        </div>
      </div>

      <div className="max-w-[80%] min-w-0 space-y-2">
        {/* Tool stream */}
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
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.08)',
              backdropFilter: 'blur(12px)',
            }}
          >
            {/* Top accent line */}
            <div
              className="absolute top-0 left-0 right-0 h-px"
              style={{ background: 'linear-gradient(90deg, rgba(6,182,212,0.4), rgba(139,92,246,0.4), transparent)' }}
            />

            <div className="prose-opsiq text-sm">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {message.content}
              </ReactMarkdown>
            </div>

            {/* Streaming cursor */}
            {isStreaming && hasContent && (
              <span className="inline-block w-0.5 h-3.5 bg-indigo-400 animate-pulse ml-0.5 align-middle" />
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

/* ── Thinking dots ───────────────────────────────────────── */
function ThinkingDots() {
  return (
    <div className="flex items-center gap-1 px-1 py-2">
      {[0, 1, 2].map(i => (
        <span
          key={i}
          className="w-2 h-2 rounded-full animate-pulse-dot"
          style={{
            animationDelay: `${i * 0.18}s`,
            background: i === 0 ? '#06b6d4' : i === 1 ? '#8b5cf6' : '#6366f1',
          }}
        />
      ))}
      <span className="text-[11px] text-slate-600 ml-1.5 font-mono">thinking…</span>
    </div>
  )
}

/* ── Sources footer ──────────────────────────────────────── */
const TOOL_COLORS = {
  github:     { bg: 'rgba(16,185,129,0.1)',  border: 'rgba(16,185,129,0.3)',  text: '#6ee7b7' },
  datadog:    { bg: 'rgba(239,68,68,0.1)',   border: 'rgba(239,68,68,0.3)',   text: '#fca5a5' },
  jira:       { bg: 'rgba(59,130,246,0.1)',  border: 'rgba(59,130,246,0.3)',  text: '#93c5fd' },
  confluence: { bg: 'rgba(6,182,212,0.1)',   border: 'rgba(6,182,212,0.3)',   text: '#67e8f9' },
  slack:      { bg: 'rgba(234,179,8,0.1)',   border: 'rgba(234,179,8,0.3)',   text: '#fde047' },
  grafana:    { bg: 'rgba(249,115,22,0.1)',  border: 'rgba(249,115,22,0.3)',  text: '#fdba74' },
  prometheus: { bg: 'rgba(239,68,68,0.1)',   border: 'rgba(239,68,68,0.3)',   text: '#fca5a5' },
}

function SourcesFooter({ tools }) {
  return (
    <div className="mt-3 pt-3 flex flex-wrap gap-1.5" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
      <span className="text-[10px] text-slate-600 self-center mr-1">via</span>
      {tools.map(tool => {
        const key = tool.toLowerCase().split('_')[0]
        const c = TOOL_COLORS[key] ?? { bg: 'rgba(99,102,241,0.1)', border: 'rgba(99,102,241,0.3)', text: '#a5b4fc' }
        return (
          <span
            key={tool}
            className="font-mono text-[10px] px-2 py-0.5 rounded-md"
            style={{ background: c.bg, border: `1px solid ${c.border}`, color: c.text }}
          >
            {tool}
          </span>
        )
      })}
    </div>
  )
}
