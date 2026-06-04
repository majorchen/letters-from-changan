'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { ChatMessage, saveChatHistory, loadChatHistory, saveGameState, updateChapter } from '@/lib/gameState';
import { PlayerState, buildSystemPrompt, ROLES } from '@/lib/prompts';
import LetterModal from './LetterModal';

interface Props {
  gameState: PlayerState;
  onStateChange: (state: PlayerState) => void;
  onExit: () => void;
}

const OPENING_NARRATIONS: Record<string, string> = {
  merchant: '你牵着一匹瘦马，站在朱雀门外。身上的包裹里装着从江南带来的丝绸样品，那是你全部的本钱。长安城的城墙高耸入云，城门洞开处，人流如潮水般涌动。一个胡商的驼铃声从远处传来，混着烤饼的焦香和马粪的气味。守门的兵卒扫了你一眼，见你商人打扮，便挥了挥手——"进去吧。"\n\n你深吸一口气，踏入了这座百万人的城市。',
  musician: '你背着一把旧琵琶，站在朱雀门外。琴弦是上个月在洛阳新换的，音色还算清亮。长安城的城墙遮住了半边天，城门口一个卖糖人的老头正在吆喝，声音被风吹得断断续续。你的手指无意识地在琴颈上滑动——这是你紧张时的习惯。守门的兵卒看了看你的琵琶，咧嘴一笑——"又一个来长安讨生活的乐师，进去吧。"\n\n你点点头，抱紧琵琶，走进了城门。',
  wanderer: '你按了按腰间的短刀，站在朱雀门外。刀是好刀，但刀鞘上的漆已经磨得斑驳。长安城的城墙像一头蹲伏的巨兽，城门口排着长队——商人、僧侣、操着各种口音的旅人。守门的兵卒目光锐利，在你身上停留了一瞬，盯着你腰间的刀。你不动声色地把衣襟拉低了些。"做什么的？""路过。""长安不缺游侠，别惹事。"\n\n你没回话，侧身挤进了人群。',
  scholar: '你抖了抖衣袖上的尘土，站在朱雀门外。怀里揣着一卷自己写的策论，纸张边角已经被汗水浸软。长安城——你在书里读过无数遍的名字，此刻就矗立在眼前。城门比你想象的还要高，门洞里回荡着嘈杂的人声。一个守门的年轻兵卒看了看你的书生打扮，态度还算客气——"来长安赶考的？""不，来长安……看看。"\n\n他有些意外，但还是让开了路。你理了理衣冠，走了进去。',
};

// Key story moments that deserve an image
const SCENE_TRIGGERS = ['第一次进入', '客栈', '邮箱发光', '西市', '东市', '收到信'];
let messageCounter = 0;

export default function GameScreen({ gameState, onStateChange, onExit }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [showLetter, setShowLetter] = useState(false);
  const [letterContent, setLetterContent] = useState('');
  const [letterLoading, setLetterLoading] = useState(false);
  const [showMailbox, setShowMailbox] = useState(false);
  const [sceneImage, setSceneImage] = useState<string | null>(null);
  const [imageLoading, setImageLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const initRef = useRef(false);

  const scrollToBottom = useCallback(() => {
    setTimeout(() => {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
    }, 50);
  }, []);

  useEffect(() => {
    const history = loadChatHistory();
    if (history.length > 0) {
      setMessages(history);
      messageCounter = history.filter(m => m.role === 'user').length;
    }
  }, []);

  // Fix #1: Fixed opening narration instead of API call
  useEffect(() => {
    if (initRef.current) return;
    const history = loadChatHistory();
    if (history.length === 0) {
      initRef.current = true;
      const opening = OPENING_NARRATIONS[gameState.role] || OPENING_NARRATIONS.scholar;
      const openingMsg: ChatMessage = {
        role: 'assistant',
        content: opening + '\n\n眼前是宽阔的朱雀大街，人群熙攘。你需要先找个落脚的地方。\n\n【选项A】沿着大街往北走，找一家客栈安顿\n【选项B】先去西市转转，打听行情\n【选项C】在城门附近随便看看',
        timestamp: Date.now(),
      };
      setMessages([openingMsg]);
      saveChatHistory([openingMsg]);
      // Generate opening scene image
      generateSceneImage('The grand Zhuque Gate of Tang Dynasty Chang\'an, bustling crowd entering the massive city gate, merchants with camels, guards in armor, warm golden sunlight');
    } else {
      initRef.current = true;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { scrollToBottom(); }, [messages, scrollToBottom]);

  useEffect(() => {
    if (gameState.hasMailbox && gameState.unreadLetters > 0) {
      setShowMailbox(true);
    }
  }, [gameState]);

  async function sendMessage(text: string) {
    if (gameState.actionsToday >= 10) {
      const limitMsg: ChatMessage = {
        role: 'system',
        content: '🌙 今日的长安之旅已尽兴。明天再来继续探索吧。',
        timestamp: Date.now(),
      };
      setMessages(prev => [...prev, limitMsg]);
      saveChatHistory([...messages, limitMsg]);
      return;
    }

    messageCounter++;

    const userMsg: ChatMessage = { role: 'user', content: text, timestamp: Date.now() };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput('');
    setIsStreaming(true);

    const assistantMsg: ChatMessage = { role: 'assistant', content: '', timestamp: Date.now() };
    const systemPrompt = buildSystemPrompt(gameState.role, gameState);
    const apiMessages = newMessages
      .filter(m => m.role !== 'system')
      .slice(-20)
      .map(m => ({ role: m.role, content: m.content }));

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
        const chunk = decoder.decode(value, { stream: true });
        for (const line of chunk.split('\n')) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') continue;
            try {
              const parsed = JSON.parse(data);
              if (parsed.content) {
                fullContent += parsed.content;
                assistantMsg.content = fullContent;
                setMessages([...newMessages, { ...assistantMsg }]);
              }
            } catch { /* skip */ }
          }
        }
      }

      const updated = updateChapter(gameState, fullContent);

      // Fix #4: Only generate image on key story moments (every 5th message or scene change)
      if (messageCounter === 1 || messageCounter % 5 === 0 || updated.chapter !== gameState.chapter) {
        const sceneDesc = fullContent.slice(0, 150).replace(/【.*?】/g, '');
        generateSceneImage(`Tang Dynasty Chang'an, ${sceneDesc}`);
      }

      // Fix #5: Mailbox triggers based on message count, not random
      if (!gameState.hasMailbox && updated.hasMailbox) {
        updated.unreadLetters = 1;
        setShowMailbox(true);
      }
      // Letter arrives every 5 messages after first letter
      if (updated.chapter === 'letter_replied' && messageCounter % 5 === 0) {
        updated.unreadLetters = 1;
        setShowMailbox(true);
      }

      onStateChange(updated);
      saveGameState(updated);

      const finalMessages = [...newMessages, { ...assistantMsg, content: fullContent }];
      saveChatHistory(finalMessages);
      setMessages(finalMessages);
    } catch (err) {
      assistantMsg.content = '（长安城的喧嚣声突然安静了一瞬...请再试一次）';
      setMessages([...newMessages, assistantMsg]);
      console.error(err);
    }

    setIsStreaming(false);
  }

  async function openLetter() {
    setShowLetter(true);
    setLetterLoading(true);
    setShowMailbox(false);

    try {
      // Fix #6: Always pass full letter history to avoid duplicate content
      const currentHistory = gameState.letterHistory || [];
      const res = await fetch('/api/letter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          playerReply: null,
          letterHistory: currentHistory,
        }),
      });
      const data = await res.json();
      const content = data.content || '（信纸上的字迹模糊不清...）';
      setLetterContent(content);

      const updated = {
        ...gameState,
        unreadLetters: 0,
        chapter: gameState.chapter === 'mailbox_found' ? 'first_letter_read' : gameState.chapter,
        letterHistory: [...currentHistory, { from: 'linShen', content, timestamp: Date.now() }],
      };
      onStateChange(updated);
      saveGameState(updated);
    } catch {
      setLetterContent('（信件似乎被什么力量阻隔了...请再试一次）');
    }
    setLetterLoading(false);
  }

  async function handleReply(reply: string) {
    const updated = {
      ...gameState,
      chapter: 'letter_replied',
      letterHistory: [...gameState.letterHistory, { from: 'player', content: reply, timestamp: Date.now() }],
    };
    onStateChange(updated);
    saveGameState(updated);

    const replyMsg: ChatMessage = {
      role: 'system',
      content: '📮 你将回信投入了邮箱。信纸在金光中消失了。',
      timestamp: Date.now(),
    };
    const newMessages = [...messages, replyMsg];
    setMessages(newMessages);
    saveChatHistory(newMessages);
    setShowLetter(false);
  }

  async function generateSceneImage(scene: string) {
    setImageLoading(true);
    try {
      const res = await fetch('/api/image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scene }),
      });
      const data = await res.json();
      if (data.url) setSceneImage(data.url);
    } catch { /* silently fail */ }
    setImageLoading(false);
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

  function getQuickActions(): string[] {
    if (gameState.chapter === 'arrival') {
      if (gameState.location === '长安城门外') return ['找一家客栈', '去西市转转', '四处看看'];
      return ['找一间客栈', '去西市看看', '随便走走'];
    }
    if (gameState.chapter === 'mailbox_found') return ['打开邮箱看看', '先不管它', '仔细端详这个陶器'];
    if (gameState.hasMailbox && gameState.unreadLetters > 0) return ['查看邮箱', '继续探索', '找人聊聊'];
    return ['四处走走', '找人聊聊', '回客栈休息'];
  }

  const roleInfo = ROLES[gameState.role];

  return (
    <div className="h-full flex flex-col relative">
      {/* Header with location */}
      <div className="flex-none px-4 py-3 bg-gradient-to-b from-stone-900 to-stone-900/95 border-b border-amber-900/20 flex items-center justify-between z-10">
        <button onClick={onExit} className="text-amber-600/50 text-xs hover:text-amber-400">
          ← 离开
        </button>
        <div className="text-center">
          <div className="text-amber-300/80 text-sm font-medium">{gameState.location}</div>
          <div className="text-amber-600/40 text-xs">天宝元年 · {roleInfo?.name || '旅人'}</div>
        </div>
        <div className="text-amber-600/40 text-xs">{gameState.actionsToday}/10</div>
      </div>

      {/* Fix #2: Chat area with scene image as background */}
      <div className="flex-1 relative overflow-hidden">
        {/* Scene image as background */}
        {sceneImage && (
          <div className="absolute inset-x-0 top-0 h-60 z-0 pointer-events-none">
            <img src={sceneImage} alt="" className="w-full h-full object-cover" onError={() => setSceneImage(null)} />
            <div className="absolute inset-0 bg-gradient-to-b from-stone-950/30 via-stone-950/60 to-stone-950" />
          </div>
        )}
        {imageLoading && !sceneImage && (
          <div className="absolute inset-x-0 top-0 h-8 flex items-center justify-center z-0">
            <span className="text-amber-600/30 text-xs">场景浮现中...</span>
          </div>
        )}

        {/* Chat messages */}
        <div ref={scrollRef} className="absolute inset-0 overflow-y-auto chat-scroll px-4 py-4 space-y-4 z-10">
          {/* Spacer when scene image is showing */}
          {sceneImage && <div className="h-36" />}

          {messages.map((msg, i) => (
            <div
              key={i}
              className={`animate-fade-in-up ${
                msg.role === 'user' ? 'flex justify-end' : msg.role === 'system' ? 'flex justify-center' : 'flex justify-start'
              }`}
            >
              {msg.role === 'system' ? (
                <div className="text-amber-500/50 text-xs text-center px-4 py-2 bg-amber-900/10 rounded-full">
                  {msg.content}
                </div>
              ) : msg.role === 'user' ? (
                <div className="max-w-[80%] bg-amber-800/25 border border-amber-700/20 rounded-2xl rounded-br-md px-4 py-2.5 text-amber-100/90 text-sm backdrop-blur-sm">
                  {msg.content}
                </div>
              ) : (
                <div className="max-w-[85%] bg-stone-900/80 border border-stone-700/30 rounded-2xl rounded-bl-md px-4 py-3 text-amber-100/80 text-sm leading-relaxed whitespace-pre-wrap backdrop-blur-sm">
                  {msg.content}
                </div>
              )}
            </div>
          ))}

          {isStreaming && messages[messages.length - 1]?.role !== 'assistant' && (
            <div className="flex justify-start">
              <div className="bg-stone-900/80 border border-stone-700/30 rounded-2xl px-4 py-3 flex gap-1 backdrop-blur-sm">
                <span className="typing-dot w-1.5 h-1.5 rounded-full bg-amber-400/60" />
                <span className="typing-dot w-1.5 h-1.5 rounded-full bg-amber-400/60" />
                <span className="typing-dot w-1.5 h-1.5 rounded-full bg-amber-400/60" />
              </div>
            </div>
          )}
        </div>
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
        <div className="px-4 pb-2 flex gap-2 overflow-x-auto flex-none">
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
