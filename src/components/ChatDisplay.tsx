import type { RefObject } from 'react';
import type { ChatMessage } from '@/lib/gameState';

interface ChatDisplayProps {
  messages: ChatMessage[];
  isStreaming: boolean;
  scrollRef: RefObject<HTMLDivElement | null>;
}

export default function ChatDisplay({ messages, isStreaming, scrollRef }: ChatDisplayProps) {
  return (
    <div ref={scrollRef} className="flex-1 overflow-y-auto chat-scroll px-6 pb-4 z-10 relative text-fade-mask">
      <div className="h-[28vh]" />

      <div className="max-w-lg mx-auto space-y-6">
        {messages.filter((msg) => !msg.hidden).map((msg, i) => (
          <div
            key={i}
            className={`animate-fade-in-up ${
              msg.role === 'user' ? 'text-right' : msg.role === 'system' ? 'text-center' : 'text-left'
            }`}
          >
            {msg.role === 'system' ? (
              <span className="text-amber-500/30 text-sm">{msg.content}</span>
            ) : msg.role === 'user' ? (
              <span className="text-amber-500/50 text-lg leading-8">{msg.content}</span>
            ) : (
              <p className="text-amber-100/70 text-lg leading-8 whitespace-pre-wrap">{msg.content}</p>
            )}
          </div>
        ))}

        {isStreaming && messages[messages.length - 1]?.role !== 'assistant' && (
          <div className="flex gap-1">
            <span className="typing-dot w-1.5 h-1.5 rounded-full bg-amber-400/40" />
            <span className="typing-dot w-1.5 h-1.5 rounded-full bg-amber-400/40" />
            <span className="typing-dot w-1.5 h-1.5 rounded-full bg-amber-400/40" />
          </div>
        )}
      </div>
    </div>
  );
}
