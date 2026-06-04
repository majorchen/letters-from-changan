'use client';

import Image from 'next/image';
import { useState, useRef, useEffect, useCallback } from 'react';
import { ChatMessage, saveChatHistory, loadChatHistory, saveGameState, updateChapter, loadSceneCache, saveSceneCache, NarrativeStateUpdate } from '@/lib/gameState';
import { PlayerState, ROLES } from '@/lib/prompts';
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

// Strip all tags and option lines from displayed narrative text.
// Handles unclosed [SCENE: during streaming, and removes 【选项X】 lines.
function cleanNarrative(text: string): string {
  return text
    // Remove closed [SCENE:...] / [MAILBOX] tags anywhere
    .replace(/\[SCENE:[^\]]*\]/gi, '')
    .replace(/\[STATE\][\s\S]*?\[\/STATE\]/gi, '')
    .replace(/\[MAILBOX\]/gi, '')
    // Truncate from the FIRST option marker to the end (handles mid-stream)
    .replace(/(?:【\s*选项\s*[a-cA-C]?\s*】|(?:^|\n)\s*选项\s*[a-cA-C]\s*[：:]|(?:^|\n)\s*[a-cA-C]\s*[\.、:：)]|(?:^|\n)\s*[1-3]\s*[\.、:：)）])[\s\S]*$/i, '')
    // Truncate unclosed tags appearing at the end during streaming
    .replace(/\[SCENE:[\s\S]*$/i, '')
    .replace(/\[STATE[\s\S]*$/i, '')
    .replace(/\[MAILBOX[\s\S]*$/i, '')
    .replace(/\[\s*$/, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// Extract option texts from raw AI content
function extractOptions(text: string): string[] {
  const options: string[] = [];
  const patterns = [
    /【\s*选项\s*[A-C]?\s*】\s*([^\n【\[]+)/gi,
    /(?:^|\n)\s*选项\s*[A-C]\s*[：:]\s*([^\n【\[]+)/gi,
    /(?:^|\n)\s*[A-C]\s*[\.、:：)]\s*([^\n【\[]+)/gi,
    /(?:^|\n)\s*[1-3]\s*[\.、:：)]\s*([^\n【\[]+)/g,
  ];

  for (const pattern of patterns) {
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(text)) !== null) {
      const option = match[1].replace(/\[SCENE:[\s\S]*$/i, '').trim();
      if (option) options.push(option.slice(0, 60));
    }
  }

  return Array.from(new Set(options)).slice(0, 4);
}

function fallbackOptions(state: PlayerState, content: string, playerInput = ''): string[] {
  const context = `${playerInput}\n${content}`;
  if (state.chapter === 'mailbox_found' && state.unreadLetters > 0) {
    return ['靠近那只发光的陶器', '先不理会，整理行李', '叫王掌柜来看看'];
  }

  if (/(问|询问|追问|打听|告诉|解释|为什么|怎么|何人|是谁|哪里|何处)/.test(playerInput)) {
    return ['继续追问这个细节', '观察对方说话时的神色', '换个角度试探一句'];
  }
  if (/(看|观察|检查|查看|摸|靠近|打开|寻找|翻|搜)/.test(playerInput)) {
    return ['仔细查看异常之处', '把看到的细节记在心里', '询问旁人是否也注意到了'];
  }
  if (/(去|走|前往|离开|回|进入|出门|跟|追)/.test(playerInput)) {
    return ['继续朝那个方向走', '先停下观察周围', '向路边的人打听去处'];
  }
  if (/(拒绝|不理|忽视|算了|离远|躲|藏)/.test(playerInput)) {
    return ['坚持不碰这件事', '暗中观察后续变化', '找个可信的人旁敲侧击'];
  }

  if (context.includes('客栈') || state.location.includes('客栈')) {
    return ['向王掌柜打听城中消息', '留意身边人的谈话', '出门去西市走走'];
  }
  if (context.includes('西市') || state.location.includes('西市')) {
    return ['找商贩打听消息', '观察人群中的异乡人', '回客栈歇脚'];
  }
  if (context.includes('信') || context.includes('林深')) {
    return ['细想信中不对劲的地方', '把信里的线索告诉一个人', '暂时收起信继续观察长安'];
  }
  return ['继续观察四周', '上前询问身边的人', '换个方向继续走'];
}

function ensureMailboxOption(options: string[], state: PlayerState): string[] {
  if (state.chapter !== 'mailbox_found' || state.unreadLetters <= 0) return options;
  if (options.some(option => option.includes('发光') || option.includes('陶器') || option.includes('邮箱'))) return options;
  return ['靠近那只发光的陶器', ...options].slice(0, 4);
}

function isMailboxOption(option: string, state: PlayerState): boolean {
  return state.chapter === 'mailbox_found'
    && state.unreadLetters > 0
    && (option.includes('发光') || option.includes('陶器') || option.includes('邮箱'));
}

function fallbackSceneFromNarrative(state: PlayerState, content: string): string {
  const role = ROLES[state.role]?.name || '旅人';
  const excerpt = content.replace(/\s+/g, ' ').slice(0, 180);
  return `Tang Dynasty Chang an, ${state.location}, a ${role} in the current story moment: ${excerpt}, cinematic narrative scene, warm historical atmosphere`;
}

function latestSceneFromMessages(messages: ChatMessage[]): string | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].sceneImage) return messages[i].sceneImage || null;
  }
  return null;
}

function excerpt(text: string, maxLength = 140): string {
  return text.replace(/\s+/g, ' ').trim().slice(0, maxLength);
}

function latestLetterFrom(state: PlayerState, from: 'linShen' | 'player'): string {
  for (let i = (state.letterHistory || []).length - 1; i >= 0; i--) {
    const letter = state.letterHistory[i];
    if (letter.from === from) return excerpt(letter.content);
  }
  return '';
}

function buildLetterContinuationPrompt(state: PlayerState, mode: 'read' | 'reply'): string {
  const location = state.location || '长安';
  const latestLinLetter = latestLetterFrom(state, 'linShen');
  const latestPlayerReply = latestLetterFrom(state, 'player');

  if (mode === 'reply') {
    return `（我已经把回信投入邮箱。请从当前位置"${location}"继续长安中的当下场景，让我刚才的回信影响我的情绪或接下来遇到的人。我的回信大意是："${latestPlayerReply || '我写下了自己的回应'}"。不要重置回客栈，不要凭空反复引入黑衣人。）`;
  }

  return `（我收好林深的来信。请从当前位置"${location}"继续，不要重置剧情；让信里的一个具体细节自然影响我接下来观察长安的方式。最近这封信的大意是："${latestLinLetter || '林深写来了一封来自远方的信'}"。不要默认回客栈，不要凭空反复引入黑衣人。）`;
}

function parseNarrativeState(text: string): NarrativeStateUpdate | undefined {
  const match = text.match(/\[STATE\]([\s\S]*?)\[\/STATE\]/i);
  if (!match) return undefined;
  const update: NarrativeStateUpdate = {};
  for (const rawLine of match[1].split('\n')) {
    const line = rawLine.trim();
    const separatorIndex = line.indexOf(':');
    if (separatorIndex < 0) continue;
    const key = line.slice(0, separatorIndex).trim().toUpperCase();
    const value = line.slice(separatorIndex + 1).trim();
    if (!value) continue;
    if (key === 'LOCATION' && value.toLowerCase() !== 'none') {
      update.location = value;
    }
    if (key === 'NPCS') {
      update.npcs = value.split(/[、,，]/).map(item => item.trim()).filter(Boolean);
    }
    if (key === 'EVENTS') {
      update.events = value.split(/[、,，]/).map(item => item.trim()).filter(Boolean);
    }
    if (key === 'SUMMARY' && value.toLowerCase() !== 'none') {
      update.summary = value;
    }
    if (key === 'NPC_MEMORY' && value.toLowerCase() !== 'none') {
      update.npcMemories = {};
      for (const rawEntry of value.split(/[;；]/)) {
        const [name, attitude, fact] = rawEntry.split('|').map(item => item.trim());
        if (!name || name.toLowerCase() === 'none') continue;
        update.npcMemories[name] = {
          attitude: attitude || '中立',
          lastInteraction: fact || '',
          knownFacts: fact ? [fact] : [],
        };
      }
    }
    if (key === 'INPUT') {
      const inputMode = value.toLowerCase();
      if (inputMode === 'options' || inputMode === 'free') {
        update.inputMode = inputMode;
      }
    }
    if (key === 'MAILBOX') {
      const mailbox = value.toLowerCase();
      if (mailbox === 'none' || mailbox === 'pending_first_open' || mailbox === 'unread' || mailbox === 'quiet') {
        update.mailbox = mailbox;
      }
    }
  }
  return update;
}

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
  const messageCounterRef = useRef(0);
  const lastSceneLocationRef = useRef('');

  // Always-fresh refs to avoid React closure staleness in async callbacks
  const gameStateRef = useRef(gameState);
  const messagesRef = useRef(messages);

  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  const scrollToBottom = useCallback(() => {
    setTimeout(() => {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
    }, 50);
  }, []);

  useEffect(() => {
    const history = loadChatHistory();
    if (history.length > 0) {
      setMessages(history);
      const latestScene = latestSceneFromMessages(history);
      if (latestScene) setSceneImage(latestScene);
      messageCounterRef.current = history.filter(m => m.role === 'user').length;
    }
  }, []);

  useEffect(() => {
    if (initRef.current) return;
    const history = loadChatHistory();
    if (history.length > 0) {
      initRef.current = true;
      setSceneImage(latestSceneFromMessages(history) || ROLE_SCENES[gameState.role] || ROLE_SCENES.scholar);
      setGamePhase('playing');
    } else {
      // New game — reset module-level state
      initRef.current = true;
      messageCounterRef.current = 0;
      lastSceneLocationRef.current = '';
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Typewriter for opening
  useEffect(() => {
    if (gamePhase !== 'typewriter') return;
    const opening = OPENING_NARRATIONS[gameState.role] || OPENING_NARRATIONS.scholar;
    const fullText = opening + '\n\n眼前是宽阔的朱雀大街，人群熙攘。你需要先找个落脚的地方。\n\n【选项A】沿着大街往北走，找一家客栈安顿\n【选项B】先去西市转转，打听行情\n【选项C】在城门附近随便看看';
    const typeText = cleanNarrative(fullText); // type only narrative, no option text
    const options = extractOptions(fullText);
    let i = 0;
    setTypewriterText('');
    const interval = setInterval(() => {
      i++;
      setTypewriterText(typeText.slice(0, i));
      if (i >= typeText.length) {
        clearInterval(interval);
        const openingMsg: ChatMessage = {
          role: 'assistant',
          content: typeText,
          options,
          timestamp: Date.now(),
        };
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
    if (gameState.hasMailbox && gameState.unreadLetters > 0 && gameState.chapter !== 'mailbox_found') {
      setShowMailbox(true);
    }
  }, [gameState]);

  async function sendMessage(text: string) {
    const gs = gameStateRef.current; // always-fresh state (avoids closure staleness)
    const msgs = messagesRef.current;

    messageCounterRef.current++;
    const userMsg: ChatMessage = { role: 'user', content: text, timestamp: Date.now() };
    const newMessages = [...msgs, userMsg];
    setMessages(newMessages);
    setInput('');
    setIsStreaming(true);

    const assistantMsg: ChatMessage = { role: 'assistant', content: '', timestamp: Date.now() };
    const apiMessages = newMessages
      .filter(m => m.role !== 'system')
      .slice(-20)
      .map(m => ({ role: m.role, content: m.content }));

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: apiMessages, playerState: gs }),
      });

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      if (!reader) throw new Error('No reader');
      if (!res.ok) throw new Error(`Chat request failed: ${res.status}`);

      let fullContent = '';
      let pending = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        pending += decoder.decode(value, { stream: true });
        const lines = pending.split('\n');
        pending = lines.pop() || '';
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') continue;
            try {
              const parsed = JSON.parse(data);
              if (parsed.content) {
                fullContent += parsed.content;
                // Real-time cleanup during streaming (strips tags + option lines)
                assistantMsg.content = cleanNarrative(fullContent);
                setMessages([...newMessages, { ...assistantMsg }]);
              }
            } catch { /* skip */ }
          }
        }
      }
      if (pending.startsWith('data: ')) {
        const data = pending.slice(6);
        if (data !== '[DONE]') {
          try {
            const parsed = JSON.parse(data);
            if (parsed.content) {
              fullContent += parsed.content;
              assistantMsg.content = cleanNarrative(fullContent);
              setMessages([...newMessages, { ...assistantMsg }]);
            }
          } catch { /* incomplete tail, skip */ }
        }
      }

      // === Extract everything from RAW content, display CLEANED content ===
      const rawContent = fullContent;
      const cleanContent = cleanNarrative(rawContent);

      // 1. Scene image — prefer the AI's current-shot [SCENE:] tag every turn.
      //    Keyword presets are only fallback when the model omits a scene tag.
      const sceneMatch = rawContent.match(/\[SCENE:([^\]]+)\]/i);
      if (sceneMatch) {
        const sceneDesc = sceneMatch[1].trim();
        const key = 'ai:' + sceneDesc.slice(0, 80);
        lastSceneLocationRef.current = key;
        generateSceneImage(
          sceneDesc + '. Warm amber-gold palette, painted on aged silk texture, Dunhuang fresco colors, textured painterly digital art.',
          key,
        );
      } else {
        let usedKeywordFallback = false;
        for (const loc of LOCATION_KEYWORDS) {
          if (rawContent.includes(loc.keyword)) {
            usedKeywordFallback = true;
            if (lastSceneLocationRef.current !== loc.keyword) {
              lastSceneLocationRef.current = loc.keyword;
              generateSceneImage(
                loc.scene + '. Warm amber-gold palette, painted on aged silk texture, Dunhuang fresco colors, textured painterly digital art.',
                loc.keyword,
              );
            }
            break;
          }
        }
        if (!usedKeywordFallback) {
          const fallbackScene = fallbackSceneFromNarrative(gs, cleanContent);
          const key = 'narrative:' + cleanContent.slice(0, 80);
          lastSceneLocationRef.current = key;
          generateSceneImage(
            fallbackScene + '. Warm amber-gold palette, painted on aged silk texture, Dunhuang fresco colors, textured painterly digital art.',
            key,
          );
        }
      }

      // 2. Mailbox trigger (from raw)
      const mailboxTriggered = rawContent.includes('[MAILBOX]');
      const narrativeState = parseNarrativeState(rawContent);
      const updated = updateChapter(gs, rawContent, narrativeState);

      if ((mailboxTriggered || (rawContent.includes('陶器') && rawContent.includes('发光'))) && !gs.hasMailbox) {
        updated.hasMailbox = true;
        updated.chapter = 'mailbox_found';
        updated.mailbox = {
          ...updated.mailbox,
          discovered: true,
          pendingFirstOpen: true,
          unread: updated.mailbox.unread.length > 0 ? updated.mailbox.unread : [{ id: `letter-${Date.now()}`, from: 'linShen', createdAt: Date.now() }],
        };
        updated.unreadLetters = updated.mailbox.unread.length;
        if (!updated.events.includes('发现邮箱')) {
          updated.events = [...updated.events, '发现邮箱'];
        }
        assistantMsg.content = cleanContent;
        assistantMsg.options = ensureMailboxOption(fallbackOptions(updated, rawContent, text), updated);
        onStateChange(updated);
        saveGameState(updated);
        const finalMsgs = [...newMessages, { ...assistantMsg, content: cleanContent, options: assistantMsg.options }];
        saveChatHistory(finalMsgs);
        setMessages(finalMsgs);
        setIsStreaming(false);
        return;
      }

      // 3. New letter after replying (every 5 interactions)
      if (updated.chapter === 'letter_replied' && updated.unreadLetters === 0) {
        const turnsSinceLastLetter = updated.turnCount - updated.mailbox.lastGeneratedAtTurn;
        if (turnsSinceLastLetter >= 5) {
          updated.mailbox = {
            ...updated.mailbox,
            discovered: true,
            unread: [{ id: `letter-${Date.now()}`, from: 'linShen', createdAt: Date.now() }],
            lastGeneratedAtTurn: updated.turnCount,
          };
          updated.unreadLetters = updated.mailbox.unread.length;
          setShowMailbox(true);
        }
      }

      // 4. Options (from raw) — stored on the message for persistence
      const extractedOptions = extractOptions(rawContent);
      const opts = updated.awaitingFreeInput
        ? []
        : ensureMailboxOption(extractedOptions.length > 0 ? extractedOptions : fallbackOptions(updated, rawContent, text), updated);

      // 5. Display cleaned content + options on message
      assistantMsg.content = cleanContent;
      assistantMsg.options = opts;
      onStateChange(updated);
      saveGameState(updated);
      const finalMessages = [...newMessages, { ...assistantMsg, content: cleanContent, options: opts }];
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
    setLetterContent('');

    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 55000);
    try {
      const gs = gameStateRef.current;
      const currentHistory = gs.letterHistory || [];
      const res = await fetch('/api/letter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerReply: null, letterHistory: currentHistory }),
        signal: controller.signal,
      });
      if (!res.ok) throw new Error(`Letter request failed: ${res.status}`);
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      const content = data.content || '（信纸上的字迹模糊不清...）';
      setLetterContent(content);

      const updated = {
        ...gs,
        unreadLetters: 0,
        chapter: gs.chapter === 'mailbox_found' ? 'first_letter_read' : gs.chapter,
        mailbox: {
          ...gs.mailbox,
          discovered: true,
          pendingFirstOpen: false,
          unread: [],
        },
        letterHistory: [...currentHistory, { from: 'linShen', content, timestamp: Date.now() }],
      };
      onStateChange(updated);
      saveGameState(updated);
    } catch (err) {
      console.error(err);
      setLetterContent('（信封没有完全打开。也许风从窗缝里吹乱了字迹，请稍后再试。）');
    } finally {
      window.clearTimeout(timeoutId);
      setLetterLoading(false);
    }
  }

  async function handleReply(reply: string) {
    const gs = gameStateRef.current;
    const updated = {
      ...gs,
      chapter: 'letter_replied',
      mailbox: {
        ...gs.mailbox,
        pendingFirstOpen: false,
        unread: [],
        lastGeneratedAtTurn: gs.turnCount || 0,
      },
      letterHistory: [...gs.letterHistory, { from: 'player', content: reply, timestamp: Date.now() }],
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
      sendMessage(buildLetterContinuationPrompt(updated, 'reply'));
    }, 800);
  }

  function handleLetterClose() {
    setShowLetter(false);
    // Always continue narration after closing letter
    setTimeout(() => {
      sendMessage(buildLetterContinuationPrompt(gameStateRef.current, 'read'));
    }, 800);
  }

  // Generate scene image with caching. cacheKey identifies the location;
  // if already generated, reuse instantly instead of regenerating.
  async function generateSceneImage(scene: string, cacheKey: string) {
    const cache = loadSceneCache();
    if (cache[cacheKey]) {
      setSceneImage(cache[cacheKey]);
      persistLatestSceneImage(cache[cacheKey]);
      return;
    }
    setImageLoading(true);
    try {
      const res = await fetch('/api/image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scene }),
      });
      const data = await res.json();
      if (data.url) {
        setSceneImage(data.url);
        persistLatestSceneImage(data.url);
        cache[cacheKey] = data.url;
        saveSceneCache(cache);
      }
    } catch { /* silently fail */ }
    setImageLoading(false);
  }

  function persistLatestSceneImage(url: string) {
    const currentMessages = messagesRef.current;
    for (let i = currentMessages.length - 1; i >= 0; i--) {
      if (currentMessages[i].role === 'assistant') {
        const updatedMessages = [...currentMessages];
        updatedMessages[i] = { ...updatedMessages[i], sceneImage: url };
        messagesRef.current = updatedMessages;
        setMessages(updatedMessages);
        saveChatHistory(updatedMessages);
        return;
      }
    }
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
            <Image
              src={sceneImage}
              alt=""
              fill
              sizes="100vw"
              priority
              unoptimized
              className="object-cover opacity-40"
            />
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

  // Main game — scroll-over-image layout
  return (
    <div className="h-full flex flex-col bg-stone-950 relative">
      {/* Scene image — absolute, behind everything */}
      {sceneImage && (
        <div className="absolute inset-x-0 top-0 h-[35vh] z-0 pointer-events-none">
          <Image
            src={sceneImage}
            alt=""
            fill
            sizes="100vw"
            unoptimized
            className="object-cover opacity-50 transition-opacity duration-1000"
            onError={() => setSceneImage(null)}
          />
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-stone-950" />
        </div>
      )}
      {imageLoading && !sceneImage && (
        <div className="absolute inset-x-0 top-4 z-30 text-center">
          <span className="text-amber-600/20 text-xs">场景浮现中...</span>
        </div>
      )}

      {/* Header bar — compact, translucent, on top of image */}
      <div className="flex-none px-4 py-1.5 bg-stone-950/50 backdrop-blur-sm grid grid-cols-[1fr_auto_1fr] items-center z-20 relative">
        <button onClick={onExit} className="justify-self-start text-amber-500/50 text-xs hover:text-amber-400 transition-colors">
          ← 离开
        </button>
        <div className="text-center justify-self-center min-w-0">
          <div className="text-amber-300/70 text-xs font-medium">{gameState.location}</div>
          <div className="text-amber-500/30 text-[10px]">天宝元年 · {roleInfo?.name || '旅人'}</div>
        </div>
        <div className="justify-self-end flex min-w-10 items-center justify-end">
          <button onClick={() => setShowLetterBox(true)} className="flex h-7 w-7 items-center justify-center text-amber-400/40 hover:text-amber-400 text-sm" title="信匣">
            📜
          </button>
        </div>
      </div>

      {/* Text area — on top of image, with top fade mask */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto chat-scroll px-6 pb-4 z-10 relative text-fade-mask">
        {/* Spacer so initial content starts below the image */}
        <div className="h-[28vh]" />

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
                <span className="text-amber-500/50 text-sm">{msg.content}</span>
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

      {/* AI options as clickable buttons — from last assistant message */}
      {(() => {
        const lastMsg = messages[messages.length - 1];
        const currentOptions = (!isStreaming && lastMsg?.role === 'assistant' && lastMsg.options) ? lastMsg.options : [];
        if (showMailbox || currentOptions.length === 0) return null;
        return (
          <div className="px-5 pb-2 flex flex-col gap-2 flex-none z-10">
            {currentOptions.map((option, i) => (
              <button
                key={i}
                onClick={() => isMailboxOption(option, gameState) ? openLetter() : sendMessage(option)}
                className={`w-full text-left px-4 py-2 rounded-lg border text-sm transition-colors ${
                  isMailboxOption(option, gameState)
                    ? 'bg-amber-700/20 border-amber-400/35 text-amber-200/90 animate-pulse-glow'
                    : 'bg-amber-900/15 border-amber-800/20 text-amber-400/70 hover:bg-amber-800/25 hover:text-amber-300/80'
                }`}
              >
                {option}
              </button>
            ))}
          </div>
        );
      })()}

      {/* Input */}
      <form onSubmit={handleSubmit} className="flex-none px-4 pb-4 pt-2 z-10">
        {gameState.awaitingFreeInput && !isStreaming && (
          <div className="max-w-lg mx-auto pb-2 text-center text-xs text-amber-400/45">
            这一刻，长安在等你亲口回答。
          </div>
        )}
        <div className="flex gap-2 items-end max-w-lg mx-auto">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={gameState.awaitingFreeInput ? '写下你的回应...' : '说点什么...'}
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
