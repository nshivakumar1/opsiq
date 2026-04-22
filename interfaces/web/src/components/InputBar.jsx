import { useRef, useEffect } from 'react'

/**
 * InputBar — auto-resizing textarea + send button.
 * Submit on Enter (Shift+Enter for newline).
 * Disabled while streaming.
 */
export default function InputBar({ value, onChange, onSubmit, disabled }) {
  const textareaRef = useRef(null)

  // Auto-resize textarea up to ~8 lines
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

  return (
    <div className="border-t border-gray-800 bg-gray-950/80 backdrop-blur-sm px-4 py-4">
      <div
        className={`
          flex items-end gap-3 rounded-xl border bg-gray-900 px-4 py-3 transition-colors
          ${disabled
            ? 'border-gray-700/50 opacity-60'
            : 'border-gray-700 focus-within:border-indigo-500/60'
          }
        `}
      >
        <textarea
          ref={textareaRef}
          rows={1}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          placeholder="Ask about your DevOps stack… (Enter to send, Shift+Enter for newline)"
          className="flex-1 resize-none bg-transparent text-sm text-gray-100 placeholder-gray-600 outline-none leading-relaxed disabled:cursor-not-allowed"
          style={{ minHeight: '24px', maxHeight: '200px' }}
        />
        <button
          onClick={onSubmit}
          disabled={disabled || !value.trim()}
          aria-label="Send"
          className={`
            shrink-0 w-8 h-8 rounded-lg flex items-center justify-center transition-all
            ${disabled || !value.trim()
              ? 'bg-gray-800 text-gray-600 cursor-not-allowed'
              : 'bg-indigo-600 text-white hover:bg-indigo-500 active:scale-95'
            }
          `}
        >
          {disabled ? <SpinnerIcon /> : <SendIcon />}
        </button>
      </div>
      <p className="mt-2 text-center text-[10px] text-gray-700">
        OpsIQ may make mistakes. Always verify critical changes.
      </p>
    </div>
  )
}

function SendIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5">
      <path d="M.5 1.163A1 1 0 0 1 1.97.28l12.868 6.837a1 1 0 0 1 0 1.766L1.969 15.72A1 1 0 0 1 .5 14.836V10.33a1 1 0 0 1 .816-.983L8.5 8 1.316 6.653A1 1 0 0 1 .5 5.67V1.163Z" />
    </svg>
  )
}

function SpinnerIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" className="w-3.5 h-3.5 animate-spin">
      <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeDasharray="28" strokeDashoffset="10" />
    </svg>
  )
}
