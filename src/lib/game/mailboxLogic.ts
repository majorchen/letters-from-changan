import type { LetterEntry, PlayerState } from '@/lib/prompts';

export const NEW_LETTER_OPTION = '信匣里有一封新信';
const ACTIVE_LETTER_INTERVAL_TURNS = 12;

export function ensureMailboxOption(options: string[], state: PlayerState): string[] {
  const hasFreshNotice = state.mailbox?.unread?.some((notice) => !notice.noticeShown);
  if (!hasFreshNotice) return options.filter((option) => option !== NEW_LETTER_OPTION);
  return [NEW_LETTER_OPTION, ...options.filter((option) => option !== NEW_LETTER_OPTION)].slice(0, 4);
}

export function isMailboxOption(option: string, state: PlayerState): boolean {
  return option === NEW_LETTER_OPTION && getUnreadLetterCount(state) > 0;
}

export function hasDiscoveredMailbox(state: PlayerState): boolean {
  return Boolean(state.mailbox?.discovered);
}

export function getUnreadLetterCount(state: PlayerState): number {
  return state.mailbox?.unread?.length ?? 0;
}

export function findUnreadLetter(state: PlayerState): LetterEntry | undefined {
  const noticeIds = new Set((state.mailbox?.unread || []).map((notice) => notice.id));
  return [...(state.letterHistory || [])]
    .reverse()
    .find((letter) => letter.from === 'linShen' && (noticeIds.has(letter.id) || !letter.readAt));
}

export function shouldPrepareActiveLetter(state: PlayerState): boolean {
  if (!state.mailbox.discovered || state.mailbox.pending || state.mailbox.unread.length > 0) return false;
  const linLetters = state.letterHistory.filter((letter) => letter.from === 'linShen');
  if (linLetters.length === 0) return false;
  return state.turnCount - (state.mailbox.lastGeneratedAtTurn || 0) >= ACTIVE_LETTER_INTERVAL_TURNS;
}

export function shouldForceFirstMailbox(state: PlayerState, content: string): boolean {
  if (state.mailbox.discovered || state.letterHistory.some((letter) => letter.from === 'linShen')) return false;
  const context = `${state.location}\n${content}`;
  return /(客栈|客房|房间|投宿|安顿|住下|陶罐|陶器|邮箱|信匣|发光|金色光|信件|信笺)/.test(context);
}

export function isLetterRelatedOption(option: string): boolean {
  return /(信件|信笺|邮箱|信匣|查看信|读信|展开信|取出.*信|打开.*信|打开邮|展开.*笺)/.test(option);
}
