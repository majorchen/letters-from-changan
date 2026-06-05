'use client';

import Image from 'next/image';
import QRCode from 'qrcode';
import { useState, useRef, useEffect, useCallback } from 'react';
import { ChatMessage, saveChatHistory, loadChatHistory, saveGameState, updateChapter, loadSceneCache, saveSceneCache, NarrativeStateUpdate, getCrossLineEchoes } from '@/lib/gameState';
import { PlayerState, ROLES } from '@/lib/prompts';
import { getVideoAsset, makeVideoKey, saveVideoAsset, VideoAsset, VideoEventType } from '@/lib/videoCache';
import { getCloudUserEmail } from '@/lib/cloudSaves';
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

const GAME_URL = 'https://letterstang.aifisher.cn';
const REPLY_LETTER_COOLDOWN_TURNS = 28;
const VIDEO_EVENT_COOLDOWN_TURNS = 10;
const VIDEO_EVENT_COOLDOWN_MS = 90_000;
const GUEST_FIRST_LETTER_TOAST_KEY = 'letters-from-changan-guest-first-letter-toast-v1';

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
  const contradictionOption = getContradictionOption(state);
  if (state.chapter === 'mailbox_found' && getUnreadLetterCount(state) > 0) {
    return ['靠近那只发光的陶器', '先不理会，整理行李', '叫王掌柜来看看'];
  }

  if (/(问|询问|追问|打听|告诉|解释|为什么|怎么|何人|是谁|哪里|何处)/.test(playerInput)) {
    return withContradictionOption(['继续追问这个细节', '观察对方说话时的神色', '换个角度试探一句'], contradictionOption);
  }
  if (/(看|观察|检查|查看|摸|靠近|打开|寻找|翻|搜)/.test(playerInput)) {
    return withContradictionOption(['仔细查看异常之处', '把看到的细节记在心里', '询问旁人是否也注意到了'], contradictionOption);
  }
  if (/(去|走|前往|离开|回|进入|出门|跟|追)/.test(playerInput)) {
    return withContradictionOption(['继续朝那个方向走', '先停下观察周围', '向路边的人打听去处'], contradictionOption);
  }
  if (/(拒绝|不理|忽视|算了|离远|躲|藏)/.test(playerInput)) {
    return withContradictionOption(['坚持不碰这件事', '暗中观察后续变化', '找个可信的人旁敲侧击'], contradictionOption);
  }

  if (context.includes('客栈') || state.location.includes('客栈')) {
    return withContradictionOption(['向王掌柜打听城中消息', '留意身边人的谈话', '出门去西市走走'], contradictionOption);
  }
  if (context.includes('西市') || state.location.includes('西市')) {
    return withContradictionOption(['找商贩打听消息', '观察人群中的异乡人', '回客栈歇脚'], contradictionOption);
  }
  if (context.includes('信') || context.includes('林深')) {
    return withContradictionOption(['细想信中不对劲的地方', '把信里的线索告诉一个人', '暂时收起信继续观察长安'], contradictionOption);
  }
  return withContradictionOption(['继续观察四周', '上前询问身边的人', '换个方向继续走'], contradictionOption);
}

function getContradictionOption(state: PlayerState): string | null {
  for (const [event, sources] of Object.entries(state.eventVersions || {})) {
    if (Object.keys(sources || {}).length >= 2) {
      return `追问「${event}」的不同说法`;
    }
  }
  return null;
}

function withContradictionOption(options: string[], contradictionOption: string | null): string[] {
  if (!contradictionOption || options.includes(contradictionOption)) return options;
  return [contradictionOption, ...options].slice(0, 4);
}

function ensureMailboxOption(options: string[], state: PlayerState): string[] {
  if (state.chapter !== 'mailbox_found' || getUnreadLetterCount(state) <= 0) return options;
  if (options.some(option => option.includes('发光') || option.includes('陶器') || option.includes('邮箱'))) return options;
  return ['靠近那只发光的陶器', ...options].slice(0, 4);
}

function isMailboxOption(option: string, state: PlayerState): boolean {
  return state.chapter === 'mailbox_found'
    && getUnreadLetterCount(state) > 0
    && (option.includes('发光') || option.includes('陶器') || option.includes('邮箱'));
}

function hasDiscoveredMailbox(state: PlayerState): boolean {
  return Boolean(state.mailbox?.discovered);
}

function getUnreadLetterCount(state: PlayerState): number {
  return state.mailbox?.unread?.length ?? 0;
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

function getShareExcerpt(messages: ChatMessage[], activeLetter = ''): string {
  const letter = activeLetter.replace(/\s+/g, ' ').trim();
  if (letter.length >= 40) return letter;
  const candidates = [...messages]
    .reverse()
    .filter((message) => message.role === 'assistant')
    .map((message) => message.content.replace(/\s+/g, ' ').trim())
    .filter((content) => content.length >= 40)
    .filter((content) => !content.includes('眼前是宽阔的朱雀大街，人群熙攘。你需要先找个落脚的地方。'));
  return candidates[0] || '';
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
    if (key === 'EVENT_VERSION' && value.toLowerCase() !== 'none') {
      update.eventVersions = {};
      for (const rawEntry of value.split(/[;；]/)) {
        const [event, source, version] = rawEntry.split('|').map(item => item.trim());
        if (!event || !source || !version) continue;
        update.eventVersions[event] = {
          ...(update.eventVersions[event] || {}),
          [source]: version,
        };
      }
    }
    if (key === 'SECOND_CORRESPONDENT' && value.toLowerCase() !== 'none') {
      update.secondCorrespondentHint = value;
    }
    if (key === 'VISUAL') {
      const visual = value.toLowerCase();
      if (visual === 'none' || visual === 'glitch' || visual === 'memory' || visual === 'ending') {
        update.visualCue = visual;
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
  const [shareImageUrl, setShareImageUrl] = useState('');
  const [visualCue, setVisualCue] = useState<'glitch' | 'memory' | null>(null);
  const [videoCue, setVideoCue] = useState<{ type: VideoEventType; urls: string[]; index: number } | null>(null);
  const [videoStatus, setVideoStatus] = useState('');
  const [saveToast, setSaveToast] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const initRef = useRef(false);
  const messageCounterRef = useRef(0);
  const lastVideoEventRef = useRef<{ type?: VideoEventType; turn: number; at: number }>({ turn: -999, at: 0 });
  const endingVideoStartedRef = useRef(false);

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
    if (hasDiscoveredMailbox(gameState) && getUnreadLetterCount(gameState) === 0) {
      setShowMailbox(false);
    }
  }, [gameState]);

  async function sendMessage(text: string, options: { visibleUser?: boolean } = {}) {
    const gs = gameStateRef.current; // always-fresh state (avoids closure staleness)
    const msgs = messagesRef.current;
    const visibleUser = options.visibleUser !== false;

    messageCounterRef.current++;
    const userMsg: ChatMessage = { role: 'user', content: text, timestamp: Date.now(), hidden: !visibleUser };
    const newMessages = visibleUser ? [...msgs, userMsg] : msgs;
    setMessages(newMessages);
    setInput('');
    setIsStreaming(true);

    const assistantMsg: ChatMessage = { role: 'assistant', content: '', timestamp: Date.now() };
    const playerStateForApi = { ...gs, crossLineEchoes: getCrossLineEchoes(gs.role) };
    const apiMessages = [...msgs, userMsg]
      .filter(m => m.role !== 'system')
      .slice(-20)
      .map(m => ({ role: m.role, content: m.content }));

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: apiMessages, playerState: playerStateForApi }),
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
      const narrativeState = parseNarrativeState(rawContent);
      if (narrativeState?.visualCue === 'glitch' || narrativeState?.visualCue === 'memory' || narrativeState?.visualCue === 'ending') {
        const acceptedVideoCue = acceptVideoCue(narrativeState.visualCue, gameStateRef.current);
        if (acceptedVideoCue) {
          if (narrativeState.visualCue !== 'ending') {
            setVisualCue(narrativeState.visualCue);
            window.setTimeout(() => setVisualCue(null), narrativeState.visualCue === 'memory' ? 2600 : 1400);
          }
          prepareVideoCue(narrativeState.visualCue, updatedVideoPrompt(gameStateRef.current, cleanContent));
        }
      }

      // 1. Scene image — prefer the AI's current-shot [SCENE:] tag every turn.
      //    Keyword presets are only fallback when the model omits a scene tag.
      const sceneMatch = rawContent.match(/\[SCENE:([^\]]+)\]/i);
      if (sceneMatch) {
        const sceneDesc = sceneMatch[1].trim();
        generateSceneImage(
          sceneDesc + '. Warm amber-gold palette, painted on aged silk texture, Dunhuang fresco colors, textured painterly digital art.',
          `ai:${sceneDesc.slice(0, 120)}`,
        );
      } else {
        let usedKeywordFallback = false;
        for (const loc of LOCATION_KEYWORDS) {
          if (rawContent.includes(loc.keyword)) {
            usedKeywordFallback = true;
            generateSceneImage(
              loc.scene + '. Warm amber-gold palette, painted on aged silk texture, Dunhuang fresco colors, textured painterly digital art.',
              `location:${loc.keyword}`,
            );
            break;
          }
        }
        if (!usedKeywordFallback) {
          const fallbackScene = fallbackSceneFromNarrative(gs, cleanContent);
          generateSceneImage(
            fallbackScene + '. Warm amber-gold palette, painted on aged silk texture, Dunhuang fresco colors, textured painterly digital art.',
            `narrative:${gs.role}:${gs.location}:${cleanContent.replace(/\s+/g, ' ').slice(0, 120)}`,
          );
        }
      }

      // 2. Mailbox trigger (from raw)
      const mailboxTriggered = rawContent.includes('[MAILBOX]');
      const updated = updateChapter(gs, rawContent, narrativeState);
      const pendingFirstMailbox = mailboxTriggered || narrativeState?.mailbox === 'pending_first_open';

      if (pendingFirstMailbox && !hasDiscoveredMailbox(gs)) {
        updated.chapter = 'mailbox_found';
        updated.mailbox = {
          ...updated.mailbox,
          discovered: true,
          pendingFirstOpen: true,
          unread: updated.mailbox.unread.length > 0 ? updated.mailbox.unread : [{ id: `letter-${Date.now()}`, from: 'linShen', createdAt: Date.now() }],
        };
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

      // 3. New letters after replying are deliberately sparse.
      //    If the model asks for MAILBOX: unread too soon, keep the mailbox quiet.
      if (updated.chapter === 'letter_replied' && getUnreadLetterCount(updated) === 0) {
        const turnsSinceLastLetter = updated.turnCount - updated.mailbox.lastGeneratedAtTurn;
        if (turnsSinceLastLetter >= REPLY_LETTER_COOLDOWN_TURNS) {
          updated.mailbox = {
            ...updated.mailbox,
            discovered: true,
            unread: [{ id: `letter-${Date.now()}`, from: 'linShen', createdAt: Date.now() }],
            lastGeneratedAtTurn: updated.turnCount,
          };
          setShowMailbox(false);
        }
      } else if (updated.chapter === 'letter_replied' && getUnreadLetterCount(updated) > 0) {
        const turnsSinceLastLetter = updated.turnCount - (gs.mailbox.lastGeneratedAtTurn || 0);
        if (turnsSinceLastLetter < REPLY_LETTER_COOLDOWN_TURNS) {
          updated.mailbox = {
            ...updated.mailbox,
            unread: [],
            lastGeneratedAtTurn: gs.mailbox.lastGeneratedAtTurn || updated.mailbox.lastGeneratedAtTurn,
          };
        }
      }

      // 4. Options (from raw) — stored on the message for persistence
      const extractedOptions = extractOptions(rawContent);
      const optionsWithFallback = extractedOptions.length > 0 ? extractedOptions : fallbackOptions(updated, rawContent, text);
      const opts = updated.awaitingFreeInput
        ? []
        : ensureMailboxOption(withContradictionOption(optionsWithFallback, getContradictionOption(updated)), updated);

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
      const playerStateForApi = { ...gs, crossLineEchoes: getCrossLineEchoes(gs.role) };
      const res = await fetch('/api/letter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerReply: null, letterHistory: currentHistory, playerState: playerStateForApi }),
        signal: controller.signal,
      });
      if (!res.ok) throw new Error(`Letter request failed: ${res.status}`);
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      const content = data.content || '（信纸上的字迹模糊不清...）';
      setLetterContent(content);

      const updated = {
        ...gs,
        chapter: gs.chapter === 'mailbox_found' ? 'first_letter_read' : gs.chapter,
        mailbox: {
          ...gs.mailbox,
          discovered: true,
          pendingFirstOpen: false,
          unread: [],
        },
        letterHistory: [...currentHistory, { from: 'linShen', content, timestamp: Date.now() }],
      };
      gameStateRef.current = updated;
      onStateChange(updated);
      saveGameState(updated);
      if (currentHistory.filter((letter) => letter.from === 'linShen').length === 0) {
        showGuestFirstLetterToast();
      }
    } catch (err) {
      console.error(err);
      setLetterContent('（信封没有完全打开。也许风从窗缝里吹乱了字迹，请稍后再试。）');
    } finally {
      window.clearTimeout(timeoutId);
      setLetterLoading(false);
    }
  }

  async function showGuestFirstLetterToast() {
    if (typeof window === 'undefined') return;
    if (localStorage.getItem(GUEST_FIRST_LETTER_TOAST_KEY)) return;
    const email = await getCloudUserEmail();
    if (email) return;
    localStorage.setItem(GUEST_FIRST_LETTER_TOAST_KEY, 'shown');
    setSaveToast('旅程已保存 · 登录可跨设备继续');
    window.setTimeout(() => setSaveToast(''), 3000);
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
    gameStateRef.current = updated;
    onStateChange(updated);
    saveGameState(updated);

    const replyMsg: ChatMessage = { role: 'system', content: '📮 你将回信投入了邮箱。信纸在金光中消失了。', timestamp: Date.now() };
    const newMessages = [...messages, replyMsg];
    setMessages(newMessages);
    saveChatHistory(newMessages);
    setShowLetter(false);

    // Auto-continue narration after letter
    setTimeout(() => {
      sendMessage(buildLetterContinuationPrompt(updated, 'reply'), { visibleUser: false });
    }, 800);
  }

  function handleLetterClose() {
    setShowLetter(false);
    // Always continue narration after closing letter
    setTimeout(() => {
      sendMessage(buildLetterContinuationPrompt(gameStateRef.current, 'read'), { visibleUser: false });
    }, 800);
  }

  function wrapCanvasText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, lineHeight: number, maxLines: number): void {
    const chars = text.replace(/\s+/g, '').split('');
    let line = '';
    let currentY = y;
    let lineCount = 0;
    for (const char of chars) {
      const testLine = line + char;
      if (ctx.measureText(testLine).width > maxWidth && line) {
        ctx.fillText(line, x, currentY);
        line = char;
        currentY += lineHeight;
        lineCount += 1;
        if (lineCount >= maxLines) return;
      } else {
        line = testLine;
      }
    }
    if (line && lineCount < maxLines) ctx.fillText(line, x, currentY);
  }

  async function handleShareCard() {
    const shareExcerpt = getShareExcerpt(messagesRef.current, showLetter ? letterContent : '');
    if (!shareExcerpt) return;

    const canvas = document.createElement('canvas');
    canvas.width = 1080;
    canvas.height = 1440;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Background: use the title screen Chang'an image, then darken it for legibility.
    await new Promise<void>((resolve) => {
      const bgImg = new window.Image();
      bgImg.crossOrigin = 'anonymous';
      bgImg.onload = () => {
        // object-cover: crop to fill without distortion
        const imgRatio = bgImg.width / bgImg.height;
        const canvasRatio = canvas.width / canvas.height;
        let sx = 0, sy = 0, sw = bgImg.width, sh = bgImg.height;
        if (imgRatio > canvasRatio) {
          sw = bgImg.height * canvasRatio;
          sx = (bgImg.width - sw) / 2;
        } else {
          sh = bgImg.width / canvasRatio;
          sy = (bgImg.height - sh) / 2;
        }
        ctx.drawImage(bgImg, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
        const ov = ctx.createLinearGradient(0, 0, 0, canvas.height);
        ov.addColorStop(0, 'rgba(12,10,9,0.84)');
        ov.addColorStop(0.46, 'rgba(12,10,9,0.90)');
        ov.addColorStop(1, 'rgba(12,10,9,0.96)');
        ctx.fillStyle = ov;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        resolve();
      };
      bgImg.onerror = () => {
        const g = ctx.createLinearGradient(0, 0, 0, canvas.height);
        g.addColorStop(0, '#0c0a09'); g.addColorStop(0.55, '#1c1917'); g.addColorStop(1, '#0c0a09');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        resolve();
      };
      bgImg.src = '/bg-changan.webp';
    });

    let curY = 104;

    await new Promise<void>((resolve) => {
      const icon = new window.Image();
      icon.crossOrigin = 'anonymous';
      icon.onload = () => {
        const s = 104;
        const ix = (canvas.width - s) / 2;
        const iy = curY;
        const r = 22;
        ctx.save();
        ctx.beginPath();
        ctx.roundRect(ix, iy, s, s, r);
        ctx.clip();
        ctx.drawImage(icon, ix, iy, s, s);
        ctx.restore();
        ctx.strokeStyle = 'rgba(253,230,138,0.24)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.roundRect(ix, iy, s, s, r);
        ctx.stroke();
        resolve();
      };
      icon.onerror = () => resolve();
      icon.src = '/icon-192.png';
    });

    curY += 138;
    ctx.textAlign = 'center';
    ctx.fillStyle = '#fde68a';
    ctx.font = '700 72px serif';
    ctx.fillText('来信长安', canvas.width / 2, curY);
    ctx.fillStyle = 'rgba(251,191,36,0.58)';
    ctx.font = 'italic 30px serif';
    ctx.fillText("Letters from Chang'an", canvas.width / 2, curY + 48);
    curY += 152;

    ctx.fillStyle = 'rgba(253,230,138,0.88)';
    ctx.font = '700 42px serif';
    ctx.fillText('你在唐朝收到了', canvas.width / 2, curY);
    ctx.fillText('一封来自2077年的信', canvas.width / 2, curY + 58);
    curY += 128;

    ctx.fillStyle = 'rgba(245,158,11,0.60)';
    ctx.font = '26px serif';
    ctx.fillText(`天宝元年 · ${roleInfo?.name || '旅人'} · ${gameState.location}`, canvas.width / 2, curY);
    curY += 54;

    ctx.textAlign = 'left';
    const excerptX = 92;
    const excerptY = curY;
    const excerptW = 896;
    const excerptH = 440;
    ctx.fillStyle = 'rgba(28,25,23,0.58)';
    ctx.strokeStyle = 'rgba(245,158,11,0.18)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(excerptX, excerptY, excerptW, excerptH, 24);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = 'rgba(254,243,199,0.78)';
    ctx.font = '34px serif';
    wrapCanvasText(ctx, shareExcerpt.slice(0, 420), excerptX + 42, excerptY + 68, excerptW - 84, 56, 7);

    const qrCanvas = document.createElement('canvas');
    await QRCode.toCanvas(qrCanvas, GAME_URL, {
      errorCorrectionLevel: 'M',
      margin: 1,
      width: 190,
      color: { dark: '#1c1917', light: '#fef3c7' },
    });
    const qrX = 96;
    const qrY = 1184;
    ctx.fillStyle = '#fef3c7';
    ctx.beginPath();
    ctx.roundRect(qrX, qrY, 218, 218, 18);
    ctx.fill();
    ctx.drawImage(qrCanvas, qrX + 14, qrY + 14, 190, 190);

    ctx.fillStyle = 'rgba(253,230,138,0.78)';
    ctx.font = '700 28px serif';
    ctx.fillText(GAME_URL.replace('https://', ''), 350, 1264);
    ctx.fillStyle = 'rgba(254,243,199,0.58)';
    ctx.font = '25px serif';
    ctx.fillText('AI互动叙事 · 每次都是唯一的故事', 350, 1310);

    const dataUrl = canvas.toDataURL('image/png');
    setShareImageUrl(dataUrl);
  }

  function updatedVideoPrompt(state: PlayerState, content: string): string {
    const role = ROLES[state.role]?.name || '旅人';
    const excerpt = content.replace(/\s+/g, ' ').slice(0, 180);
    return `Tang Dynasty Chang an cinematic narrative moment, ${state.location}, ${role}, ${excerpt}, warm amber light, aged silk texture, subtle time distortion, no text, no subtitles`;
  }

  function endingSegmentPrompt(basePrompt: string, segmentIndex: number): string {
    const beats = [
      'opening shot, the current Tang Dynasty scene becomes still as if time is holding its breath',
      'middle shot, the ceramic mailbox glows and thin 2077 light leaks into Chang an dust',
      'memory shot, fragments of letters and faces cross the screen like reflected silk',
      'closing shot, quiet fade toward black, unresolved tenderness, no text, no subtitles',
    ];
    return `${basePrompt}, ending sequence segment ${segmentIndex + 1}, ${beats[segmentIndex] || beats[0]}`;
  }

  function acceptVideoCue(type: VideoEventType, state: PlayerState): boolean {
    if (type === 'ending') {
      if (endingVideoStartedRef.current) return false;
      endingVideoStartedRef.current = true;
      return true;
    }

    const now = Date.now();
    const last = lastVideoEventRef.current;
    if (state.turnCount - last.turn < VIDEO_EVENT_COOLDOWN_TURNS) return false;
    if (now - last.at < VIDEO_EVENT_COOLDOWN_MS) return false;

    lastVideoEventRef.current = { type, turn: state.turnCount, at: now };
    return true;
  }

  function playVideoUrls(type: VideoEventType, urls: string[]) {
    if (urls.length > 0) setVideoCue({ type, urls, index: 0 });
  }

  function finishVideoPlayback() {
    setVideoCue((current) => {
      if (!current) return null;
      const nextIndex = current.index + 1;
      if (nextIndex >= current.urls.length) return null;
      return { ...current, index: nextIndex };
    });
  }

  async function pollVideoAsset(asset: VideoAsset, attempt = 1): Promise<VideoAsset | null> {
    if (!asset.taskId) return null;
    try {
      const params = new URLSearchParams({
        taskId: asset.taskId,
        key: asset.key,
        type: asset.type,
        prompt: asset.prompt,
      });
      const res = await fetch(`/api/video?${params.toString()}`);
      const data = await res.json();
      const status = String(data.status || '').toLowerCase();
      if (data.url || status === 'succeeded' || status === 'completed' || status === 'success') {
        const ready: VideoAsset = {
          ...asset,
          status: 'ready' as const,
          url: data.url || asset.url,
          updatedAt: Date.now(),
        };
        saveVideoAsset(ready);
        return ready;
      } else if (status === 'failed' || status === 'error') {
        saveVideoAsset({ ...asset, status: 'failed', updatedAt: Date.now() });
        return null;
      } else if (attempt < 6) {
        window.setTimeout(() => pollVideoAsset(asset, attempt + 1), 6000);
      }
    } catch {
      // Keep CSS visual cue fallback.
    }
    return null;
  }

  async function prepareVideoSegment(type: VideoEventType, prompt: string, key: string, segmentIndex: number): Promise<VideoAsset | null> {
    const cached = getVideoAsset(key);
    if (cached?.status === 'ready' && cached.url) return cached;
    if (cached?.status === 'queued') return pollVideoAsset(cached);

    const res = await fetch('/api/video', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        key,
        type,
        segmentIndex,
        prompt,
        width: 1152,
        height: 768,
        num_frames: type === 'glitch' ? 73 : 121,
        frame_rate: 24,
      }),
    });
    const data = await res.json();
    if (!res.ok || (!data.taskId && !data.url)) return null;
    const asset: VideoAsset = {
      key,
      type,
      status: data.url ? 'ready' : 'queued',
      prompt,
      taskId: data.taskId,
      url: data.url,
      urls: data.url ? [data.url] : undefined,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    saveVideoAsset(asset);
    return asset.status === 'ready' ? asset : pollVideoAsset(asset);
  }

  async function prepareVideoCue(type: VideoEventType, prompt: string) {
    const gs = gameStateRef.current;
    const baseKey = makeVideoKey(type, gs.role, gs.location, gs.turnCount);
    const segmentCount = type === 'ending' ? 4 : 1;
    try {
      setVideoStatus(type === 'ending' ? '结局影像生成中...' : type === 'glitch' ? '时空裂缝生成中...' : '记忆影像生成中...');
      const readyAssets = await Promise.all(Array.from({ length: segmentCount }, (_, index) => {
        const key = segmentCount === 1 ? baseKey : `${baseKey}:segment-${index + 1}`;
        const segmentPrompt = segmentCount === 1 ? prompt : endingSegmentPrompt(prompt, index);
        return prepareVideoSegment(type, segmentPrompt, key, index);
      }));
      const urls = readyAssets
        .map((asset) => asset?.url || '')
        .filter(Boolean);
      if (urls.length === segmentCount) {
        playVideoUrls(type, urls);
        setVideoStatus('');
      } else {
        setVideoStatus('影像已排队，生成完成后会自动缓存');
        window.setTimeout(() => setVideoStatus(''), 2600);
      }
    } catch {
      // Keep CSS visual cue fallback.
      setVideoStatus('');
    }
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
  const unreadLetterCount = getUnreadLetterCount(gameState);
  const shouldGlowLetterBox = unreadLetterCount > 0;

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
      {visualCue && (
        <div className={`pointer-events-none absolute z-30 mix-blend-screen ${
          visualCue === 'memory'
            ? 'inset-x-4 top-[28vh] bottom-28 overflow-hidden rounded-2xl'
            : 'inset-x-0 top-0 h-[35vh] overflow-hidden'
        }`}>
          <div className="absolute inset-0 bg-cyan-400/10 animate-pulse" />
          <div className="absolute inset-y-0 left-0 w-1/2 translate-x-2 bg-amber-300/10 blur-sm" />
          <div className="absolute inset-x-0 top-1/3 h-px bg-amber-100/35" />
          <div className="absolute inset-x-0 top-2/3 h-px bg-cyan-100/25" />
          {visualCue === 'memory' && <div className="absolute inset-10 border border-amber-200/10 bg-amber-100/5 blur-[1px]" />}
        </div>
      )}
      {videoCue && (
        <div className={`pointer-events-none absolute z-30 overflow-hidden ${
          videoCue.type === 'ending'
            ? 'inset-0 bg-stone-950'
            : videoCue.type === 'memory'
              ? 'inset-x-4 top-[28vh] bottom-28 rounded-2xl border border-amber-300/10 bg-stone-950/25'
              : 'inset-x-0 top-0 h-[35vh] mix-blend-screen'
        }`}>
          <video
            key={`${videoCue.type}-${videoCue.index}-${videoCue.urls[videoCue.index]}`}
            src={videoCue.urls[videoCue.index]}
            autoPlay
            muted
            playsInline
            className={`h-full w-full object-cover ${
              videoCue.type === 'memory'
                ? 'opacity-35'
                : videoCue.type === 'ending'
                  ? 'opacity-80'
                  : 'opacity-45 saturate-150 contrast-125'
            }`}
            onEnded={finishVideoPlayback}
            onError={() => setVideoCue(null)}
          />
          <div className={`absolute inset-0 ${videoCue.type === 'ending' ? 'bg-stone-950/15' : 'bg-stone-950/25'}`} />
        </div>
      )}
      {videoStatus && (
        <div className="absolute inset-x-0 top-4 z-30 text-center">
          <span className="rounded-full border border-cyan-300/10 bg-stone-950/55 px-3 py-1 text-xs text-cyan-100/45">{videoStatus}</span>
        </div>
      )}
      {saveToast && (
        <div className="absolute inset-x-0 top-4 z-30 text-center">
          <span className="rounded-full border border-amber-500/15 bg-stone-950/70 px-3 py-1 text-xs text-amber-200/70">{saveToast}</span>
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
          <button onClick={handleShareCard} className="flex h-7 w-7 items-center justify-center text-amber-400/40 hover:text-amber-400 text-sm" title="生成分享卡片">
            🕊️
          </button>
          <button
            onClick={() => shouldGlowLetterBox ? openLetter() : setShowLetterBox(true)}
            className={`flex h-7 w-7 items-center justify-center text-sm hover:text-amber-400 ${
              shouldGlowLetterBox ? 'text-amber-300/90 animate-pulse-glow' : 'text-amber-400/40'
            }`}
            title={shouldGlowLetterBox ? '新信到了' : '信匣'}
          >
            📜
          </button>
        </div>
      </div>

      {/* Text area — on top of image, with top fade mask */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto chat-scroll px-6 pb-4 z-10 relative text-fade-mask">
        {/* Spacer so initial content starts below the image */}
        <div className="h-[28vh]" />

        <div className="max-w-lg mx-auto space-y-5">
          {messages.filter((msg) => !msg.hidden).map((msg, i) => (
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

      {shareImageUrl && (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" onClick={() => setShareImageUrl('')}>
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
          <div className="relative z-10 w-full max-w-md rounded-t-2xl border border-amber-700/20 bg-stone-950/95 px-4 pb-5 pt-4 shadow-2xl sm:mx-4 sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between">
              <div>
                <div className="font-handwriting text-2xl text-amber-200/90">分享这段旅程</div>
                <div className="text-xs text-amber-500/40">长按图片保存，发给朋友</div>
              </div>
              <button onClick={() => setShareImageUrl('')} className="text-sm text-amber-500/45 hover:text-amber-300">
                关闭
              </button>
            </div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={shareImageUrl} alt="分享卡片" className="mx-auto max-h-[72vh] w-auto max-w-full rounded-xl border border-amber-900/20 shadow-2xl" />
          </div>
        </div>
      )}
    </div>
  );
}
