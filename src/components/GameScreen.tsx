'use client';

import Image from 'next/image';
import QRCode from 'qrcode';
import { useState, useRef, useEffect, useCallback } from 'react';
import { ChatMessage, saveChatHistory, loadChatHistory, saveGameState, updateChapter, NarrativeStateUpdate } from '@/lib/gameState';
import { LetterEntry, LetterImage, PlayerState, ROLES, VisualProfile, IMAGE_STYLE_PREFIX, IMAGE_CONSTRAINT_SUFFIX } from '@/lib/prompts';
import { getCloudUserEmail } from '@/lib/cloudSaves';
import LetterModal from './LetterModal';
import LetterBox from './LetterBox';
import Prologue from './Prologue';
import EndingSequence from './EndingSequence';

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
  { keyword: '西市', scene: 'Tang Dynasty West Market bazaar, crowded stalls with silk fabrics spices and pottery, Persian and Chinese merchants trading, warm amber atmosphere, bustling energy' },
  { keyword: '东市', scene: 'Tang Dynasty East Market, elegant shops with jade calligraphy and luxury goods, scholars and nobles browsing, soft morning tones, wooden eaves' },
  { keyword: '客栈', scene: 'Interior of a Tang Dynasty inn room, wooden furniture, silk curtains, a mysterious ceramic mailbox in the corner, warm muted tones, quiet solitude' },
  { keyword: '酒肆', scene: 'Tang Dynasty wine house interior, patrons drinking and laughing, a musician playing pipa in the corner, warm amber atmosphere, lively mood' },
  { keyword: '城门', scene: 'Tang Dynasty Chang an Zhuque Gate, massive city walls, guards in armor, stream of travelers entering, warm golden atmosphere' },
  { keyword: '朱雀大街', scene: 'Tang Dynasty Zhuque Avenue, wide grand boulevard, crowds of people in colorful Tang robes, horse carriages, willow trees lining the road' },
  { keyword: '道观', scene: 'A quiet Taoist temple in Tang Dynasty Chang an, ancient cypress trees, a priest sweeping stone steps, serene atmosphere, muted green and amber tones' },
  { keyword: '坊', scene: 'A residential ward in Tang Dynasty Chang an, narrow alleys between courtyard houses, children playing, warm evening atmosphere, domestic tranquility' },
];

const GAME_URL = 'https://letterstang.aifisher.cn';
const GUEST_FIRST_LETTER_TOAST_KEY = 'letters-from-changan-guest-first-letter-toast-v1';
const CHAT_TIMEOUT_MS = 45_000;
const NEW_LETTER_OPTION = '信匣里有一封新信';
const ACTIVE_LETTER_INTERVAL_TURNS = 8;
const FIRST_LETTER_IMAGE_URL = '/linshen-first-letter.webp';

const EVENT_LABELS: Record<string, string> = {
  anchor_inn_basement_future: '客栈暗处的未来痕迹',
  anchor_letter_without_postroad: '没有驿路的来信',
  anchor_missing_ward_map: '坊图缺页',
  anchor_persian_song_future_echo: '胡乐里的未来回声',
  anchor_ledger_price_drift: '账本价格异动',
  anchor_guard_knows_name: '守门兵认得你的名字',
  anchor_ceramic_warm_after_letter: '陶器余温',
  anchor_linshen_wrong_tree: '林深说错的树',
  anchor_future_food_smell: '汤里的未来气味',
  anchor_ai_scribe_copy: '抄书童的重字',
  anchor_blade_notch_memory: '刀上的陌生缺口',
  anchor_market_fire_not_yet: '尚未发生的西市火',
  anchor_border_report_whisper: '军报里的耳语',
  anchor_leaving_changan_cart: '清晨离京的车',
  anchor_linshen_knows_end: '林深知道的结局',
  anchor_second_correspondent_shadow: '另一个收信人',
};

// Strip all tags and option lines from displayed narrative text.
// Handles unclosed [SCENE: during streaming, and removes 【选项X】 lines.
function cleanNarrative(text: string): string {
  return text
    .replace(/\[OPTIONS_JSON\][\s\S]*?\[\/OPTIONS_JSON\]/gi, '')
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
    .replace(/\[OPTIONS_JSON[\s\S]*$/i, '')
    .replace(/\[\s*$/, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// Extract option texts from raw AI content
function extractOptions(text: string): string[] {
  // Support both strict and loose spacing in tags
  const structured = text.match(/\[\s*OPTIONS_JSON\s*\]([\s\S]*?)\[\s*\/OPTIONS_JSON\s*\]/i);
  if (structured) {
    try {
      const content = structured[1].trim();
      let parsed: string[] = [];
      // Robust JSON parsing: handle array or raw lines
      if (content.startsWith('[') && content.endsWith(']')) {
        parsed = JSON.parse(content);
      } else {
        // Fallback for AI occasionally outputting raw strings instead of JSON array
        parsed = content.split(/[,\n]/).map(s => s.trim().replace(/^["']|["']$/g, '')).filter(Boolean);
      }

      if (Array.isArray(parsed)) {
        return Array.from(new Set(
          parsed
            .filter((item): item is string => typeof item === 'string')
            .map((item) => item.trim().slice(0, 60))
            .filter(Boolean),
        )).slice(0, 4);
      }
    } catch {
      // Fall through to legacy option formats.
    }
  }

  const options: string[] = [];
  const patterns = [
    /【\s*选项\s*[A-C]?\s*】\s*([^\n【\[]+)/gi,
    /(?:^|\n)\s*选项\s*[A-C]\s*[：:]\s*([^\n【\[]+)/gi,
    /(?:^|\n)\s*[A-C]\s*[\.、:：)]\s*([^\n【\[]+)/gi,
    /(?:^|\n)\s*[1-3]\s*[\.、:：)）]\s*([^\n【\[]+)/g,
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

function isGenericOption(option: string): boolean {
  const normalized = option.trim().replace(/[.。,，… ]+$/, '');
  return /^(继续观察|仔细查看|换个角度试探一句|打听消息|看看周围|静观其变|等待变化|记下来|离开这里|继续前进|四处打听|四处看看|寻找线索)$/.test(normalized);
}

const FALLBACK_POOL = [
  '静观其变...',
  '四处打探下...',
  '留意周围动静...',
  '暂且按兵不动...',
  '看看还有什么细节...',
  '寻个由头再问问...',
];

function fallbackOptions(state: PlayerState, content: string, messages: ChatMessage[], playerInput = ''): string[] {
  const contradictionOption = getContradictionOption(state);
  const context = `${playerInput}\n${content}`;
  
  if (state.chapter === 'arrival' && /(客栈|客房|房间|投宿|安顿|住下|王掌柜)/.test(context)) {
    return ['请王掌柜安排一间客房', '先把行李放进房里'];
  }

  // Pick a fallback that hasn't been used recently, with randomness
  const recent = recentAssistantOptions(messages);
  const pool = FALLBACK_POOL.filter(opt => !recent.some(r => optionSimilarity(r, opt) > 0.8));
  const fallback = pool.length > 0 
    ? pool[Math.floor(Math.random() * pool.length)] 
    : FALLBACK_POOL[Math.floor(Math.random() * FALLBACK_POOL.length)];

  return withContradictionOption([fallback], contradictionOption);
}

function normalizeOptionForComparison(option: string): string {
  return option.replace(/[^\p{Script=Han}a-z0-9]/giu, '').toLowerCase();
}

function optionSimilarity(a: string, b: string): number {
  const left = new Set(normalizeOptionForComparison(a));
  const right = new Set(normalizeOptionForComparison(b));
  if (!left.size || !right.size) return 0;
  let overlap = 0;
  for (const char of left) if (right.has(char)) overlap += 1;
  return overlap / Math.max(left.size, right.size);
}

function recentAssistantOptions(messages: ChatMessage[]): string[] {
  return messages
    .filter((message) => message.role === 'assistant' && Array.isArray(message.options))
    .slice(-10) // Check further back for variety
    .flatMap((message) => message.options || []);
}

function dedupeOptions(options: string[], messages: ChatMessage[], optionsSource: 'model' | 'fallback' | 'final' = 'model'): string[] {
  const recent = recentAssistantOptions(messages);
  const result: string[] = [];
  
  for (const option of options) {
    if (!option.trim()) continue;
    
    // Model generated options shouldn't be generic
    if (optionsSource === 'model' && isGenericOption(option)) continue;
    
    // Similarity checks to avoid repetition
    if (result.some((existing) => optionSimilarity(existing, option) >= 0.78)) continue;
    if (recent.some((existing) => optionSimilarity(existing, option) >= 0.84)) continue;
    
    result.push(option);
    if (result.length >= 3) break;
  }
  
  // Safety: NEVER return an empty array if we have candidates.
  // If everything was filtered but it's the final pass or fallback, keep at least one.
  if (result.length === 0 && options.length > 0) {
    return [options[0]];
  }
  
  return result;
}

function getContradictionOption(state: PlayerState): string | null {
  for (const [event, sources] of Object.entries(state.eventVersions || {})) {
    if (Object.keys(sources || {}).length >= 2 && !hasAskedContradiction(state, event)) {
      const label = EVENT_LABELS[event] || event
        .replace(/^anchor_/, '')
        .replace(/_/g, ' ')
        .trim();
      return `追问「${label}」的不同说法`;
    }
  }
  return null;
}

function withContradictionOption(options: string[], contradictionOption: string | null): string[] {
  if (!contradictionOption || options.includes(contradictionOption)) return options;
  return [...options, contradictionOption].slice(0, 4);
}

function normalizeOptionLabel(option: string): string {
  return option.replace(/「(anchor_[a-z0-9_]+)」/gi, (_, key: string) => `「${EVENT_LABELS[key] || key.replace(/^anchor_/, '').replace(/_/g, ' ')}」`);
}

function contradictionAskedMarker(event: string): string {
  return `contradiction_asked:${event}`;
}

function hasAskedContradiction(state: PlayerState, event: string): boolean {
  return (state.events || []).includes(contradictionAskedMarker(event));
}

function findContradictionEventByOption(state: PlayerState, option: string): string | null {
  const match = option.match(/追问「(.+?)」的不同说法/);
  if (!match) return null;
  const label = match[1].trim();
  for (const event of Object.keys(state.eventVersions || {})) {
    const eventLabel = EVENT_LABELS[event] || event.replace(/^anchor_/, '').replace(/_/g, ' ').trim();
    if (label === eventLabel || label === event) return event;
  }
  return null;
}

function ensureMailboxOption(options: string[], state: PlayerState): string[] {
  const hasFreshNotice = state.mailbox?.unread?.some((notice) => !notice.noticeShown);
  if (!hasFreshNotice) return options.filter((option) => option !== NEW_LETTER_OPTION);
  return [NEW_LETTER_OPTION, ...options.filter((option) => option !== NEW_LETTER_OPTION)].slice(0, 4);
}

function isMailboxOption(option: string, state: PlayerState): boolean {
  return option === NEW_LETTER_OPTION && getUnreadLetterCount(state) > 0;
}

function hasDiscoveredMailbox(state: PlayerState): boolean {
  return Boolean(state.mailbox?.discovered);
}

function getUnreadLetterCount(state: PlayerState): number {
  return state.mailbox?.unread?.length ?? 0;
}

function findUnreadLetter(state: PlayerState): LetterEntry | undefined {
  const noticeIds = new Set((state.mailbox?.unread || []).map((notice) => notice.id));
  return [...(state.letterHistory || [])]
    .reverse()
    .find((letter) => letter.from === 'linShen' && (noticeIds.has(letter.id) || !letter.readAt));
}

function shouldPrepareActiveLetter(state: PlayerState): boolean {
  if (!state.mailbox.discovered || state.mailbox.pending || state.mailbox.unread.length > 0) return false;
  const linLetters = state.letterHistory.filter((letter) => letter.from === 'linShen');
  if (linLetters.length === 0) return false;
  return state.turnCount - (state.mailbox.lastGeneratedAtTurn || 0) >= ACTIVE_LETTER_INTERVAL_TURNS;
}

function shouldForceFirstMailbox(state: PlayerState, content: string): boolean {
  if (state.mailbox.discovered || state.letterHistory.some((letter) => letter.from === 'linShen')) return false;
  const context = `${state.location}\n${content}`;
  return /(客栈|客房|房间|投宿|安顿|住下|陶罐|陶器|邮箱|信匣|发光|金色光|信件|信笺)/.test(context);
}

function isLetterRelatedOption(option: string): boolean {
  return /(信件|信笺|邮箱|信匣|查看信|读信|展开信|取出.*信|打开.*信|打开邮|展开.*笺)/.test(option);
}

function sanitizeResponse(raw: string, state: PlayerState): string {
  let content = raw;
  content = content.replace(/信上写着[：:][\s\S]*/g, '');
  content = content.replace(/信中说[：:][\s\S]*/g, '');
  content = content.replace(/林深写道[：:][\s\S]*/g, '');
  content = content.replace(/信里写[：:][\s\S]*/g, '');
  const mailboxOverflow = content.match(/(金色光[芒辉]|金光涌出)[，。]/);
  if (mailboxOverflow && mailboxOverflow.index !== undefined) {
    const cutAt = mailboxOverflow.index + mailboxOverflow[0].length;
    const afterCut = content.slice(cutAt);
    const periodIdx = afterCut.indexOf('。');
    if (periodIdx >= 0) {
      content = content.slice(0, cutAt + periodIdx + 1);
    }
  }
  void state;
  return content;
}

function sanitizeOptions(options: string[], messages: ChatMessage[]): string[] {
  const GENERIC_BLACKLIST = /^(观察细节|仔细查看|换个角度试探|打听消息|继续观察|四处看看)$/;
  let filtered = options.filter(opt => !GENERIC_BLACKLIST.test(opt));
  filtered = filtered.filter(opt => !isLetterRelatedOption(opt));
  void messages;
  return filtered.length > 0 ? filtered : options.slice(0, 1);
}

function sanitizeState(parsed: NarrativeStateUpdate, playerState: PlayerState): NarrativeStateUpdate {
  if (parsed.visualCue === 'ending' && (playerState.storyPhase || 'act1') !== 'act3') {
    parsed.visualCue = 'none';
  }
  if (parsed.visualCue === 'glitch' || parsed.visualCue === 'memory') {
    parsed.visualCue = 'none';
  }
  if (parsed.inputMode === 'free' && (playerState.freeInputCount || 0) >= 3) {
    parsed.inputMode = 'options';
  }
  return parsed;
}


function visualProfilesForScene(state: PlayerState, content: string): string {
  const knownNpcs = state.knownNPCs || [];
  const profiles = Object.entries(state.visualProfiles || {})
    .filter(([key, profile]) =>
      key === state.role
      || content.includes(profile.name)
      || content.includes(key)
      || knownNpcs.some(npc => npc === key || npc === profile.name),
    )
    .slice(0, 4)
    .map(([, profile]) => `${profile.name}: ${profile.description}`);
  return profiles.length > 0 ? ` Character continuity: ${profiles.join(' ')}` : '';
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
    if (key === 'VISUAL_PROFILE' && value.toLowerCase() !== 'none') {
      update.visualProfiles = {};
      for (const rawEntry of value.split(/[;；]/)) {
        const separator = rawEntry.indexOf('|');
        if (separator < 1) continue;
        const name = rawEntry.slice(0, separator).trim();
        const description = rawEntry.slice(separator + 1).trim();
        if (!name || !description) continue;
        update.visualProfiles[name] = {
          name,
          description: description.slice(0, 500),
          createdAt: Date.now(),
        } satisfies VisualProfile;
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

async function streamChat(
  body: unknown,
  onContent: (content: string) => void,
  attempt = 1,
): Promise<string> {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), CHAT_TIMEOUT_MS);
  const startedAt = performance.now();
  let firstTokenAt = 0;
  let fullContent = '';
  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`Chat request failed: ${res.status}`);
    const reader = res.body?.getReader();
    if (!reader) throw new Error('No reader');
    const decoder = new TextDecoder();
    let pending = '';

    const consumeLine = (line: string) => {
      if (!line.startsWith('data: ')) return;
      const data = line.slice(6);
      if (data === '[DONE]') return;
      const parsed = JSON.parse(data);
      if (parsed.error) throw new Error(String(parsed.error));
      if (!parsed.content) return;
      if (!firstTokenAt) firstTokenAt = performance.now();
      fullContent += parsed.content;
      onContent(fullContent);
    };

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      pending += decoder.decode(value, { stream: true });
      const lines = pending.split('\n');
      pending = lines.pop() || '';
      for (const line of lines) consumeLine(line);
    }
    if (pending.trim()) consumeLine(pending);
    if (!fullContent.trim()) throw new Error('Empty chat response');
    console.info('[chat-timing]', {
      attempt,
      firstTokenMs: firstTokenAt ? Math.round(firstTokenAt - startedAt) : null,
      totalMs: Math.round(performance.now() - startedAt),
    });
    return fullContent;
  } catch (error) {
    console.warn('[chat-request]', {
      attempt,
      elapsedMs: Math.round(performance.now() - startedAt),
      error: error instanceof Error ? error.message : String(error),
    });
    if (attempt < 2 && !fullContent.trim()) {
      return streamChat(body, onContent, attempt + 1);
    }
    throw error;
  } finally {
    window.clearTimeout(timeoutId);
  }
}

export default function GameScreen({ gameState, onStateChange, onExit }: Props) {
  const [gamePhase, setGamePhase] = useState<'prologue' | 'typewriter' | 'playing'>('prologue');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [typewriterText, setTypewriterText] = useState('');
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [showLetter, setShowLetter] = useState(false);
  const [letterContent, setLetterContent] = useState('');
  const [activeLetterImage, setActiveLetterImage] = useState<LetterImage | undefined>();
  const [activeLetterWasUnread, setActiveLetterWasUnread] = useState(false);
  const [letterLoading, setLetterLoading] = useState(false);
  const [showMailbox, setShowMailbox] = useState(false);
  const [showLetterBox, setShowLetterBox] = useState(false);
  const [sceneImage, setSceneImage] = useState<string | null>(null);
  const [imageLoading, setImageLoading] = useState(false);
  const [shareImageUrl, setShareImageUrl] = useState('');
  const [saveToast, setSaveToast] = useState('');
  const [ending, setEnding] = useState<{ title: string; scenes: string[] } | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const initRef = useRef(false);
  const messageCounterRef = useRef(0);
  const preparingLetterRef = useRef(false);

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
    const pending = gameState.mailbox?.pending;
    if (!pending || preparingLetterRef.current) return;
    if (pending.image) {
      void finishIncomingLetter(pending.id, pending.content, pending.image);
      return;
    }
    const current = gameStateRef.current;
    const updated = {
      ...current,
      mailbox: {
        ...current.mailbox,
        pending: undefined,
        lastGeneratedAtTurn: Math.max(0, current.turnCount - ACTIVE_LETTER_INTERVAL_TURNS + 2),
      },
    };
    gameStateRef.current = updated;
    onStateChange(updated);
    saveGameState(updated);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameState.mailbox?.pending?.id]);

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
    const playerStateForApi = {
      ...gs,
      events: (gs.events || []).filter((event) => !event.startsWith('contradiction_asked:')),
      crossLineEchoes: [],
    };
    const apiMessages = [...msgs, userMsg]
      .filter(m => m.role !== 'system')
      .slice(-20)
      .map(m => ({ role: m.role, content: m.content }));

    try {
      const fullContent = await streamChat(
        { messages: apiMessages, playerState: playerStateForApi },
        (streamedContent) => {
          assistantMsg.content = cleanNarrative(streamedContent);
          setMessages([...newMessages, { ...assistantMsg }]);
        },
      );

      // === Extract everything from RAW content, display CLEANED content ===
      const rawContent = fullContent;
      const cleanContent = sanitizeResponse(cleanNarrative(rawContent), gs);
      const narrativeState = parseNarrativeState(rawContent);
      if (narrativeState) sanitizeState(narrativeState, gs);
      if (narrativeState?.visualCue === 'ending' && !ending) {
        void prepareEnding();
      }
      const mailboxTriggered = rawContent.includes('[MAILBOX]');
      const updated = updateChapter(gs, rawContent, narrativeState);

      // 1. Scene image — prefer the AI's current-shot [SCENE:] tag every turn.
      //    Every story turn generates a fresh image; only the fixed role prologue is pre-rendered.
      const sceneMatch = rawContent.match(/\[SCENE:([^\]]+)\]/i);
      if (sceneMatch) {
        const sceneDesc = sceneMatch[1].trim();
        generateSceneImage(
          IMAGE_STYLE_PREFIX + ' ' + sceneDesc + visualProfilesForScene(updated, rawContent) + ' ' + IMAGE_CONSTRAINT_SUFFIX,
        );
      } else {
        let usedKeywordFallback = false;
        for (const loc of LOCATION_KEYWORDS) {
          if (rawContent.includes(loc.keyword)) {
            usedKeywordFallback = true;
            generateSceneImage(
              IMAGE_STYLE_PREFIX + ' ' + loc.scene + visualProfilesForScene(updated, rawContent) + ' ' + IMAGE_CONSTRAINT_SUFFIX,
            );
            break;
          }
        }
        if (!usedKeywordFallback) {
          // No [SCENE:] tag and no location keyword match — keep current image
        }
      }

      // 2. Mailbox trigger (from raw)
      const forcedFirstMailbox = shouldForceFirstMailbox(updated, rawContent);
      const pendingFirstMailbox = mailboxTriggered
        || narrativeState?.mailbox === 'pending_first_open'
        || forcedFirstMailbox;

      if (pendingFirstMailbox && !hasDiscoveredMailbox(gs)) {
        updated.chapter = 'mailbox_found';
        updated.mailbox = {
          ...updated.mailbox,
          discovered: true,
          pendingFirstOpen: true,
          unread: [],
        };
        if (!updated.events.includes('发现邮箱')) {
          updated.events = [...updated.events, '发现邮箱'];
        }
        assistantMsg.content = /(陶器|陶罐|信匣|邮箱|金色光|金光)/.test(cleanContent)
          ? cleanContent
          : `${cleanContent}\n\n你刚把行李放稳，客房角落那只唐三彩陶器忽然泛起一层很轻的金光。`;
        assistantMsg.options = [NEW_LETTER_OPTION];
        onStateChange(updated);
        saveGameState(updated);
        gameStateRef.current = updated;
        const finalMsgs = [...newMessages, { ...assistantMsg }];
        saveChatHistory(finalMsgs);
        setMessages(finalMsgs);
        setIsStreaming(false);
        setShowMailbox(true);
        void prepareIncomingLetter(null);
        return;
      }

      // 4. Options (from raw) — stored on the message for persistence
      const extractedOptions = sanitizeOptions(extractOptions(rawContent), msgs);
      const contextualFallback = fallbackOptions(updated, rawContent, msgs, text);
      const modelOptions = dedupeOptions(extractedOptions, msgs, 'model');
      const optionsWithFallback = modelOptions.length > 0 ? modelOptions : contextualFallback;
      const opts = updated.awaitingFreeInput
        ? []
        : dedupeOptions(
          ensureMailboxOption(withContradictionOption(optionsWithFallback, getContradictionOption(updated)), updated),
          msgs,
          'final',
        );
      if (opts.includes(NEW_LETTER_OPTION)) {
        updated.mailbox = {
          ...updated.mailbox,
          unread: updated.mailbox.unread.map((notice) => ({ ...notice, noticeShown: true })),
        };
      }

      // 5. Display cleaned content + options on message
      assistantMsg.content = cleanContent;
      assistantMsg.options = opts;
      onStateChange(updated);
      saveGameState(updated);
      const finalMessages = [...newMessages, { ...assistantMsg, content: cleanContent, options: opts }];
      saveChatHistory(finalMessages);
      setMessages(finalMessages);
      setIsStreaming(false);
      if (shouldPrepareActiveLetter(updated)) {
        window.setTimeout(() => void prepareIncomingLetter(null), 500);
      }
    } catch (err) {
      assistantMsg.content = '（长安城的喧嚣声突然安静了一瞬...请再试一次）';
      setMessages([...newMessages, assistantMsg]);
      setIsStreaming(false);
      console.error(err);
    }
  }

  async function openLetter(letterId?: string) {
    setShowLetter(true);
    setShowMailbox(false);
    setLetterLoading(false);
    const gs = gameStateRef.current;
    const targetId = letterId || gs.mailbox.unread[0]?.id || findUnreadLetter(gs)?.id;
    const letter = gs.letterHistory.find((item) => item.id === targetId && item.from === 'linShen');
    if (!letter) {
      setShowLetter(false);
      return;
    }
    setLetterContent(letter.content);
    setActiveLetterImage(letter.image || letter.video);
    const wasUnread = !letter.readAt;
    setActiveLetterWasUnread(wasUnread);
    const updated: PlayerState = {
      ...gs,
      chapter: gs.chapter === 'mailbox_found' ? 'first_letter_read' : gs.chapter,
      mailbox: {
        ...gs.mailbox,
        pendingFirstOpen: false,
        unread: gs.mailbox.unread.filter((notice) => notice.id !== letter.id),
      },
      letterHistory: gs.letterHistory.map((item) => item.id === letter.id ? { ...item, readAt: Date.now() } : item),
    };
    gameStateRef.current = updated;
    onStateChange(updated);
    saveGameState(updated);
    removeMailboxOptionFromLatestMessage();
    if (wasUnread && gs.letterHistory.filter((item) => item.from === 'linShen' && item.readAt).length === 0) {
      void showGuestFirstLetterToast();
    }
  }

  async function finishIncomingLetter(id: string, content: string) {
    const gs = gameStateRef.current;
    if (gs.letterHistory.some((letter) => letter.id === id)) return;
    const letter: LetterEntry = {
      id,
      from: 'linShen',
      content,
      timestamp: Date.now(),
      noticeShown: false,
    };
    const updated: PlayerState = {
      ...gs,
      mailbox: {
        ...gs.mailbox,
        discovered: true,
        pendingFirstOpen: false,
        pending: undefined,
        unread: [...gs.mailbox.unread.filter((notice) => notice.id !== id), {
          id,
          from: 'linShen',
          createdAt: Date.now(),
          noticeShown: false,
        }],
        lastGeneratedAtTurn: gs.turnCount,
      },
      letterHistory: [...gs.letterHistory, letter],
    };
    const currentMessages = messagesRef.current;
    const last = currentMessages[currentMessages.length - 1];
    if (last?.role === 'assistant') {
      const nextMessages = [...currentMessages];
      nextMessages[nextMessages.length - 1] = {
        ...last,
        options: [NEW_LETTER_OPTION, ...(last.options || []).filter((option) => option !== NEW_LETTER_OPTION)].slice(0, 4),
      };
      messagesRef.current = nextMessages;
      setMessages(nextMessages);
      saveChatHistory(nextMessages);
      updated.mailbox.unread = updated.mailbox.unread.map((notice) => ({ ...notice, noticeShown: true }));
    }
    gameStateRef.current = updated;
    onStateChange(updated);
    saveGameState(updated);
  }

  async function prepareIncomingLetter(playerReply: string | null, retryCount = 0) {
    if (preparingLetterRef.current || gameStateRef.current.mailbox.pending) return;
    preparingLetterRef.current = true;
    try {
      const gs = gameStateRef.current;
      const res = await fetch('/api/letter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          playerReply,
          letterHistory: gs.letterHistory,
          playerState: {
            ...gs,
            events: (gs.events || []).filter((event) => !event.startsWith('contradiction_asked:')),
            crossLineEchoes: [],
          },
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.content) throw new Error(data.error || 'Letter generation failed');
      const id = `letter-${Date.now()}`;
      // Letter images are removed to ensure speed and prevent API conflicts.
      await finishIncomingLetter(id, data.content);
    } catch (error) {
      console.error('[incoming-letter]', error);
      if (retryCount < 1) {
        preparingLetterRef.current = false;
        await new Promise(r => setTimeout(r, 2000));
        return prepareIncomingLetter(playerReply, retryCount + 1);
      }
      setSaveToast('林深还在写信...请稍后再试');
      setTimeout(() => setSaveToast(''), 4000);
    } finally {
      preparingLetterRef.current = false;
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
        lastGeneratedAtTurn: gs.turnCount || 0,
      },
      letterHistory: [...gs.letterHistory, {
        id: `reply-${Date.now()}`,
        from: 'player' as const,
        content: reply,
        timestamp: Date.now(),
        readAt: Date.now(),
      }],
    };
    gameStateRef.current = updated;
    onStateChange(updated);
    saveGameState(updated);
    void prepareIncomingLetter(reply);

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
    setActiveLetterImage(undefined);
    if (activeLetterWasUnread) {
      setActiveLetterWasUnread(false);
      setTimeout(() => {
        sendMessage(buildLetterContinuationPrompt(gameStateRef.current, 'read'), { visibleUser: false });
      }, 800);
    }
  }

  function wrapCanvasText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, lineHeight: number, maxLines: number): void {
    const chars = text.replace(/\s+/g, '').split('');
    let line = '';
    let currentY = y;
    let lineCount = 0;
    const drawEllipsisLine = (rawLine: string) => {
      let finalLine = rawLine;
      while (finalLine && ctx.measureText(`${finalLine}...`).width > maxWidth) {
        finalLine = finalLine.slice(0, -1);
      }
      ctx.fillText(`${finalLine}...`, x, currentY);
    };

    for (const char of chars) {
      const testLine = line + char;
      if (ctx.measureText(testLine).width > maxWidth && line) {
        if (lineCount >= maxLines - 1) {
          drawEllipsisLine(line);
          return;
        }
        ctx.fillText(line, x, currentY);
        line = char;
        currentY += lineHeight;
        lineCount += 1;
      } else {
        line = testLine;
      }
    }
    if (line && lineCount < maxLines) ctx.fillText(line, x, currentY);
  }

  async function handleShareCard(overrideExcerpt = '') {
    const shareExcerpt = overrideExcerpt || getShareExcerpt(messagesRef.current, showLetter ? letterContent : '');
    if (!shareExcerpt) return;

    const canvas = document.createElement('canvas');
    canvas.width = 1080;
    canvas.height = 1680;
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

    let curY = 96;

    await new Promise<void>((resolve) => {
      const icon = new window.Image();
      icon.crossOrigin = 'anonymous';
      icon.onload = () => {
        const s = 112;
        const ix = (canvas.width - s) / 2;
        const iy = curY;
        const r = 24;
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

    curY += 230;
    ctx.textAlign = 'center';
    ctx.fillStyle = '#fde68a';
    ctx.font = '700 68px serif';
    ctx.fillText('来信长安', canvas.width / 2, curY);
    ctx.fillStyle = 'rgba(251,191,36,0.58)';
    ctx.font = 'italic 30px serif';
    ctx.fillText("Letters from Chang'an", canvas.width / 2, curY + 48);
    curY += 142;

    ctx.fillStyle = 'rgba(253,230,138,0.88)';
    ctx.font = '700 42px serif';
    ctx.fillText('你在唐朝收到了', canvas.width / 2, curY);
    ctx.fillText('一封来自2077年的信', canvas.width / 2, curY + 58);
    curY += 120;

    ctx.fillStyle = 'rgba(245,158,11,0.60)';
    ctx.font = '26px serif';
    ctx.fillText(`天宝元年 · ${roleInfo?.name || '旅人'} · ${gameState.location}`, canvas.width / 2, curY);
    curY += 74;

    ctx.textAlign = 'left';
    const excerptX = 128;
    const excerptY = curY;
    const excerptW = 824;
    ctx.fillStyle = 'rgba(254,243,199,0.76)';
    ctx.font = '34px serif';
    wrapCanvasText(ctx, shareExcerpt, excerptX, excerptY, excerptW, 58, 10);

    const qrCanvas = document.createElement('canvas');
    await QRCode.toCanvas(qrCanvas, GAME_URL, {
      errorCorrectionLevel: 'M',
      margin: 1,
      width: 204,
      color: { dark: '#1c1917', light: '#faf7ef' },
    });
    const qrSize = 236;
    const qrX = (canvas.width - qrSize) / 2;
    const qrY = 1320;
    ctx.fillStyle = '#faf7ef';
    ctx.beginPath();
    ctx.roundRect(qrX, qrY, qrSize, qrSize, 20);
    ctx.fill();
    ctx.drawImage(qrCanvas, qrX + 16, qrY + 16, 204, 204);

    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(253,230,138,0.78)';
    ctx.font = '700 31px serif';
    ctx.fillText(GAME_URL.replace('https://', ''), canvas.width / 2, 1620);
    ctx.fillStyle = 'rgba(254,243,199,0.58)';
    ctx.font = '26px serif';
    ctx.fillText('AI互动叙事 · 每次都是唯一的故事', canvas.width / 2, 1660);

    const dataUrl = canvas.toDataURL('image/png');
    setShareImageUrl(dataUrl);
  }

  async function prepareEnding() {
    if (ending) return;
    try {
      const res = await fetch('/api/ending', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          playerState: gameStateRef.current,
          recentMessages: messagesRef.current.filter((message) => !message.hidden).slice(-12),
        }),
      });
      const data = await res.json();
      if (res.ok && Array.isArray(data.scenes) && data.scenes.length >= 4) {
        setEnding({ title: data.title || '故事落幕', scenes: data.scenes.slice(0, 6) });
      }
    } catch (error) {
      console.error('[ending]', error);
    }
  }

  const lastGoodImageRef = useRef<string | null>(null);

  async function generateSceneImage(scene: string) {
    setImageLoading(true);
    try {
      const res = await fetch('/api/image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scene }),
      });
      const data = await res.json();
      if (data.url) {
        lastGoodImageRef.current = data.url;
        setSceneImage(data.url);
        persistLatestSceneImage(data.url);
      }
    } catch { /* silently fail — keep current image */ }
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

  function removeMailboxOptionFromLatestMessage() {
    const currentMessages = messagesRef.current;
    const lastMessage = currentMessages[currentMessages.length - 1];
    if (lastMessage?.role !== 'assistant' || !lastMessage.options?.includes(NEW_LETTER_OPTION)) return;
    const nextMessages = [...currentMessages];
    nextMessages[nextMessages.length - 1] = {
      ...lastMessage,
      options: lastMessage.options.filter((option) => option !== NEW_LETTER_OPTION),
    };
    messagesRef.current = nextMessages;
    setMessages(nextMessages);
    saveChatHistory(nextMessages);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || isStreaming) return;
    sendMessage(input.trim());
  }

  function handleOptionClick(option: string) {
    const currentState = gameStateRef.current;
    if (isMailboxOption(option, currentState) || option === NEW_LETTER_OPTION) {
      const unreadLetter = findUnreadLetter(currentState);
      if (unreadLetter) {
        void openLetter(unreadLetter.id);
      } else {
        removeMailboxOptionFromLatestMessage();
        setShowLetterBox(true);
      }
      return;
    }

    if (isLetterRelatedOption(option)) {
      const unreadLetter = findUnreadLetter(currentState);
      if (unreadLetter) {
        void openLetter(unreadLetter.id);
        return;
      }
      if (currentState.mailbox.pendingFirstOpen || currentState.mailbox.pending) {
        setShowLetterBox(true);
        return;
      }
      // 没有未读、没有 pending → 不拦截，当普通选项继续走正常对话
    }

    const contradictionEvent = findContradictionEventByOption(gameStateRef.current, option);
    if (contradictionEvent) {
      const marker = contradictionAskedMarker(contradictionEvent);
      const currentState = gameStateRef.current;
      if (!currentState.events.includes(marker)) {
        const updated = {
          ...currentState,
          events: [...currentState.events, marker],
        };
        gameStateRef.current = updated;
        onStateChange(updated);
        saveGameState(updated);
      }
    }

    sendMessage(option);
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
  const isWaitingForLetter = Boolean(gameState.mailbox.pending);

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
            onError={() => setSceneImage(lastGoodImageRef.current)}
          />
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-stone-950" />
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
          <button onClick={() => void handleShareCard()} className="flex h-7 w-7 items-center justify-center text-amber-400/40 hover:text-amber-400 text-sm" title="生成分享卡片">
            🕊️
          </button>
          <button
            onClick={() => setShowLetterBox(true)}
            className={`flex h-7 w-7 items-center justify-center text-sm hover:text-amber-400 ${
              shouldGlowLetterBox
                ? 'text-amber-300/90 mailbox-soft-glow'
                : isWaitingForLetter
                  ? 'text-amber-400/55 animate-pulse'
                  : 'text-amber-400/40'
            }`}
            title={shouldGlowLetterBox ? '新信到了' : isWaitingForLetter ? '等待林深回信' : '信匣'}
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
            onClick={() => void openLetter()}
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
        const currentOptions = (!isStreaming && lastMsg?.role === 'assistant' && lastMsg.options) ? lastMsg.options.map(normalizeOptionLabel) : [];
        if (showMailbox || currentOptions.length === 0) return null;
        return (
          <div className="px-5 pb-2 flex flex-col gap-2 flex-none z-10">
            {currentOptions.map((option, i) => (
              <button
                key={i}
                onClick={() => handleOptionClick(option)}
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
        <LetterModal content={letterContent} isLoading={letterLoading} onClose={handleLetterClose} onReply={handleReply} canReply={true} image={activeLetterImage} />
      )}
      {showLetterBox && (
        <LetterBox
          letters={gameState.letterHistory}
          pending={gameState.mailbox.pending}
          onClose={() => setShowLetterBox(false)}
          onOpenLetter={(id) => {
            setShowLetterBox(false);
            void openLetter(id);
          }}
        />
      )}

      {shareImageUrl && (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" onClick={() => setShareImageUrl('')}>
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
          <div className="relative z-10 mx-4 mb-4 flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-xl border border-amber-700/25 bg-stone-950/90 shadow-2xl sm:mb-0" onClick={(e) => e.stopPropagation()}>
            <div className="flex-none border-b border-amber-900/15 px-5 pb-4 pt-5">
              <div className="flex items-start justify-between gap-4">
              <div>
                <div className="font-handwriting text-2xl text-amber-200/90">分享这段旅程</div>
                <div className="text-xs text-amber-500/40">长按图片保存，发给朋友</div>
              </div>
              <button onClick={() => setShareImageUrl('')} className="text-sm text-amber-500/45 hover:text-amber-300">
                关闭
              </button>
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={shareImageUrl} alt="分享卡片" className="mx-auto w-full rounded-xl border border-amber-900/20 shadow-2xl" />
            </div>
          </div>
        </div>
      )}
      {ending && (
        <EndingSequence
          title={ending.title}
          scenes={ending.scenes}
          onRestart={onExit}
          onShare={() => void handleShareCard(ending.scenes[0])}
        />
      )}
    </div>
  );
}
