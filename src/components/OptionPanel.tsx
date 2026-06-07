import type { FormEvent, KeyboardEvent } from 'react';
import type { ChatMessage } from '@/lib/gameState';
import type { PlayerState } from '@/lib/prompts';
import { isMailboxOption } from '@/lib/game/mailboxLogic';
import { normalizeOptionLabel } from '@/lib/game/optionLogic';

interface OptionPanelProps {
  gameState: PlayerState;
  messages: ChatMessage[];
  isStreaming: boolean;
  showMailbox: boolean;
  input: string;
  onInputChange: (value: string) => void;
  onSubmit: (event: FormEvent) => void;
  onKeyDown: (event: KeyboardEvent<HTMLTextAreaElement>) => void;
  onOptionClick: (option: string) => void;
}

export default function OptionPanel({
  gameState,
  messages,
  isStreaming,
  showMailbox,
  input,
  onInputChange,
  onSubmit,
  onKeyDown,
  onOptionClick,
}: OptionPanelProps) {
  const lastMsg = messages[messages.length - 1];
  const currentOptions = (!isStreaming && lastMsg?.role === 'assistant' && lastMsg.options)
    ? lastMsg.options.map(normalizeOptionLabel)
    : [];

  return (
    <>
      {!showMailbox && currentOptions.length > 0 && (
        <div className="px-5 pb-2 flex flex-col gap-2 flex-none z-10">
          {currentOptions.map((option, i) => (
            <button
              key={i}
              onClick={() => onOptionClick(option)}
              aria-label={`选择：${option}`}
              className={`w-full text-left px-4 py-2 rounded-lg border text-sm transition-colors ${
                isMailboxOption(option, gameState)
                  ? 'bg-amber-700/20 border-amber-400/35 text-amber-200/90 animate-pulse-glow'
                  : 'bg-amber-900/15 border-amber-800/20 text-amber-400/70 hover:bg-amber-800/25 hover:text-amber-300/80'
              } focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-400/70`}
            >
              {option}
            </button>
          ))}
        </div>
      )}

      <form onSubmit={onSubmit} className="flex-none px-4 pb-4 pt-2 z-10">
        {gameState.awaitingFreeInput && !isStreaming && (
          <div className="max-w-lg mx-auto pb-2 text-center text-xs text-amber-400/45">
            这一刻，长安在等你亲口回答。
          </div>
        )}
        <div className="flex gap-2 items-end max-w-lg mx-auto">
          <textarea
            value={input}
            onChange={(e) => onInputChange(e.target.value)}
            onKeyDown={onKeyDown}
            aria-label="输入你的回应"
            placeholder={gameState.awaitingFreeInput ? '写下你的回应...' : '说点什么...'}
            rows={1}
            disabled={isStreaming}
            className="flex-1 bg-stone-800/60 border border-amber-700/30 rounded-xl px-4 py-2.5 text-sm text-amber-100/90 placeholder:text-amber-600/40 resize-none focus:outline-none focus:border-amber-600/50 focus-visible:ring-2 focus-visible:ring-amber-400/40 disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={!input.trim() || isStreaming}
            aria-label="发送回应"
            className="flex-none w-10 h-10 rounded-xl bg-amber-700/40 border border-amber-600/30 flex items-center justify-center text-amber-200 hover:bg-amber-700/50 transition-colors disabled:opacity-30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-400/70"
          >
            →
          </button>
        </div>
      </form>
    </>
  );
}
