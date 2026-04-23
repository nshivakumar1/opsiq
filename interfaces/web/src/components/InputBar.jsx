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
      className="px-4 py-4"
      style={{
        borderTop: '1px solid rgba(255,255,255,0.06)',
        background: 'rgba(0,0,0,0.6)',
        backdropFilter: 'blur(20px)',
      }}
    >
      <div
        className="relative flex items-end gap-3 rounded-2xl px-4 py-3 transition-all duration-200"
        style={{
          background: focused ? 'rgba(124,58,237,0.06)' : 'rgba(255,255,255,0.04)',
          border: focused
            ? '1px solid rgba(124,58,237,0.5)'
            : '1px solid rgba(255,255,255,0.08)',
          boxShadow: focused
            ? '0 0 0 3px rgba(124,58,237,0.12), 0 4px 30px rgba(124,58,237,0.1)'
            : 'none',
        }}
      >
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
          className="flex-1 resize-none bg-transparent text-sm text-white placeholder-white/20 outline-none leading-relaxed disabled:cursor-not-allowed"
          style={{ minHeight: '24px', maxHeight: '200px' }}
        />

        <button
          onClick={onSubmit}
          disabled={!canSend}
          aria-label="Send"
          className="shrink-0 w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-150"
          style={canSend ? {
            background: '#7c3aed',
            boxShadow: '0 2px 16px rgba(124,58,237,0.5)',
          } : {
            background: 'rgba(255,255,255,0.05)',
          }}
          onMouseEnter={e => { if (canSend) e.currentTarget.style.boxShadow = '0 4px 24px rgba(124,58,237,0.7)' }}
          onMouseLeave={e => { if (canSend) e.currentTarget.style.boxShadow = '0 2px 16px rgba(124,58,237,0.5)' }}
        >
          {disabled ? <SpinnerIcon /> : <SendIcon active={canSend} />}
        </button>
      </div>

      <p className="mt-2 text-center text-[10px]" style={{ color: 'rgba(255,255,255,0.15)' }}>
        OpsIQ may make mistakes — always verify critical changes.
      </p>
    </div>
  )
}

function SendIcon({ active }) {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5"
      style={{ color: active ? 'white' : 'rgba(255,255,255,0.2)' }}>
      <path d="M.5 1.163A1 1 0 0 1 1.97.28l12.868 6.837a1 1 0 0 1 0 1.766L1.969 15.72A1 1 0 0 1 .5 14.836V10.33a1 1 0 0 1 .816-.983L8.5 8 1.316 6.653A1 1 0 0 1 .5 5.67V1.163Z" />
    </svg>
  )
}

function SpinnerIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" className="w-3.5 h-3.5 animate-spin"
      style={{ color: 'rgba(167,139,250,0.7)' }}>
      <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="2"
        strokeLinecap="round" strokeDasharray="28" strokeDashoffset="10" />
    </svg>
  )
}
