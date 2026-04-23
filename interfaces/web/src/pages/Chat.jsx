import { useState, useEffect, useRef, useCallback } from 'react'
import { Link } from 'react-router-dom'
import MessageBubble from '../components/MessageBubble.jsx'
import InputBar from '../components/InputBar.jsx'

const WS_BASE = import.meta.env.VITE_WS_URL
  ? import.meta.env.VITE_WS_URL.replace('https://', 'wss://').replace('http://', 'ws://')
  : 'ws://localhost:8000'

function getOrCreateSessionId() {
  const key = 'opsiq-session-id'
  let id = localStorage.getItem(key)
  if (!id) { id = crypto.randomUUID(); localStorage.setItem(key, id) }
  return id
}

const WS_CONNECTING = 'connecting'
const WS_OPEN       = 'open'
const WS_CLOSED     = 'closed'

/* ── Starfield ───────────────────────────────────────────────────────── */
const STARS = Array.from({ length: 100 }, (_, i) => ({
  x:       ((i * 137.508 + 23) % 100).toFixed(2),
  y:       ((i * 97.31  + 11) % 100).toFixed(2),
  size:    i % 7 === 0 ? 2 : i % 3 === 0 ? 1.5 : 1,
  opacity: 0.15 + (i % 5) * 0.08,
  delay:   (i % 30) * 0.1,
}))

function Starfield() {
  return (
    <div className="pointer-events-none fixed inset-0 overflow-hidden">
      {STARS.map((s, i) => (
        <div key={i} className="absolute rounded-full animate-star-pulse"
          style={{
            left: `${s.x}%`, top: `${s.y}%`,
            width: `${s.size}px`, height: `${s.size}px`,
            background: 'white', opacity: s.opacity,
            animationDelay: `${s.delay}s`,
            animationDuration: `${3 + (i % 4)}s`,
          }} />
      ))}
    </div>
  )
}

/* ── WS status pill ──────────────────────────────────────────────────── */
function WsStatusPill({ status }) {
  const cfg = {
    [WS_OPEN]:       { color: '#00d4aa', label: 'Connected' },
    [WS_CONNECTING]: { color: '#fbbf24', label: 'Connecting…' },
    [WS_CLOSED]:     { color: '#f87171', label: 'Offline' },
  }[status]
  return (
    <div className="flex items-center gap-1.5">
      <span className="w-1.5 h-1.5 rounded-full"
        style={{ background: cfg.color, boxShadow: `0 0 6px ${cfg.color}` }} />
      <span className="text-[11px] font-medium font-sans" style={{ color: cfg.color }}>{cfg.label}</span>
    </div>
  )
}

/* ── Empty state ─────────────────────────────────────────────────────── */
const EXAMPLES = [
  { icon: '🚀', text: 'What deployed to production in the last hour?' },
  { icon: '🔥', text: 'Are there any active P1 alerts right now?' },
  { icon: '📋', text: 'Summarize blocked tickets in the INFRA sprint' },
  { icon: '📈', text: 'Which service has the highest error rate today?' },
  { icon: '📖', text: 'Find the runbook for database failover' },
]

const INTEGRATIONS = ['GitHub', 'Datadog', 'Jira', 'Grafana', 'Slack', 'Confluence', 'Prometheus', 'New Relic']

function EmptyState({ onSelect, wsStatus }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center animate-fade-in">
      <div className="inline-flex items-center gap-2 text-[11px] font-medium font-sans px-3 py-1.5 rounded-full mb-8 animate-badge-glow"
        style={{ background: 'rgba(0,212,170,0.1)', border: '1px solid rgba(0,212,170,0.28)', color: '#00d4aa' }}>
        <span className="w-1.5 h-1.5 rounded-full" style={{ background: '#00d4aa', boxShadow: '0 0 6px #00d4aa' }} />
        AI-powered DevOps intelligence
      </div>

      <h1 className="font-syne font-bold text-white leading-[1.1] mb-4 max-w-lg"
        style={{ fontSize: 'clamp(1.75rem, 3.5vw, 2.4rem)', letterSpacing: '-0.02em' }}>
        Intelligent Ops for{' '}
        <span style={{ color: '#00d4aa' }}>Modern Teams.</span> ⚡
      </h1>

      <p className="text-base font-sans mb-10 max-w-sm" style={{ color: 'rgba(255,255,255,0.45)' }}>
        Ask anything about your stack. OpsIQ orchestrates your tools and answers instantly.
      </p>

      <div className="flex flex-wrap justify-center gap-2 mb-12">
        {INTEGRATIONS.map(name => (
          <span key={name} className="text-[11px] font-medium font-sans px-3 py-1 rounded-full"
            style={{ background: 'rgba(0,212,170,0.08)', border: '1px solid rgba(0,212,170,0.2)', color: 'rgba(255,255,255,0.5)' }}>
            {name}
          </span>
        ))}
      </div>

      <p className="text-[10px] font-semibold uppercase tracking-[0.15em] mb-4 font-sans"
        style={{ color: 'rgba(255,255,255,0.2)' }}>
        Try asking
      </p>
      <div className="grid gap-2.5 w-full max-w-md">
        {EXAMPLES.map(({ icon, text }) => (
          <button key={text} onClick={() => onSelect(text)}
            disabled={wsStatus !== WS_OPEN}
            className="group flex items-center gap-3 text-left text-[13px] rounded-2xl px-5 py-3.5 transition-all duration-200 disabled:opacity-30 disabled:cursor-not-allowed font-sans"
            style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.6)' }}
            onMouseEnter={e => {
              e.currentTarget.style.background  = 'rgba(0,212,170,0.08)'
              e.currentTarget.style.borderColor = 'rgba(0,212,170,0.28)'
              e.currentTarget.style.color       = 'rgba(255,255,255,0.9)'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background  = 'rgba(255,255,255,0.03)'
              e.currentTarget.style.borderColor = 'rgba(255,255,255,0.07)'
              e.currentTarget.style.color       = 'rgba(255,255,255,0.6)'
            }}>
            <span className="text-base shrink-0">{icon}</span>
            <span className="flex-1">{text}</span>
            <svg viewBox="0 0 16 16" fill="none"
              className="w-3.5 h-3.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
              stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 8h10M9 4l4 4-4 4"/>
            </svg>
          </button>
        ))}
      </div>
    </div>
  )
}

/* ── Chat page ───────────────────────────────────────────────────────── */
export default function Chat() {
  const [messages,      setMessages]      = useState([])
  const [input,         setInput]         = useState('')
  const [streaming,     setStreaming]     = useState(false)
  const [wsStatus,      setWsStatus]      = useState(WS_CLOSED)
  const [creditsBanner, setCreditsBanner] = useState(false)

  const sessionId      = useRef(getOrCreateSessionId())
  const ws             = useRef(null)
  const bottomRef      = useRef(null)
  const reconnectTimer = useRef(null)

  const connect = useCallback(() => {
    if (ws.current?.readyState === WebSocket.OPEN) return
    setWsStatus(WS_CONNECTING)
    const socket = new WebSocket(`${WS_BASE}/ws/${sessionId.current}`)
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
      case 'error': {
        const msg = event.message ?? ''
        if (event.status === 402 || /credit|billing|quota|payment/i.test(msg))
          setCreditsBanner(true)
        setMessages(prev => {
          const last = prev[prev.length - 1]
          if (last?.role === 'assistant' && last.streaming)
            return [...prev.slice(0,-1), { ...last, streaming: false, content: `**Error:** ${msg}`, toolsUsed: [] }]
          return prev
        })
        setStreaming(false); break
      }
      default: break
    }
  }

  function sendQuery() {
    const query = input.trim()
    if (!query || streaming || ws.current?.readyState !== WebSocket.OPEN) return
    setMessages(prev => [
      ...prev,
      { id: crypto.randomUUID(), role: 'user',      content: query },
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
      { id: crypto.randomUUID(), role: 'user',      content: text },
      { id: crypto.randomUUID(), role: 'assistant', content: '', streaming: true, toolEvents: [], toolsUsed: [] },
    ])
    setStreaming(true)
    ws.current.send(JSON.stringify({ query: text }))
  }

  return (
    <div className="chat-root" style={{ background: '#070b10' }}>
      <Starfield />

      {/* Ambient glow */}
      <div className="pointer-events-none fixed animate-orb-drift"
        style={{
          top: '5%', left: '50%', transform: 'translateX(-50%)',
          width: '700px', height: '500px',
          background: 'radial-gradient(ellipse at center, rgba(0,212,170,0.08) 0%, rgba(124,58,237,0.05) 50%, transparent 75%)',
          filter: 'blur(30px)', zIndex: 0,
        }} />

      {/* Credits banner */}
      {creditsBanner && (
        <div className="relative z-20 flex items-center justify-between gap-4 px-5 py-3 text-sm animate-fade-in font-sans"
          style={{ background: 'rgba(0,212,170,0.07)', borderBottom: '1px solid rgba(0,212,170,0.18)' }}>
          <span style={{ color: 'rgba(255,255,255,0.85)' }}>
            API credits exhausted. Add credits at{' '}
            <a href="https://console.anthropic.com" target="_blank" rel="noreferrer"
              style={{ color: '#00d4aa', textDecoration: 'underline' }}>console.anthropic.com</a>
            {' '}or try{' '}
            <a href="https://opsiq.theinfinityloop.space/pricing" target="_blank" rel="noreferrer"
              style={{ color: '#00d4aa', textDecoration: 'underline' }}>OpsIQ Cloud</a>.
          </span>
          <button onClick={() => setCreditsBanner(false)}
            className="shrink-0 text-xs px-2 py-1 rounded-lg transition-colors font-sans"
            style={{ color: 'rgba(255,255,255,0.4)', border: '1px solid rgba(255,255,255,0.1)' }}
            onMouseEnter={e => e.currentTarget.style.color = 'white'}
            onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.4)'}>
            ✕
          </button>
        </div>
      )}

      {/* Header */}
      <header className="relative z-10 shrink-0 flex items-center justify-between px-6 py-4"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', background: 'rgba(7,11,16,0.75)', backdropFilter: 'blur(20px)' }}>
        <div className="flex items-center gap-3">
          <Link to="/" className="flex items-center gap-2.5 group">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center font-bold text-sm transition-opacity"
              style={{ background: '#7c3aed', boxShadow: '0 0 16px rgba(124,58,237,0.5)' }}>
              ⚡
            </div>
            <span className="font-syne font-bold text-white text-sm tracking-tight group-hover:opacity-75 transition-opacity">
              OpsIQ
            </span>
          </Link>
          <span className="font-mono text-[9px] px-2 py-0.5 rounded-full"
            style={{ color: 'rgba(255,255,255,0.28)', border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.03)' }}>
            {sessionId.current.slice(0, 8)}
          </span>
        </div>
        <div className="flex items-center gap-4">
          <WsStatusPill status={wsStatus} />
          <button onClick={newSession}
            className="text-[12px] font-medium font-sans px-3 py-1.5 rounded-full transition-all"
            style={{ color: 'rgba(255,255,255,0.45)', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.03)' }}
            onMouseEnter={e => { e.currentTarget.style.color = 'white'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)' }}
            onMouseLeave={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.45)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)' }}>
            New session
          </button>
        </div>
      </header>

      {/* Messages */}
      <main className="relative z-10 flex-1 overflow-y-auto px-4 py-6">
        <div className="max-w-2xl mx-auto space-y-5">
          {messages.length === 0 && <EmptyState onSelect={selectExample} wsStatus={wsStatus} />}
          {messages.map(msg => (
            <MessageBubble key={msg.id} message={msg} />
          ))}
          <div ref={bottomRef} />
        </div>
      </main>

      {/* Input */}
      <div className="relative z-10 shrink-0 max-w-2xl mx-auto w-full">
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
