import { useRef, useEffect, useState } from 'react'

export default function InputBar({ value, onChange, onSubmit, disabled }) {
  const textareaRef = useRef(null)
  const [focused, setFocused] = useState(false)

  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`
  }, [value])

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (!disabled && value.trim()) onSubmit()
    }
  }

  const canSend = !disabled && !!value.trim()

  return (
    <div
      className="px-4 py-4 transition-all"
      style={{
        background: 'rgba(4,4,13,0.8)',
        backdropFilter: 'blur(20px)',
        borderTop: '1px solid rgba(255,255,255,0.05)',
      }}
    >
      {/* Input container */}
      <div
        className="relative flex items-end gap-3 rounded-2xl px-4 py-3 transition-all duration-200"
        style={{
          background: focused
            ? 'rgba(99,102,241,0.05)'
            : 'rgba(255,255,255,0.03)',
          border: focused
            ? '1px solid rgba(99,102,241,0.4)'
            : '1px solid rgba(255,255,255,0.07)',
          boxShadow: focused
            ? '0 0 0 3px rgba(99,102,241,0.1), 0 4px 24px rgba(99,102,241,0.08)'
            : '0 2px 8px rgba(0,0,0,0.2)',
        }}
      >
        {/* Top shimmer when focused */}
        {focused && (
          <div
            className="absolute top-0 left-4 right-4 h-px"
            style={{ background: 'linear-gradient(90deg, transparent, rgba(99,102,241,0.5), rgba(139,92,246,0.5), transparent)' }}
          />
        )}

        <textarea
          ref={textareaRef}
          rows={1}
          value={value}
          onChange={e => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          disabled={disabled}
          placeholder="Ask about your DevOps stack…"
          className="flex-1 resize-none bg-transparent text-sm text-slate-200 placeholder-slate-600 outline-none leading-relaxed disabled:cursor-not-allowed"
          style={{ minHeight: '24px', maxHeight: '200px' }}
        />

        {/* Send / spinner button */}
        <button
          onClick={onSubmit}
          disabled={!canSend}
          aria-label="Send"
          className="shrink-0 w-8 h-8 rounded-xl flex items-center justify-center transition-all duration-150 disabled:cursor-not-allowed"
          style={canSend ? {
            background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
            boxShadow: '0 2px 12px rgba(99,102,241,0.4)',
            transform: 'scale(1)',
          } : {
            background: 'rgba(255,255,255,0.05)',
            color: 'rgba(255,255,255,0.2)',
          }}
          onMouseEnter={e => canSend && (e.currentTarget.style.boxShadow = '0 4px 20px rgba(99,102,241,0.6)')}
          onMouseLeave={e => canSend && (e.currentTarget.style.boxShadow = '0 2px 12px rgba(99,102,241,0.4)')}
        >
          {disabled ? <SpinnerIcon /> : <SendIcon active={canSend} />}
        </button>
      </div>

      {/* Footer hint */}
      <div className="mt-2 flex items-center justify-between px-1">
        <span className="text-[10px] text-slate-700">Enter to send · Shift+Enter for newline</span>
        <span className="text-[10px] text-slate-700">OpsIQ · Verify critical changes</span>
      </div>
    </div>
  )
}

function SendIcon({ active }) {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5" style={{ color: active ? 'white' : 'rgba(255,255,255,0.25)' }}>
      <path d="M.5 1.163A1 1 0 0 1 1.97.28l12.868 6.837a1 1 0 0 1 0 1.766L1.969 15.72A1 1 0 0 1 .5 14.836V10.33a1 1 0 0 1 .816-.983L8.5 8 1.316 6.653A1 1 0 0 1 .5 5.67V1.163Z" />
    </svg>
  )
}

function SpinnerIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" className="w-3.5 h-3.5 animate-spin" style={{ color: 'rgba(139,92,246,0.7)' }}>
      <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeDasharray="28" strokeDashoffset="10" />
    </svg>
  )
}
