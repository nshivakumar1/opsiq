import { useState, useEffect, useRef, useCallback } from 'react'
import MessageBubble from './components/MessageBubble.jsx'
import InputBar from './components/InputBar.jsx'

function getOrCreateSessionId() {
  const key = 'opsiq-session-id'
  let id = localStorage.getItem(key)
  if (!id) { id = crypto.randomUUID(); localStorage.setItem(key, id) }
  return id
}

function wsUrl(sessionId) {
  const proto = window.location.protocol === 'https:' ? 'wss' : 'ws'
  return `${proto}://${window.location.host}/ws/${sessionId}`
}

const WS_CONNECTING = 'connecting'
const WS_OPEN       = 'open'
const WS_CLOSED     = 'closed'

export default function App() {
  const [messages,  setMessages]  = useState([])
  const [input,     setInput]     = useState('')
  const [streaming, setStreaming] = useState(false)
  const [wsStatus,  setWsStatus]  = useState(WS_CLOSED)

  const sessionId      = useRef(getOrCreateSessionId())
  const ws             = useRef(null)
  const bottomRef      = useRef(null)
  const reconnectTimer = useRef(null)

  const connect = useCallback(() => {
    if (ws.current?.readyState === WebSocket.OPEN) return
    setWsStatus(WS_CONNECTING)
    const socket = new WebSocket(wsUrl(sessionId.current))
    socket.onopen    = () => setWsStatus(WS_OPEN)
    socket.onclose   = () => { setWsStatus(WS_CLOSED); reconnectTimer.current = setTimeout(connect, 3000) }
    socket.onerror   = () => socket.close()
    socket.onmessage = (e) => handleWsEvent(JSON.parse(e.data))
    ws.current = socket
  }, []) // eslint-disable-line

  useEffect(() => {
    connect()
    return () => { clearTimeout(reconnectTimer.current); ws.current?.close() }
  }, [connect])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  function handleWsEvent(event) {
    switch (event.type) {
      case 'tool_call':
      case 'tool_result':
        setMessages(prev => {
          const last = prev[prev.length - 1]
          if (last?.role === 'assistant' && last.streaming)
            return [...prev.slice(0,-1), { ...last, toolEvents: [...(last.toolEvents ?? []), event] }]
          return prev
        }); break
      case 'text_chunk':
        setMessages(prev => {
          const last = prev[prev.length - 1]
          if (last?.role === 'assistant' && last.streaming)
            return [...prev.slice(0,-1), { ...last, content: event.text }]
          return prev
        }); break
      case 'done':
        setMessages(prev => {
          const last = prev[prev.length - 1]
          if (last?.role === 'assistant' && last.streaming)
            return [...prev.slice(0,-1), { ...last, streaming: false, toolsUsed: event.tools_used ?? [] }]
          return prev
        })
        setStreaming(false); break
      case 'error':
        setMessages(prev => {
          const last = prev[prev.length - 1]
          if (last?.role === 'assistant' && last.streaming)
            return [...prev.slice(0,-1), { ...last, streaming: false, content: `**Error:** ${event.message}`, toolsUsed: [] }]
          return prev
        })
        setStreaming(false); break
      default: break
    }
  }

  function sendQuery() {
    const query = input.trim()
    if (!query || streaming || ws.current?.readyState !== WebSocket.OPEN) return
    setMessages(prev => [
      ...prev,
      { id: crypto.randomUUID(), role: 'user', content: query },
      { id: crypto.randomUUID(), role: 'assistant', content: '', streaming: true, toolEvents: [], toolsUsed: [] },
    ])
    setInput('')
    setStreaming(true)
    ws.current.send(JSON.stringify({ query }))
  }

  function newSession() {
    const id = crypto.randomUUID()
    localStorage.setItem('opsiq-session-id', id)
    sessionId.current = id
    setMessages([])
    setStreaming(false)
    ws.current?.close()
  }

  function selectExample(text) {
    if (streaming || ws.current?.readyState !== WebSocket.OPEN) return
    setMessages(prev => [
      ...prev,
      { id: crypto.randomUUID(), role: 'user', content: text },
      { id: crypto.randomUUID(), role: 'assistant', content: '', streaming: true, toolEvents: [], toolsUsed: [] },
    ])
    setStreaming(true)
    ws.current.send(JSON.stringify({ query: text }))
  }

  return (
    <div className="relative flex flex-col h-full overflow-hidden">

      {/* ── Animated background ─────────────────────────── */}
      <div className="pointer-events-none fixed inset-0 grid-overlay" />
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        {/* Orb 1 — cyan */}
        <div
          className="absolute w-[600px] h-[600px] rounded-full animate-orb-1"
          style={{
            top: '-200px', left: '-150px',
            background: 'radial-gradient(circle, rgba(6,182,212,0.12) 0%, transparent 70%)',
            filter: 'blur(40px)',
          }}
        />
        {/* Orb 2 — violet */}
        <div
          className="absolute w-[500px] h-[500px] rounded-full animate-orb-2"
          style={{
            bottom: '-100px', right: '-100px',
            background: 'radial-gradient(circle, rgba(139,92,246,0.12) 0%, transparent 70%)',
            filter: 'blur(40px)',
          }}
        />
        {/* Orb 3 — indigo */}
        <div
          className="absolute w-[400px] h-[400px] rounded-full animate-orb-3"
          style={{
            top: '40%', left: '50%',
            background: 'radial-gradient(circle, rgba(99,102,241,0.08) 0%, transparent 70%)',
            filter: 'blur(60px)',
          }}
        />
      </div>

      {/* ── Header ──────────────────────────────────────── */}
      <header className="relative z-10 shrink-0 flex items-center justify-between px-5 py-3 glass border-b border-white/5">
        <div className="flex items-center gap-3">
          {/* Logo mark */}
          <div className="relative w-7 h-7 flex items-center justify-center">
            <div className="absolute inset-0 rounded-lg bg-gradient-to-br from-cyan-500 to-violet-600 opacity-20 blur-sm" />
            <div className="relative w-7 h-7 rounded-lg bg-gradient-to-br from-cyan-500 to-violet-600 flex items-center justify-center text-[11px] font-bold text-white shadow-lg">
              ⚡
            </div>
          </div>
          <span className="font-bold text-gradient text-base tracking-tight">OpsIQ</span>
          {/* Session badge */}
          <span className="font-mono text-[9px] px-1.5 py-0.5 rounded-md border border-white/10 text-slate-500"
            style={{ background: 'rgba(255,255,255,0.03)' }}>
            {sessionId.current.slice(0, 8)}
          </span>
        </div>
        <div className="flex items-center gap-4">
          <WsStatusPill status={wsStatus} />
          <button
            onClick={newSession}
            className="flex items-center gap-1.5 text-[11px] text-slate-500 hover:text-slate-300 transition-colors px-2.5 py-1 rounded-lg hover:bg-white/5"
          >
            <svg viewBox="0 0 16 16" fill="currentColor" className="w-3 h-3">
              <path d="M1.5 8A6.5 6.5 0 1 1 8 14.5M1.5 8H4m-2.5 0L3 6m-1.5 2L3 10" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
            </svg>
            New session
          </button>
        </div>
      </header>

      {/* ── Messages ────────────────────────────────────── */}
      <main className="relative z-10 flex-1 overflow-y-auto px-4 py-6">
        <div className="max-w-3xl mx-auto space-y-6">
          {messages.length === 0 && <EmptyState onSelect={selectExample} wsStatus={wsStatus} />}
          {messages.map(msg => (
            <MessageBubble key={msg.id} message={msg} />
          ))}
          <div ref={bottomRef} />
        </div>
      </main>

      {/* ── Input ───────────────────────────────────────── */}
      <div className="relative z-10 shrink-0 max-w-3xl mx-auto w-full">
        <InputBar
          value={input}
          onChange={setInput}
          onSubmit={sendQuery}
          disabled={streaming || wsStatus !== WS_OPEN}
        />
      </div>
    </div>
  )
}

/* ── WS status pill ──────────────────────────────────────── */
function WsStatusPill({ status }) {
  const cfg = {
    [WS_OPEN]:       { dot: 'bg-emerald-400', glow: 'shadow-emerald-500/50', label: 'Connected',    text: 'text-emerald-400' },
    [WS_CONNECTING]: { dot: 'bg-amber-400 animate-pulse', glow: '', label: 'Connecting…', text: 'text-amber-400' },
    [WS_CLOSED]:     { dot: 'bg-red-500',     glow: '',                      label: 'Offline',       text: 'text-red-400' },
  }[status]

  return (
    <div className="flex items-center gap-1.5">
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot} shadow ${cfg.glow}`} />
      <span className={`text-[10px] font-medium ${cfg.text}`}>{cfg.label}</span>
    </div>
  )
}

/* ── Empty state ─────────────────────────────────────────── */
const EXAMPLES = [
  { icon: '🚀', text: 'What deployed to production in the last hour?' },
  { icon: '🔥', text: 'Are there any active P1 alerts right now?' },
  { icon: '📋', text: 'Summarize blocked tickets in the INFRA sprint' },
  { icon: '📈', text: 'Which service has the highest error rate today?' },
  { icon: '📖', text: 'Find the runbook for database failover' },
]

function EmptyState({ onSelect, wsStatus }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center animate-fade-in select-none">

      {/* Hero logo */}
      <div className="relative mb-6 animate-float">
        <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-cyan-500 to-violet-600 blur-2xl opacity-30" />
        <div className="relative w-16 h-16 rounded-2xl bg-gradient-to-br from-cyan-500 via-indigo-500 to-violet-600 flex items-center justify-center text-3xl shadow-xl">
          ⚡
        </div>
      </div>

      <h1 className="text-3xl font-bold text-gradient mb-2">OpsIQ</h1>
      <p className="text-sm text-slate-500 mb-1 max-w-xs">
        AI-powered DevOps intelligence agent
      </p>
      <p className="text-[11px] text-slate-600 mb-10 max-w-xs">
        Powered by Claude · Real-time streaming · Multi-tool orchestration
      </p>

      {/* Capability badges */}
      <div className="flex flex-wrap justify-center gap-2 mb-10">
        {['GitHub', 'Datadog', 'Jira', 'Grafana', 'Slack', 'Confluence', 'Prometheus'].map(cap => (
          <span
            key={cap}
            className="text-[10px] px-2.5 py-1 rounded-full font-medium border"
            style={{
              background: 'rgba(99,102,241,0.07)',
              borderColor: 'rgba(99,102,241,0.2)',
              color: '#a5b4fc',
            }}
          >
            {cap}
          </span>
        ))}
      </div>

      {/* Example chips */}
      <p className="text-[11px] text-slate-600 uppercase tracking-widest mb-3">Try asking</p>
      <div className="grid gap-2 w-full max-w-lg">
        {EXAMPLES.map(({ icon, text }) => (
          <button
            key={text}
            onClick={() => onSelect(text)}
            disabled={wsStatus !== WS_OPEN}
            className="group flex items-center gap-3 text-left text-xs text-slate-400 rounded-xl px-4 py-3 transition-all duration-200
              disabled:opacity-40 disabled:cursor-not-allowed"
            style={{
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.06)',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = 'rgba(99,102,241,0.08)'
              e.currentTarget.style.borderColor = 'rgba(99,102,241,0.25)'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = 'rgba(255,255,255,0.03)'
              e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)'
            }}
          >
            <span className="text-base shrink-0">{icon}</span>
            <span className="flex-1">{text}</span>
            <svg viewBox="0 0 16 16" fill="currentColor" className="w-3 h-3 text-slate-600 group-hover:text-indigo-400 transition-colors shrink-0">
              <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        ))}
      </div>
    </div>
  )
}
