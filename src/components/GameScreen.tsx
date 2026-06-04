'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { ChatMessage, saveChatHistory, loadChatHistory, saveGameState, updateChapter } from '@/lib/gameState';
import { PlayerState, buildSystemPrompt } from '@/lib/prompts';
import LetterModal from './LetterModal';

interface Props {
  gameState: PlayerState;
  onStateChange: (state: PlayerState) => void;
  onExit: () => void;
}

export default function GameScreen({ gameState, onStateChange, onExit }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [showLetter, setShowLetter] = useState(false);
  const [letterContent, setLetterContent] = useState('');
  const [letterLoading, setLetterLoading] = useState(false);
  const [showMailbox, setShowMailbox] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const initRef = useRef(false);

  const scrollToBottom = useCallback(() => {
    setTimeout(() => {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
    }, 50);
  }, []);

  // Load history on mount
  useEffect(() => {
    const history = loadChatHistory();
    if (history.length > 0) {
      setMessages(history);
    }
  }, []);

  // Auto-start narration
  useEffect(() => {
    if (initRef.current) return;
    const history = loadChatHistory();
    if (history.length === 0) {
      initRef.current = true;
      sendMessage('（我来到了长安城门前）', true);
    } else {
      initRef.current = true;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Check if mailbox should glow
  useEffect(() => {
    if (gameState.hasMailbox && gameState.unreadLetters > 0) {
      setShowMailbox(true);
    }
  }, [gameState]);

  async function sendMessage(text: string, isSystem = false) {
    const userMsg: ChatMessage = {
      role: 'user',
      content: text,
      timestamp: Date.now(),
    };

    const newMessages = isSystem ? [...messages] : [...messages, userMsg];
    if (!isSystem) {
      setMessages(newMessages);
      setInput('');
    }

    setIsStreaming(true);

    const assistantMsg: ChatMessage = {
      role: 'assistant',
      content: '',
      timestamp: Date.now(),
    };

    const systemPrompt = buildSystemPrompt(gameState.role, gameState);

    const apiMessages = newMessages
      .filter(m => m.role !== 'system')
      .slice(-20)
      .map(m => ({ role: m.role, content: m.content }));

    if (isSystem) {
      apiMessages.push({ role: 'user', content: text });
    }

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: apiMessages, systemPrompt }),
      });

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) throw new Error('No reader');

      let fullContent = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const text = decoder.decode(value, { stream: true });
        const lines = text.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') continue;
            try {
              const parsed = JSON.parse(data);
              if (parsed.content) {
                fullContent += parsed.content;
                assistantMsg.content = fullContent;
                if (isSystem) {
                  setMessages([...newMessages, { ...assistantMsg }]);
                } else {
                  setMessages([...newMessages, { ...assistantMsg }]);
                }
              }
            } catch {
              // skip
            }
          }
        }
      }

      // Update game state based on response
      const updated = updateChapter(gameState, fullContent);

      // Check if mailbox was just found
      if (!gameState.hasMailbox && updated.hasMailbox) {
        updated.unreadLetters = 1;
        setShowMailbox(true);
      }

      onStateChange(updated);
      saveGameState(updated);

      const finalMessages = isSystem
        ? [...newMessages, { ...assistantMsg, content: fullContent }]
        : [...newMessages, { ...assistantMsg, content: fullContent }];
      saveChatHistory(finalMessages);
      setMessages(finalMessages);
    } catch (err) {
      assistantMsg.content = '（长安城的喧嚣声突然安静了一瞬...请再试一次）';
      const errorMessages = [...newMessages, assistantMsg];
      setMessages(errorMessages);
      console.error(err);
    }

    setIsStreaming(false);
  }

  async function openLetter() {
    setShowLetter(true);
    setLetterLoading(true);
    setShowMailbox(false);

    try {
      const res = await fetch('/api/letter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          playerReply: null,
          letterHistory: gameState.letterHistory,
        }),
      });
      const data = await res.json();
      setLetterContent(data.content || '（信纸上的字迹模糊不清...）');

      const updated = {
        ...gameState,
        unreadLetters: 0,
        chapter: gameState.chapter === 'mailbox_found' ? 'first_letter_read' : gameState.chapter,
        letterHistory: [
          ...gameState.letterHistory,
          { from: 'linShen', content: data.content, timestamp: Date.now() },
        ],
      };
      onStateChange(updated);
      saveGameState(updated);
    } catch {
      setLetterContent('（信件似乎被什么力量阻隔了...请再试一次）');
    }
    setLetterLoading(false);
  }

  async function handleReply(reply: string) {
    // Save player's reply to letter history
    const updated = {
      ...gameState,
      chapter: 'letter_replied',
      letterHistory: [
        ...gameState.letterHistory,
        { from: 'player', content: reply, timestamp: Date.now() },
      ],
    };
    onStateChange(updated);
    saveGameState(updated);

    // Add a system message about the reply
    const replyMsg: ChatMessage = {
      role: 'system',
      content: `📮 你将回信投入了邮箱。信纸在金光中消失了。`,
      timestamp: Date.now(),
    };
    const newMessages = [...messages, replyMsg];
    setMessages(newMessages);
    saveChatHistory(newMessages);

    setShowLetter(false);

    // Schedule next letter (after a few interactions)
    setTimeout(() => {
      const withLetter = { ...updated, unreadLetters: 1 };
      onStateChange(withLetter);
      saveGameState(withLetter);
      setShowMailbox(true);
    }, 60000); // 1 minute for MVP, would be longer in production
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || isStreaming) return;
    sendMessage(input.trim());
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  }

  // Quick action buttons based on game state
  function getQuickActions(): string[] {
    if (gameState.chapter === 'arrival') {
      if (gameState.location === '长安城门外') {
        return ['走进城门', '向守门兵打听', '四处张望'];
      }
      return ['找一间客栈', '去西市看看', '随便走走'];
    }
    if (gameState.chapter === 'mailbox_found') {
      return ['打开邮箱看看', '先不管它', '仔细端详这个陶器'];
    }
    if (gameState.hasMailbox && gameState.unreadLetters > 0) {
      return ['查看邮箱', '继续探索', '找人聊聊'];
    }
    return ['四处走走', '找人聊聊', '回客栈休息'];
  }

  return (
    <div className="h-full flex flex-col relative">
      {/* Header */}
      <div className="flex-none px-4 py-3 bg-gradient-to-b from-stone-900 to-stone-900/95 border-b border-amber-900/20 flex items-center justify-between">
        <button onClick={onExit} className="text-amber-600/50 text-xs hover:text-amber-400">
          ← 离开
        </button>
        <div className="text-center">
          <div className="text-amber-300/80 text-sm font-medium">{gameState.location}</div>
          <div className="text-amber-600/40 text-xs">天宝元年</div>
        </div>
        <div className="text-amber-600/40 text-xs">
          {gameState.actionsToday}/10
        </div>
      </div>

      {/* Chat area */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto chat-scroll px-4 py-4 space-y-4">
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`animate-fade-in-up ${
              msg.role === 'user'
                ? 'flex justify-end'
                : msg.role === 'system'
                ? 'flex justify-center'
                : 'flex justify-start'
            }`}
          >
            {msg.role === 'system' ? (
              <div className="text-amber-500/50 text-xs text-center px-4 py-2 bg-amber-900/10 rounded-full">
                {msg.content}
              </div>
            ) : msg.role === 'user' ? (
              <div className="max-w-[80%] bg-amber-800/25 border border-amber-700/20 rounded-2xl rounded-br-md px-4 py-2.5 text-amber-100/90 text-sm">
                {msg.content}
              </div>
            ) : (
              <div className="max-w-[85%] bg-stone-800/60 border border-stone-700/30 rounded-2xl rounded-bl-md px-4 py-3 text-amber-100/80 text-sm leading-relaxed whitespace-pre-wrap">
                {msg.content}
              </div>
            )}
          </div>
        ))}

        {isStreaming && messages[messages.length - 1]?.role !== 'assistant' && (
          <div className="flex justify-start">
            <div className="bg-stone-800/60 border border-stone-700/30 rounded-2xl px-4 py-3 flex gap-1">
              <span className="typing-dot w-1.5 h-1.5 rounded-full bg-amber-400/60" />
              <span className="typing-dot w-1.5 h-1.5 rounded-full bg-amber-400/60" />
              <span className="typing-dot w-1.5 h-1.5 rounded-full bg-amber-400/60" />
            </div>
          </div>
        )}
      </div>

      {/* Mailbox notification */}
      {showMailbox && (
        <div className="px-4 pb-2">
          <button
            onClick={openLetter}
            className="w-full py-3 rounded-xl bg-amber-700/20 border border-amber-500/30 text-amber-300 text-sm animate-pulse-glow flex items-center justify-center gap-2"
          >
            <span className="text-lg">📮</span>
            邮箱在发光...有新的信件
          </button>
        </div>
      )}

      {/* Quick actions */}
      {!isStreaming && (
        <div className="px-4 pb-2 flex gap-2 overflow-x-auto">
          {getQuickActions().map((action) => (
            <button
              key={action}
              onClick={() => sendMessage(action)}
              className="flex-none px-3 py-1.5 rounded-full bg-amber-900/20 border border-amber-800/25 text-amber-400/70 text-xs hover:bg-amber-800/30 hover:text-amber-300 transition-colors whitespace-nowrap"
            >
              {action}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <form onSubmit={handleSubmit} className="flex-none px-4 pb-4 pt-2">
        <div className="flex gap-2 items-end">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="说点什么..."
            rows={1}
            disabled={isStreaming}
            className="flex-1 bg-stone-800/50 border border-amber-900/20 rounded-xl px-4 py-2.5 text-sm text-amber-100/90 placeholder:text-amber-700/30 resize-none focus:outline-none focus:border-amber-700/40 disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={!input.trim() || isStreaming}
            className="flex-none w-10 h-10 rounded-xl bg-amber-700/30 border border-amber-600/30 flex items-center justify-center text-amber-300 hover:bg-amber-700/50 transition-colors disabled:opacity-30"
          >
            ↑
          </button>
        </div>
      </form>

      {/* Letter modal */}
      {showLetter && (
        <LetterModal
          content={letterContent}
          isLoading={letterLoading}
          onClose={() => setShowLetter(false)}
          onReply={handleReply}
          canReply={true}
        />
      )}
    </div>
  );
}
