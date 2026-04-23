import { useState, useEffect, useRef, useCallback } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAuth0 } from '@auth0/auth0-react'
import MessageBubble from '../components/MessageBubble.jsx'
import InputBar from '../components/InputBar.jsx'
import UserMenu from '../components/UserMenu.jsx'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000'
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
const WS_REST       = 'rest'

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
    [WS_REST]:       { color: '#f0883e', label: 'REST fallback' },
  }[status] ?? { color: '#f87171', label: 'Offline' }
  return (
    <div className="flex items-center gap-1.5">
      <span className="w-1.5 h-1.5 rounded-full"
        style={{ background: cfg.color, boxShadow: `0 0 6px ${cfg.color}` }} />
      <span className="text-[11px] font-medium font-sans" style={{ color: cfg.color }}>{cfg.label}</span>
    </div>
  )
}

/* ── Usage bar ───────────────────────────────────────────────────────── */
function UsageBar({ cloudInfo, onUpgradeClick }) {
  if (!cloudInfo || cloudInfo.query_limit === null) return null

  const used  = cloudInfo.query_count_month ?? 0
  const limit = cloudInfo.query_limit
  const pct   = Math.min(100, (used / limit) * 100)
  const color = pct >= 95 ? '#f87171' : pct >= 80 ? '#f0883e' : '#00d4aa'

  return (
    <div className="flex items-center gap-2 select-none">
      <span className="text-[11px] font-mono whitespace-nowrap" style={{ color: 'rgba(255,255,255,0.35)' }}>
        {limit - used < 0 ? 0 : limit - used}/{limit}
      </span>
      <div
        className="w-14 h-1 rounded-full overflow-hidden"
        style={{ background: 'rgba(255,255,255,0.08)', cursor: cloudInfo.plan === 'free' ? 'pointer' : 'default' }}
        onClick={cloudInfo.plan === 'free' ? onUpgradeClick : undefined}
        title={`${used} of ${limit} queries used this month`}
      >
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
    </div>
  )
}

/* ── Upgrade modal ───────────────────────────────────────────────────── */
function UpgradeModal({ onClose, onUpgrade, upgradeLoading }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in"
      style={{ background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(10px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className="relative max-w-md w-full rounded-2xl p-8"
        style={{
          background: '#0f1520',
          border: '1px solid rgba(124,58,237,0.35)',
          boxShadow: '0 0 60px rgba(124,58,237,0.18)',
        }}
      >
        {/* Close */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-sm rounded-lg px-2 py-1 transition-colors font-sans"
          style={{ color: 'rgba(255,255,255,0.3)', border: '1px solid rgba(255,255,255,0.08)' }}
          onMouseEnter={e => e.currentTarget.style.color = 'white'}
          onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.3)'}
        >✕</button>

        {/* Icon */}
        <div
          className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl mb-6"
          style={{ background: 'rgba(124,58,237,0.15)', border: '1px solid rgba(124,58,237,0.3)' }}
        >⚡</div>

        <h2 className="font-syne font-bold text-white text-xl mb-2">
          You've used all your free queries
        </h2>
        <p className="text-[14px] leading-relaxed mb-6 font-sans" style={{ color: 'rgba(255,255,255,0.5)' }}>
          Upgrade to Pro for{' '}
          <span style={{ color: '#a78bfa' }}>2,000 queries/month</span>,
          hosted infrastructure, and API access included. No setup required.
        </p>

        {/* Feature list */}
        <ul className="space-y-2 mb-7">
          {[
            '2,000 queries per month',
            'Hosted on OpsIQ Cloud',
            'API access included',
            'Slack bot provisioned',
            'Priority support',
          ].map(f => (
            <li key={f} className="flex items-center gap-2.5 text-[13px] font-sans" style={{ color: 'rgba(255,255,255,0.65)' }}>
              <span style={{ color: '#7c3aed' }}>✓</span>{f}
            </li>
          ))}
        </ul>

        <button
          onClick={onUpgrade}
          disabled={upgradeLoading}
          className="w-full py-3 rounded-xl text-[13px] font-bold font-sans transition-opacity"
          style={{
            background: 'linear-gradient(135deg, #7c3aed, #6d28d9)',
            color: 'white',
            boxShadow: '0 4px 24px rgba(124,58,237,0.4)',
            opacity: upgradeLoading ? 0.6 : 1,
            cursor: upgradeLoading ? 'wait' : 'pointer',
          }}
          onMouseEnter={e => { if (!upgradeLoading) e.currentTarget.style.opacity = '0.85' }}
          onMouseLeave={e => { if (!upgradeLoading) e.currentTarget.style.opacity = '1' }}
        >
          {upgradeLoading ? 'Redirecting to Stripe…' : 'Upgrade to Pro — $49/mo →'}
        </button>

        <button
          onClick={onClose}
          className="w-full mt-3 py-2.5 text-[12px] font-sans transition-colors"
          style={{ color: 'rgba(255,255,255,0.3)' }}
          onMouseEnter={e => e.currentTarget.style.color = 'rgba(255,255,255,0.6)'}
          onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.3)'}
        >
          Maybe later
        </button>
      </div>
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

function EmptyState({ onSelect, canSend, firstName }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center animate-fade-in">
      <div className="inline-flex items-center gap-2 text-[11px] font-medium font-sans px-3 py-1.5 rounded-full mb-8 animate-badge-glow"
        style={{ background: 'rgba(0,212,170,0.1)', border: '1px solid rgba(0,212,170,0.28)', color: '#00d4aa' }}>
        <span className="w-1.5 h-1.5 rounded-full" style={{ background: '#00d4aa', boxShadow: '0 0 6px #00d4aa' }} />
        AI-powered DevOps intelligence
      </div>

      <h1 className="font-syne font-bold text-white leading-[1.1] mb-4 max-w-lg"
        style={{ fontSize: 'clamp(1.75rem, 3.5vw, 2.4rem)', letterSpacing: '-0.02em' }}>
        {firstName
          ? <>Welcome back, <span style={{ color: '#00d4aa' }}>{firstName}.</span> ⚡</>
          : <>Intelligent Ops for{' '}<span style={{ color: '#00d4aa' }}>Modern Teams.</span> ⚡</>
        }
      </h1>

      <p className="text-base font-sans mb-10 max-w-sm" style={{ color: 'rgba(255,255,255,0.45)' }}>
        {firstName
          ? 'What do you want to query today?'
          : 'Ask anything about your stack. OpsIQ orchestrates your tools and answers instantly.'
        }
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
            disabled={!canSend}
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
  const { user, getAccessTokenSilently } = useAuth0()
  const location = useLocation()

  const [messages,       setMessages]       = useState([])
  const [input,          setInput]          = useState('')
  const [streaming,      setStreaming]       = useState(false)
  const [wsStatus,       setWsStatus]       = useState(WS_CLOSED)
  const [creditsBanner,  setCreditsBanner]  = useState(false)
  const [cloudInfo,       setCloudInfo]       = useState(null)
  const [showUpgrade,     setShowUpgrade]     = useState(false)
  const [upgradeLoading,  setUpgradeLoading]  = useState(false)
  const [upgradeSuccess,  setUpgradeSuccess]  = useState(false)

  const sessionId        = useRef(getOrCreateSessionId())
  const ws               = useRef(null)
  const bottomRef        = useRef(null)
  const reconnectTimer   = useRef(null)
  const wsConnectTimer   = useRef(null)
  const streamingRef     = useRef(false)
  const pendingQueryRef  = useRef('')
  const sendQueryRESTRef = useRef(null)

  useEffect(() => { streamingRef.current = streaming }, [streaming])

  /* ── Cloud: fetch usage info ─────────────────────────────────────────── */
  const fetchCloudInfo = useCallback(async () => {
    try {
      const token = await getAccessTokenSilently({
        authorizationParams: { audience: import.meta.env.VITE_AUTH0_AUDIENCE },
      })
      const res = await fetch(`${API_BASE}/cloud/me`, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      })
      if (res.ok) {
        const data = await res.json()
        setCloudInfo(data)
        return data
      }
    } catch (err) {
      console.error('fetchCloudInfo failed:', err)
    }
    return null
  }, [getAccessTokenSilently])

  // Fetch on mount; handle Stripe return params
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)

    if (params.get('upgraded') === 'true') {
      window.history.replaceState({}, '', '/app')
      setUpgradeSuccess(true)
      // Poll /cloud/me every 2s until plan === "pro" (max 10 attempts)
      let attempts = 0
      const pollInterval = setInterval(async () => {
        attempts++
        const data = await fetchCloudInfo()
        if (data?.plan === 'pro' || attempts >= 10) {
          clearInterval(pollInterval)
          if (data?.plan === 'pro') {
            console.log('Pro plan confirmed!')
          }
        }
      }, 2000)
    } else if (params.get('upgrade') === 'true') {
      window.history.replaceState({}, '', '/app')
      setShowUpgrade(true)
    }

    fetchCloudInfo()
  }, []) // eslint-disable-line

  /* ── Cloud: upgrade handler ──────────────────────────────────────────── */
  async function handleUpgrade() {
    setUpgradeLoading(true)
    try {
      const headers = { 'Content-Type': 'application/json' }
      try {
        const token = await getAccessTokenSilently({
          authorizationParams: { audience: import.meta.env.VITE_AUTH0_AUDIENCE },
        })
        if (token) headers['Authorization'] = `Bearer ${token}`
      } catch { /* OSS */ }

      const res  = await fetch(`${API_BASE}/cloud/billing/checkout`, {
        method: 'POST', headers,
        body: JSON.stringify({ plan: 'pro' }),
      })
      const data = await res.json()
      if (data.checkout_url) window.location.href = data.checkout_url
    } catch (err) {
      console.error('Upgrade error:', err)
    } finally {
      setUpgradeLoading(false)
    }
  }

  /* ── REST fallback ───────────────────────────────────────────────────── */
  async function sendQueryREST(query) {
    try {
      const headers = { 'Content-Type': 'application/json' }
      try {
        const token = await getAccessTokenSilently({
          authorizationParams: { audience: import.meta.env.VITE_AUTH0_AUDIENCE },
        })
        if (token) headers['Authorization'] = `Bearer ${token}`
      } catch { /* OSS mode */ }

      const res = await fetch(`${API_BASE}/query`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ query, session_id: sessionId.current }),
      })

      if (res.status === 429) {
        const data = await res.json().catch(() => ({}))
        const msg  = data?.detail?.message ?? 'Query limit reached.'
        setMessages(prev => prev.map(msg =>
          (msg.role === 'assistant' && msg.streaming)
            ? { ...msg, content: `⚠️ ${msg}`, toolsUsed: [], streaming: false, isError: true }
            : msg
        ))
        setShowUpgrade(true)
        return
      }

      if (!res.ok) throw new Error(`HTTP ${res.status}`)

      const data = await res.json()

      if (data.status === 402 || /credit|billing|quota|payment/i.test(data.answer ?? ''))
        setCreditsBanner(true)

      setMessages(prev => prev.map(m =>
        (m.role === 'assistant' && m.streaming)
          ? { ...m, content: data.answer, toolsUsed: data.tools_used ?? [], streaming: false }
          : m
      ))

      fetchCloudInfo() // refresh usage count
    } catch (err) {
      console.error('REST fallback error:', err)
      setMessages(prev => prev.map(m =>
        (m.role === 'assistant' && m.streaming)
          ? { ...m, content: `⚠️ Could not reach OpsIQ backend — ${err.message}`, toolsUsed: [], streaming: false, isError: true }
          : m
      ))
    } finally {
      setStreaming(false)
      pendingQueryRef.current = ''
    }
  }

  sendQueryRESTRef.current = sendQueryREST

  /* ── WebSocket connection ────────────────────────────────────────────── */
  const connect = useCallback(async () => {
    if (ws.current?.readyState === WebSocket.OPEN) return
    setWsStatus(WS_CONNECTING)

    let wsUrl = `${WS_BASE}/ws/${sessionId.current}`
    try {
      const token = await getAccessTokenSilently({
        authorizationParams: { audience: import.meta.env.VITE_AUTH0_AUDIENCE },
      })
      wsUrl += `?token=${encodeURIComponent(token)}`
    } catch { /* OSS mode */ }

    wsConnectTimer.current = setTimeout(() => {
      if (ws.current?.readyState !== WebSocket.OPEN) {
        console.warn('WebSocket connection timed out — REST fallback active')
        setWsStatus(WS_REST)
      }
    }, 10000)

    const socket = new WebSocket(wsUrl)

    socket.onopen = () => {
      clearTimeout(wsConnectTimer.current)
      setWsStatus(WS_OPEN)
    }

    socket.onerror = (err) => {
      console.error('WebSocket error:', err)
    }

    socket.onclose = (event) => {
      clearTimeout(wsConnectTimer.current)
      setWsStatus(WS_CLOSED)

      if (event.code !== 1000 && streamingRef.current && pendingQueryRef.current) {
        console.warn(`WebSocket closed mid-stream (code ${event.code}) — falling back to REST`)
        sendQueryRESTRef.current?.(pendingQueryRef.current)
      }

      reconnectTimer.current = setTimeout(connect, 3000)
    }

    socket.onmessage = (e) => handleWsEvent(JSON.parse(e.data))
    ws.current = socket
  }, [getAccessTokenSilently]) // eslint-disable-line

  useEffect(() => {
    connect()
    return () => {
      clearTimeout(reconnectTimer.current)
      clearTimeout(wsConnectTimer.current)
      ws.current?.close()
    }
  }, [connect])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  /* ── WS event handler ────────────────────────────────────────────────── */
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
        setStreaming(false)
        pendingQueryRef.current = ''
        fetchCloudInfo() // refresh usage count after each query
        break

      case 'error': {
        const msg = event.message ?? ''

        if (event.code === 'query_limit_exceeded') {
          setShowUpgrade(true)
        } else if (
          event.status === 402 || event.code === 'insufficient_credits' ||
          /credit|billing|quota|payment/i.test(msg)
        ) {
          setCreditsBanner(true)
        }

        setMessages(prev => {
          const last = prev[prev.length - 1]
          if (last?.role === 'assistant' && last.streaming)
            return [...prev.slice(0,-1), { ...last, streaming: false, content: `⚠️ ${msg}`, isError: true, toolsUsed: [] }]
          return prev
        })
        setStreaming(false)
        pendingQueryRef.current = ''
        break
      }
      default: break
    }
  }

  /* ── Send ────────────────────────────────────────────────────────────── */
  async function sendQuery() {
    const query = input.trim()
    if (!query || streaming) return

    setMessages(prev => [
      ...prev,
      { id: crypto.randomUUID(), role: 'user',      content: query },
      { id: crypto.randomUUID(), role: 'assistant', content: '', streaming: true, toolEvents: [], toolsUsed: [] },
    ])
    setInput('')
    setStreaming(true)
    pendingQueryRef.current = query

    if (ws.current?.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify({ query }))
    } else {
      await sendQueryREST(query)
    }
  }

  function newSession() {
    const id = crypto.randomUUID()
    localStorage.setItem('opsiq-session-id', id)
    sessionId.current = id
    setMessages([])
    setStreaming(false)
    pendingQueryRef.current = ''
    ws.current?.close()
  }

  async function selectExample(text) {
    if (streaming) return

    setMessages(prev => [
      ...prev,
      { id: crypto.randomUUID(), role: 'user',      content: text },
      { id: crypto.randomUUID(), role: 'assistant', content: '', streaming: true, toolEvents: [], toolsUsed: [] },
    ])
    setStreaming(true)
    pendingQueryRef.current = text

    if (ws.current?.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify({ query: text }))
    } else {
      await sendQueryREST(text)
    }
  }

  const firstName = user?.given_name || user?.name?.split(' ')[0] || null

  /* ── Render ──────────────────────────────────────────────────────────── */
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

      {/* Upgrade success banner */}
      {upgradeSuccess && (
        <div className="relative z-20 flex items-center justify-between gap-4 px-5 py-3 text-sm animate-fade-in font-sans"
          style={{ background: 'rgba(0,212,170,0.07)', borderBottom: '1px solid rgba(0,212,170,0.18)' }}>
          <span style={{ color: 'rgba(255,255,255,0.85)' }}>
            ✓ Payment successful! Refreshing your plan...
          </span>
          <div className="flex items-center gap-2 shrink-0">
            <button onClick={fetchCloudInfo}
              className="text-xs px-2 py-1 rounded-lg transition-colors font-sans"
              style={{ color: '#00d4aa', border: '1px solid rgba(0,212,170,0.3)' }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(0,212,170,0.1)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
              Refresh
            </button>
            <button onClick={() => setUpgradeSuccess(false)}
              className="text-xs px-2 py-1 rounded-lg transition-colors font-sans"
              style={{ color: 'rgba(255,255,255,0.4)', border: '1px solid rgba(255,255,255,0.1)' }}
              onMouseEnter={e => e.currentTarget.style.color = 'white'}
              onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.4)'}>
              ✕
            </button>
          </div>
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
          {/* Usage bar — only for free plan cloud users */}
          {cloudInfo?.plan === 'free' && (
            <UsageBar cloudInfo={cloudInfo} onUpgradeClick={() => setShowUpgrade(true)} />
          )}

          <WsStatusPill status={wsStatus} />

          <button onClick={newSession}
            className="text-[12px] font-medium font-sans px-3 py-1.5 rounded-full transition-all"
            style={{ color: 'rgba(255,255,255,0.45)', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.03)' }}
            onMouseEnter={e => { e.currentTarget.style.color = 'white'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)' }}
            onMouseLeave={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.45)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)' }}>
            New session
          </button>

          {user && <UserMenu user={user} />}
        </div>
      </header>

      {/* Messages */}
      <main className="relative z-10 flex-1 overflow-y-auto px-4 py-6">
        <div className="max-w-2xl mx-auto space-y-5">
          {messages.length === 0 && (
            <EmptyState
              onSelect={selectExample}
              canSend={!streaming}
              firstName={firstName}
            />
          )}
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
          disabled={streaming}
        />
      </div>

      {/* Upgrade modal */}
      {showUpgrade && (
        <UpgradeModal
          onClose={() => setShowUpgrade(false)}
          onUpgrade={handleUpgrade}
          upgradeLoading={upgradeLoading}
        />
      )}
    </div>
  )
}
