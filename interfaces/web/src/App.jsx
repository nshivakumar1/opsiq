import { useState, useEffect, useRef, useCallback } from 'react'
import MessageBubble from './components/MessageBubble.jsx'
import InputBar from './components/InputBar.jsx'

// ── Session ID (persisted across page refreshes) ──────────────────────────────

function getOrCreateSessionId() {
  const key = 'opsiq-session-id'
  let id = localStorage.getItem(key)
  if (!id) {
    id = crypto.randomUUID()
    localStorage.setItem(key, id)
  }
  return id
}

// ── WebSocket URL (works in dev via Vite proxy, and in prod via same-origin) ──

function wsUrl(sessionId) {
  const proto = window.location.protocol === 'https:' ? 'wss' : 'ws'
  return `${proto}://${window.location.host}/ws/${sessionId}`
}

// ── WS connection states ──────────────────────────────────────────────────────

const WS_CONNECTING = 'connecting'
const WS_OPEN = 'open'
const WS_CLOSED = 'closed'

// ── App ───────────────────────────────────────────────────────────────────────

export default function App() {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [wsStatus, setWsStatus] = useState(WS_CLOSED)

  const sessionId = useRef(getOrCreateSessionId())
  const ws = useRef(null)
  const bottomRef = useRef(null)
  const reconnectTimer = useRef(null)

  // ── WebSocket lifecycle ───────────────────────────────────────────────────

  const connect = useCallback(() => {
    if (ws.current?.readyState === WebSocket.OPEN) return

    setWsStatus(WS_CONNECTING)
    const socket = new WebSocket(wsUrl(sessionId.current))

    socket.onopen = () => {
      setWsStatus(WS_OPEN)
    }

    socket.onclose = () => {
      setWsStatus(WS_CLOSED)
      // Reconnect after 3 s (unless unmounting)
      reconnectTimer.current = setTimeout(connect, 3000)
    }

    socket.onerror = () => {
      socket.close()
    }

    socket.onmessage = (e) => {
      const event = JSON.parse(e.data)
      handleWsEvent(event)
    }

    ws.current = socket
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    connect()
    return () => {
      clearTimeout(reconnectTimer.current)
      ws.current?.close()
    }
  }, [connect])

  // ── Auto-scroll ───────────────────────────────────────────────────────────

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // ── WS event handler ──────────────────────────────────────────────────────

  function handleWsEvent(event) {
    switch (event.type) {
      case 'tool_call':
      case 'tool_result':
        // Append to the in-progress assistant message's toolEvents
        setMessages((prev) => {
          const last = prev[prev.length - 1]
          if (last?.role === 'assistant' && last.streaming) {
            return [
              ...prev.slice(0, -1),
              { ...last, toolEvents: [...(last.toolEvents ?? []), event] },
            ]
          }
          return prev
        })
        break

      case 'text_chunk':
        // Set the final text on the in-progress assistant message
        setMessages((prev) => {
          const last = prev[prev.length - 1]
          if (last?.role === 'assistant' && last.streaming) {
            return [
              ...prev.slice(0, -1),
              { ...last, content: event.text },
            ]
          }
          return prev
        })
        break

      case 'done':
        // Finalise the assistant message
        setMessages((prev) => {
          const last = prev[prev.length - 1]
          if (last?.role === 'assistant' && last.streaming) {
            return [
              ...prev.slice(0, -1),
              { ...last, streaming: false, toolsUsed: event.tools_used ?? [] },
            ]
          }
          return prev
        })
        setStreaming(false)
        break

      case 'error':
        setMessages((prev) => {
          const last = prev[prev.length - 1]
          if (last?.role === 'assistant' && last.streaming) {
            return [
              ...prev.slice(0, -1),
              {
                ...last,
                streaming: false,
                content: `**Error:** ${event.message}`,
                toolsUsed: [],
              },
            ]
          }
          return prev
        })
        setStreaming(false)
        break

      default:
        break
    }
  }

  // ── Send query ────────────────────────────────────────────────────────────

  function sendQuery() {
    const query = input.trim()
    if (!query || streaming || ws.current?.readyState !== WebSocket.OPEN) return

    // Add user message
    setMessages((prev) => [
      ...prev,
      { id: crypto.randomUUID(), role: 'user', content: query },
      // Immediately add the in-progress assistant placeholder
      { id: crypto.randomUUID(), role: 'assistant', content: '', streaming: true, toolEvents: [], toolsUsed: [] },
    ])

    setInput('')
    setStreaming(true)

    ws.current.send(JSON.stringify({ query }))
  }

  // ── Sidebar actions ───────────────────────────────────────────────────────

  function newSession() {
    const id = crypto.randomUUID()
    localStorage.setItem('opsiq-session-id', id)
    sessionId.current = id
    setMessages([])
    setStreaming(false)
    // Reconnect with new session
    ws.current?.close()
  }

  // ── Example chip selection ────────────────────────────────────────────────

  function selectExample(text) {
    if (streaming || ws.current?.readyState !== WebSocket.OPEN) return
    // Directly send rather than populating input — faster UX
    setMessages((prev) => [
      ...prev,
      { id: crypto.randomUUID(), role: 'user', content: text },
      { id: crypto.randomUUID(), role: 'assistant', content: '', streaming: true, toolEvents: [], toolsUsed: [] },
    ])
    setStreaming(true)
    ws.current.send(JSON.stringify({ query: text }))
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <header className="shrink-0 flex items-center justify-between px-5 py-3 border-b border-gray-800 bg-gray-950">
        <div className="flex items-center gap-2.5">
          <span className="text-lg">⚡</span>
          <span className="font-semibold text-gray-100 tracking-tight">OpsIQ</span>
          <span className="text-[10px] text-gray-600 font-mono bg-gray-900 border border-gray-800 rounded px-1.5 py-0.5">
            {sessionId.current.slice(0, 8)}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <WsStatusDot status={wsStatus} />
          <button
            onClick={newSession}
            className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
            title="Start a new session (clears history)"
          >
            New session
          </button>
        </div>
      </header>

      {/* Message list */}
      <main className="flex-1 overflow-y-auto px-4 py-6">
        <div className="max-w-3xl mx-auto space-y-6">
          {messages.length === 0 && <EmptyState onSelect={selectExample} />}
          {messages.map((msg) => (
            <MessageBubble key={msg.id} message={msg} />
          ))}
          <div ref={bottomRef} />
        </div>
      </main>

      {/* Input */}
      <div className="shrink-0 max-w-3xl mx-auto w-full">
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

// ── Sub-components ────────────────────────────────────────────────────────────

function WsStatusDot({ status }) {
  const styles = {
    [WS_OPEN]: 'bg-emerald-500',
    [WS_CONNECTING]: 'bg-yellow-500 animate-pulse',
    [WS_CLOSED]: 'bg-red-500',
  }
  const labels = {
    [WS_OPEN]: 'Connected',
    [WS_CONNECTING]: 'Connecting…',
    [WS_CLOSED]: 'Disconnected',
  }
  return (
    <div className="flex items-center gap-1.5" title={labels[status]}>
      <span className={`w-1.5 h-1.5 rounded-full ${styles[status]}`} />
      <span className="text-[10px] text-gray-600">{labels[status]}</span>
    </div>
  )
}

function EmptyState({ onSelect }) {
  const examples = [
    'What deployed to production in the last hour?',
    'Are there any active P1 alerts right now?',
    'Summarize blocked tickets in the INFRA sprint',
    'Which service has the highest error rate today?',
    'Find the runbook for database failover',
  ]
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center animate-fade-in">
      <div className="text-5xl mb-4">⚡</div>
      <h1 className="text-xl font-semibold text-gray-200 mb-1">OpsIQ</h1>
      <p className="text-sm text-gray-500 mb-8 max-w-sm">
        AI-powered DevOps intelligence. Ask anything about your stack.
      </p>
      <div className="grid gap-2 w-full max-w-lg">
        {examples.map((ex) => (
          <button
            key={ex}
            onClick={() => onSelect(ex)}
            className="text-left text-xs text-gray-400 bg-gray-900 hover:bg-gray-800 border border-gray-800 hover:border-gray-700 rounded-lg px-3 py-2.5 transition-colors"
          >
            {ex}
          </button>
        ))}
      </div>
    </div>
  )
}
