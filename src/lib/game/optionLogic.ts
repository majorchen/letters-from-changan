import type { ChatMessage } from '@/lib/gameState';
import type { PlayerState } from '@/lib/prompts';

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

function uniquePush(items: string[], item: string) {
  const normalized = item.trim();
  if (!normalized || items.includes(normalized)) return;
  items.push(normalized);
}

function contextualFallbackOptions(state: PlayerState, content: string, playerInput = ''): string[] {
  const context = `${playerInput}\n${content}`;
  const options: string[] = [];
  const knownNpc = (state.knownNPCs || []).find((npc) => npc && context.includes(npc));
  const npcMatch = context.match(/(?:王掌柜|阿依|李无名|守门兵|驿卒|掌柜|书生|胡商|老门卒|乐师|军士)/);
  const npc = knownNpc || npcMatch?.[0];

  if (npc) {
    uniquePush(options, `追问${npc}刚才那句话的意思`);
    uniquePush(options, `观察${npc}的神色变化`);
  }
  if (/(陶罐|陶器|信匣|邮箱|金光|发光)/.test(context)) {
    uniquePush(options, '靠近那只发光的唐三彩陶器');
    uniquePush(options, '暂时不碰陶器，先记下异状');
  }
  if (/(军报|驿卒|范阳|边地|兵|守门)/.test(context)) {
    uniquePush(options, '压低声音打听军报来处');
    uniquePush(options, '避开人群跟上那名驿卒');
  }
  if (/(账本|价格|货|西市|铺子|掌柜|买卖)/.test(context)) {
    uniquePush(options, '拿出账本核对市价异动');
    uniquePush(options, '去西市找熟人打听行情');
  }
  if (/(琴|琵琶|乐声|曲子|酒肆|歌)/.test(context)) {
    uniquePush(options, '走近酒肆听清那段旋律');
    uniquePush(options, '询问乐声为何忽然停下');
  }
  if (/(书|诗|文书|坊图|奏疏|抄本)/.test(context)) {
    uniquePush(options, '借来看清那份文书');
    uniquePush(options, '追问文字里不合常理之处');
  }
  if (/(刀|暗榜|缉捕|跟踪|黑衣|巷)/.test(context)) {
    uniquePush(options, '按住刀柄留意身后动静');
    uniquePush(options, '绕进巷口试探是否有人跟随');
  }

  if (state.location) uniquePush(options, `在${state.location}再查一处细节`);
  uniquePush(options, '换个由头继续追问');
  return options.slice(0, 3);
}

export function fallbackOptions(state: PlayerState, content: string, messages: ChatMessage[], playerInput = ''): string[] {
  const contradictionOption = getContradictionOption(state);
  const context = `${playerInput}\n${content}`;
  
  if (state.chapter === 'arrival' && /(客栈|客房|房间|投宿|安顿|住下|王掌柜)/.test(context)) {
    return ['请王掌柜安排一间客房', '先把行李放进房里'];
  }

  const contextualOptions = contextualFallbackOptions(state, content, playerInput);
  if (contextualOptions.length > 0) {
    return withContradictionOption(contextualOptions, contradictionOption);
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

export function dedupeOptions(options: string[], messages: ChatMessage[], optionsSource: 'model' | 'fallback' | 'final' = 'model'): string[] {
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

export function getContradictionOption(state: PlayerState): string | null {
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

export function withContradictionOption(options: string[], contradictionOption: string | null): string[] {
  if (!contradictionOption || options.includes(contradictionOption)) return options;
  return [...options, contradictionOption].slice(0, 4);
}

export function normalizeOptionLabel(option: string): string {
  return option.replace(/「(anchor_[a-z0-9_]+)」/gi, (_, key: string) => `「${EVENT_LABELS[key] || key.replace(/^anchor_/, '').replace(/_/g, ' ')}」`);
}

export function contradictionAskedMarker(event: string): string {
  return `contradiction_asked:${event}`;
}

function hasAskedContradiction(state: PlayerState, event: string): boolean {
  return (state.events || []).includes(contradictionAskedMarker(event));
}

export function findContradictionEventByOption(state: PlayerState, option: string): string | null {
  const match = option.match(/追问「(.+?)」的不同说法/);
  if (!match) return null;
  const label = match[1].trim();
  for (const event of Object.keys(state.eventVersions || {})) {
    const eventLabel = EVENT_LABELS[event] || event.replace(/^anchor_/, '').replace(/_/g, ' ').trim();
    if (label === eventLabel || label === event) return event;
  }
  return null;
}
