import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import ToolStream from './ToolStream.jsx'

/**
 * MessageBubble — renders a single chat message.
 *
 * User messages: right-aligned, solid indigo.
 * Assistant messages: left-aligned, dark surface, markdown-rendered content.
 *
 * For the in-progress assistant turn (streaming=true), shows ToolStream
 * while waiting for the final text.
 */
export default function MessageBubble({ message }) {
  if (message.role === 'user') {
    return <UserBubble message={message} />
  }
  return <AssistantBubble message={message} />
}

function UserBubble({ message }) {
  return (
    <div className="flex justify-end animate-slide-up">
      <div className="max-w-[75%] rounded-2xl rounded-tr-sm bg-indigo-600 px-4 py-3">
        <p className="text-sm text-white whitespace-pre-wrap break-words leading-relaxed">
          {message.content}
        </p>
      </div>
    </div>
  )
}

function AssistantBubble({ message }) {
  const isStreaming = message.streaming
  const hasContent = !!message.content
  const hasToolEvents = message.toolEvents?.length > 0

  return (
    <div className="flex justify-start animate-slide-up">
      {/* Avatar */}
      <div className="shrink-0 w-7 h-7 rounded-full bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center text-xs mr-3 mt-0.5">
        ⚡
      </div>

      <div className="max-w-[80%] min-w-0">
        {/* Tool stream — shown while agent is working */}
        {(hasToolEvents || (isStreaming && !hasContent)) && (
          <div className="mb-3">
            {isStreaming && !hasToolEvents && <ThinkingDots />}
            <ToolStream events={message.toolEvents ?? []} />
          </div>
        )}

        {/* Final answer */}
        {hasContent && (
          <div className="rounded-2xl rounded-tl-sm bg-gray-800/70 border border-gray-700/50 px-4 py-3">
            <div className="prose-opsiq text-sm">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {message.content}
              </ReactMarkdown>
            </div>
            {message.toolsUsed?.length > 0 && (
              <SourcesFooter tools={message.toolsUsed} />
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function ThinkingDots() {
  return (
    <div className="flex items-center gap-1 pl-1">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse-dot"
          style={{ animationDelay: `${i * 0.16}s` }}
        />
      ))}
    </div>
  )
}

function SourcesFooter({ tools }) {
  return (
    <div className="mt-3 pt-3 border-t border-gray-700/50 flex flex-wrap gap-1.5">
      {tools.map((tool) => (
        <span
          key={tool}
          className="font-mono text-[10px] text-gray-500 bg-gray-900/60 border border-gray-700/40 rounded px-1.5 py-0.5"
        >
          {tool}
        </span>
      ))}
    </div>
  )
}
