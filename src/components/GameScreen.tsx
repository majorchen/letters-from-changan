'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { ChatMessage, saveChatHistory, loadChatHistory, saveGameState, updateChapter } from '@/lib/gameState';
import { PlayerState, buildSystemPrompt, ROLES } from '@/lib/prompts';
import LetterModal from './LetterModal';
import LetterBox from './LetterBox';
import Prologue from './Prologue';

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

const ROLE_SCENES: Record<string, string> = {
  merchant: '/scene-merchant.webp',
  musician: '/scene-musician.webp',
  wanderer: '/scene-wanderer.webp',
  scholar: '/scene-scholar.webp',
};

// Mailbox injection removed — now handled by AI [MAILBOX] tag

let messageCounter = 0;
// mailboxInjected not needed — AI handles via [MAILBOX] tag
let lastSceneLocation = '';

const LOCATION_KEYWORDS = [
  { keyword: '西市', scene: 'Tang Dynasty West Market bazaar, crowded stalls with silk fabrics spices and pottery, Persian and Chinese merchants trading, warm lantern light, bustling energy' },
  { keyword: '东市', scene: 'Tang Dynasty East Market, elegant shops with jade calligraphy and luxury goods, scholars and nobles browsing, morning sunlight through wooden eaves' },
  { keyword: '客栈', scene: 'Interior of a Tang Dynasty inn room, warm candlelight, wooden furniture, silk curtains, a mysterious ceramic mailbox glowing faintly in the corner' },
  { keyword: '酒肆', scene: 'Tang Dynasty wine house interior, warm amber light, patrons drinking and laughing, a musician playing pipa in the corner, steam rising from hot dishes' },
  { keyword: '城门', scene: 'Tang Dynasty Chang an Zhuque Gate at golden hour, massive city walls, guards in armor, stream of travelers entering, warm sunset light' },
  { keyword: '朱雀大街', scene: 'Tang Dynasty Zhuque Avenue, wide grand boulevard stretching to the horizon, crowds of people in colorful Tang robes, horse carriages, willow trees lining the road' },
  { keyword: '道观', scene: 'A quiet Taoist temple in Tang Dynasty Chang an, incense smoke curling upward, ancient cypress trees, a priest sweeping stone steps in golden afternoon light' },
  { keyword: '坊', scene: 'A residential ward in Tang Dynasty Chang an at dusk, narrow alleys between courtyard houses, children playing, the smell of cooking, warm lanterns being lit' },
];

export default function GameScreen({ gameState, onStateChange, onExit }: Props) {
  const [gamePhase, setGamePhase] = useState<'prologue' | 'typewriter' | 'playing'>('prologue');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [typewriterText, setTypewriterText] = useState('');
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [showLetter, setShowLetter] = useState(false);
  const [letterContent, setLetterContent] = useState('');
  const [letterLoading, setLetterLoading] = useState(false);
  const [showMailbox, setShowMailbox] = useState(false);
  const [showLetterBox, setShowLetterBox] = useState(false);
  const [sceneImage, setSceneImage] = useState<string | null>(null);
  const [imageLoading, setImageLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
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

  useEffect(() => {
    if (initRef.current) return;
    const history = loadChatHistory();
    if (history.length > 0) {
      initRef.current = true;
      setSceneImage(ROLE_SCENES[gameState.role] || ROLE_SCENES.scholar);
      setGamePhase('playing');
    } else {
      initRef.current = true;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Typewriter for opening
  useEffect(() => {
    if (gamePhase !== 'typewriter') return;
    const opening = OPENING_NARRATIONS[gameState.role] || OPENING_NARRATIONS.scholar;
    const fullText = opening + '\n\n眼前是宽阔的朱雀大街，人群熙攘。你需要先找个落脚的地方。\n\n【选项A】沿着大街往北走，找一家客栈安顿\n【选项B】先去西市转转，打听行情\n【选项C】在城门附近随便看看';
    let i = 0;
    setTypewriterText('');
    const interval = setInterval(() => {
      i++;
      setTypewriterText(fullText.slice(0, i));
      if (i >= fullText.length) {
        clearInterval(interval);
        const openingMsg: ChatMessage = { role: 'assistant', content: fullText, timestamp: Date.now() };
        setMessages([openingMsg]);
        saveChatHistory([openingMsg]);
        setTimeout(() => setGamePhase('playing'), 300);
      }
    }, 35);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gamePhase]);

  const handlePrologueComplete = useCallback((bgUrl: string) => {
    setSceneImage(bgUrl);
    setGamePhase('typewriter');
  }, []);

  useEffect(() => { scrollToBottom(); }, [messages, scrollToBottom]);

  useEffect(() => {
    if (gameState.hasMailbox && gameState.unreadLetters > 0) {
      setShowMailbox(true);
    }
  }, [gameState]);

  async function sendMessage(text: string) {
    if (gameState.actionsToday >= 10) {
      const limitMsg: ChatMessage = { role: 'system', content: '🌙 今日的长安之旅已尽兴。明天再来继续探索吧。', timestamp: Date.now() };
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

      // Detect [MAILBOX] tag from AI — triggers mailbox discovery
      if (fullContent.includes('[MAILBOX]') && !gameState.hasMailbox) {
        fullContent = fullContent.replace(/\n?\[MAILBOX\]/, '');
        assistantMsg.content = fullContent;
        setMessages([...newMessages, { ...assistantMsg }]);
      }

      const updated = updateChapter(gameState, fullContent);

      // When mailbox is found (via keyword detection in updateChapter), show button
      if (updated.hasMailbox && !gameState.hasMailbox) {
        updated.unreadLetters = 1;
        setShowMailbox(true);
      }
      // Also handle [MAILBOX] tag directly
      if (fullContent.includes('陶器') || fullContent.includes('邮箱')) {
        if (!updated.hasMailbox) {
          updated.hasMailbox = true;
          updated.chapter = 'mailbox_found';
          updated.unreadLetters = 1;
          updated.events = [...updated.events, '发现邮箱'];
          setShowMailbox(true);
        }
      }

      // After replying to letter, new letter arrives after 5 more interactions
      if (updated.chapter === 'letter_replied' && updated.unreadLetters === 0) {
        const msgsSinceLastLetter = messageCounter - (updated.letterHistory.length * 3);
        if (msgsSinceLastLetter >= 5) {
          updated.unreadLetters = 1;
          setShowMailbox(true);
        }
      }

      // Scene image: detect [SCENE:...] tag from AI, or fallback to keyword matching
      const sceneMatch = fullContent.match(/\[SCENE:(.+?)\]/);
      if (sceneMatch) {
        const sceneDesc = sceneMatch[1].trim();
        if (sceneDesc !== lastSceneLocation) {
          lastSceneLocation = sceneDesc;
          generateSceneImage(sceneDesc + '. Warm amber-gold palette, painted on aged silk texture, Dunhuang fresco colors, textured painterly digital art.');
        }
        // Remove the tag from displayed content
        fullContent = fullContent.replace(/\n?\[SCENE:.+?\]/, '');
        assistantMsg.content = fullContent;
        setMessages([...newMessages, { ...assistantMsg }]);
      } else {
        // Fallback: keyword matching for common locations
        for (const loc of LOCATION_KEYWORDS) {
          if (fullContent.includes(loc.keyword) && lastSceneLocation !== loc.keyword) {
            lastSceneLocation = loc.keyword;
            generateSceneImage(loc.scene);
            break;
          }
        }
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
      const currentHistory = gameState.letterHistory || [];
      const res = await fetch('/api/letter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerReply: null, letterHistory: currentHistory }),
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

    const replyMsg: ChatMessage = { role: 'system', content: '📮 你将回信投入了邮箱。信纸在金光中消失了。', timestamp: Date.now() };
    const newMessages = [...messages, replyMsg];
    setMessages(newMessages);
    saveChatHistory(newMessages);
    setShowLetter(false);

    // Auto-continue narration after letter
    setTimeout(() => {
      sendMessage('（我放下信，目光回到窗外的长安……）');
    }, 800);
  }

  function handleLetterClose() {
    setShowLetter(false);
    // If player just read the letter without replying, also continue narration
    if (gameState.chapter === 'first_letter_read' || gameState.chapter === 'mailbox_found') {
      setTimeout(() => {
        sendMessage('（我收好这封奇怪的信，思绪万千……）');
      }, 800);
    }
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

  // Prologue
  if (gamePhase === 'prologue') {
    return <Prologue role={gameState.role} onComplete={handlePrologueComplete} />;
  }

  // Typewriter opening
  if (gamePhase === 'typewriter') {
    return (
      <div className="h-full relative overflow-hidden bg-stone-950">
        {sceneImage && (
          <div className="absolute inset-x-0 top-0 h-[35vh]">
            <img src={sceneImage} alt="" className="w-full h-full object-cover opacity-40" />
            <div className="absolute inset-0 bg-gradient-to-b from-stone-950/20 via-transparent to-stone-950" />
          </div>
        )}
        <div className="absolute inset-0 flex items-end pb-24 px-6">
          <div className="max-w-lg mx-auto w-full">
            <div className="text-amber-100/80 text-sm leading-relaxed whitespace-pre-wrap">
              {typewriterText}
              <span className="inline-block w-0.5 h-4 bg-amber-400/60 ml-0.5 animate-pulse align-text-bottom" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Main game — literary text layout
  return (
    <div className="h-full flex flex-col bg-stone-950">
      {/* Header bar */}
      <div className="flex-none px-4 py-3 bg-stone-950 border-b border-amber-900/10 flex items-center justify-between z-10">
        <button onClick={onExit} className="text-amber-500/50 text-xs hover:text-amber-400 transition-colors">
          ← 离开
        </button>
        <div className="text-center">
          <div className="text-amber-300/70 text-sm font-medium">{gameState.location}</div>
          <div className="text-amber-500/30 text-xs">天宝元年 · {roleInfo?.name || '旅人'}</div>
        </div>
        <div className="flex items-center gap-3">
          {gameState.letterHistory.length > 0 && (
            <button onClick={() => setShowLetterBox(true)} className="text-amber-400/40 hover:text-amber-400 text-base" title="信匣">
              📜
            </button>
          )}
          <span className="text-amber-500/30 text-xs">{gameState.actionsToday}/10</span>
        </div>
      </div>

      {/* Scene image — compact, between header and text */}
      {sceneImage && (
        <div className="flex-none h-[22vh] relative">
          <img
            src={sceneImage}
            alt=""
            className="w-full h-full object-cover opacity-50 transition-opacity duration-1000"
            onError={() => setSceneImage(null)}
          />
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-stone-950" />
        </div>
      )}
      {!sceneImage && imageLoading && (
        <div className="flex-none h-10 flex items-center justify-center">
          <span className="text-amber-600/20 text-xs">场景浮现中...</span>
        </div>
      )}

      {/* Text area — with top fade-out effect */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto chat-scroll px-6 pb-4 text-fade-mask">

        <div className="max-w-lg mx-auto space-y-5">
          {messages.map((msg, i) => (
            <div
              key={i}
              className={`animate-fade-in-up ${
                msg.role === 'user' ? 'text-right' : msg.role === 'system' ? 'text-center' : 'text-left'
              }`}
            >
              {msg.role === 'system' ? (
                <span className="text-amber-500/30 text-xs">{msg.content}</span>
              ) : msg.role === 'user' ? (
                <span className="text-amber-300/90 text-sm">{msg.content}</span>
              ) : (
                <p className="text-amber-100/70 text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
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

      {/* Mailbox notification */}
      {showMailbox && (
        <div className="px-5 pb-2 z-10">
          <button
            onClick={openLetter}
            className="w-full py-3 rounded-xl bg-amber-700/15 border border-amber-500/20 text-amber-300/80 text-sm animate-pulse-glow flex items-center justify-center gap-2"
          >
            <span className="text-lg">📮</span>
            邮箱在发光...
          </button>
        </div>
      )}

      {/* Quick actions — hidden when mailbox is showing */}
      {!isStreaming && !showMailbox && (
        <div className="px-5 pb-2 flex gap-2 overflow-x-auto flex-none z-10">
          {getQuickActions().map((action) => (
            <button
              key={action}
              onClick={() => sendMessage(action)}
              className="flex-none px-3 py-1.5 rounded-full bg-amber-900/15 border border-amber-800/15 text-amber-500/50 text-xs hover:bg-amber-800/20 hover:text-amber-300/70 transition-colors whitespace-nowrap"
            >
              {action}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <form onSubmit={handleSubmit} className="flex-none px-4 pb-4 pt-2 z-10">
        <div className="flex gap-2 items-end max-w-lg mx-auto">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="说点什么..."
            rows={1}
            disabled={isStreaming}
            className="flex-1 bg-stone-800/60 border border-amber-700/30 rounded-xl px-4 py-2.5 text-sm text-amber-100/90 placeholder:text-amber-600/40 resize-none focus:outline-none focus:border-amber-600/50 disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={!input.trim() || isStreaming}
            className="flex-none w-10 h-10 rounded-xl bg-amber-700/40 border border-amber-600/30 flex items-center justify-center text-amber-200 hover:bg-amber-700/50 transition-colors disabled:opacity-30"
          >
            ↑
          </button>
        </div>
      </form>

      {/* Modals */}
      {showLetter && (
        <LetterModal content={letterContent} isLoading={letterLoading} onClose={handleLetterClose} onReply={handleReply} canReply={true} />
      )}
      {showLetterBox && (
        <LetterBox letters={gameState.letterHistory} onClose={() => setShowLetterBox(false)} />
      )}
    </div>
  );
}
