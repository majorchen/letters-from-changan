import type { LetterEntry, PlayerState, VisualProfile } from './types';
import { CORE_VISUAL_PROFILES } from './gameData/npcs';
import { ROLES } from './gameData/roles';
import { getMailboxState, getStoryPhase, getStoryTime, INITIAL_STATE, STORY_PERIODS } from './gameData/storyConfig';

function ensureVisualProfiles(state: PlayerState): Record<string, VisualProfile> {
  const profiles = { ...(state.visualProfiles || {}) };
  const roleDescription = CORE_VISUAL_PROFILES[state.role];
  if (roleDescription && !profiles[state.role]) {
    profiles[state.role] = { name: '玩家', description: roleDescription, createdAt: Date.now() };
  }
  for (const name of state.knownNPCs || []) {
    if (!profiles[name] && CORE_VISUAL_PROFILES[name]) {
      profiles[name] = {
        name,
        description: CORE_VISUAL_PROFILES[name],
        createdAt: Date.now(),
      };
    }
  }
  return profiles;
}

function cleanStringArray(value: unknown, limit?: number): string[] {
  const items = Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
  return typeof limit === 'number' ? items.slice(0, limit) : items;
}

export function normalizeEventVersions(value: unknown): Record<string, Record<string, string>> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const result: Record<string, Record<string, string>> = {};
  for (const [rawEvent, rawSources] of Object.entries(value).slice(-12)) {
    if (!rawEvent || !rawSources || typeof rawSources !== 'object' || Array.isArray(rawSources)) continue;
    const event = rawEvent.slice(0, 80);
    const sources: Record<string, string> = {};
    for (const [rawSource, rawVersion] of Object.entries(rawSources).slice(-8)) {
      if (typeof rawVersion !== 'string' || !rawVersion.trim()) continue;
      sources[rawSource.slice(0, 40)] = rawVersion.replace(/\s+/g, ' ').slice(0, 180);
    }
    if (Object.keys(sources).length > 0) result[event] = sources;
  }
  return result;
}

export function normalizePlayerState(state: PlayerState): PlayerState {
  const mailbox = getMailboxState(state);
  const unreadIds = new Set((Array.isArray(mailbox.unread) ? mailbox.unread : []).map((notice) => notice.id));
  const storyPhase = state.storyPhase || getStoryPhase(state).phase;
  const letterHistory: LetterEntry[] = (Array.isArray(state.letterHistory) ? state.letterHistory : [])
    .filter((letter) => letter && typeof letter.content === 'string')
    .map((letter, index) => {
      const id = letter.id || `legacy-letter-${letter.timestamp || Date.now()}-${index}`;
      const from = letter.from === 'player' ? 'player' : 'linShen';
      return {
        ...letter,
        id,
        from,
        timestamp: letter.timestamp || Date.now(),
        readAt: from === 'player'
          ? (letter.readAt || letter.timestamp || Date.now())
          : (letter.readAt || (!unreadIds.has(id) ? letter.timestamp || Date.now() : undefined)),
      };
    });
  const normalizedUnread = (Array.isArray(mailbox.unread) ? mailbox.unread : [])
    .filter((notice, index, notices) => (
      notices.findIndex((item) => item.id === notice.id) === index
      && letterHistory.some((letter) => letter.id === notice.id && letter.from === 'linShen' && !letter.readAt)
    ));
  const normalized = {
    ...state,
    knownNPCs: Array.isArray(state.knownNPCs) ? state.knownNPCs : [],
    events: Array.isArray(state.events) ? state.events : [],
    narrativeSummary: typeof state.narrativeSummary === 'string' ? state.narrativeSummary : '',
    npcMemories: state.npcMemories && typeof state.npcMemories === 'object' ? state.npcMemories : {},
    eventVersions: normalizeEventVersions(state.eventVersions),
    crossLineEchoes: Array.isArray(state.crossLineEchoes) ? state.crossLineEchoes : [],
    secondCorrespondentHints: Array.isArray(state.secondCorrespondentHints) ? state.secondCorrespondentHints : [],
    storyTime: state.storyTime || INITIAL_STATE.storyTime,
    storyPhase,
    awaitingFreeInput: Boolean(state.awaitingFreeInput),
    freeInputCount: state.freeInputCount || 0,
    lastFreeInputTurn: state.lastFreeInputTurn || 0,
    letterHistory,
    mailbox: {
      ...mailbox,
      unread: normalizedUnread,
    },
    visualProfiles: state.visualProfiles && typeof state.visualProfiles === 'object' ? state.visualProfiles : {},
    turnCount: state.turnCount || 0,
    actionsToday: state.actionsToday || 0,
    lastPlayDate: state.lastPlayDate || new Date().toISOString().split('T')[0],
  };
  normalized.visualProfiles = ensureVisualProfiles(normalized);
  return normalized;
}

export function normalizePlayerStateForApi(value: unknown): PlayerState | null {
  if (!value || typeof value !== 'object') return null;
  const state = value as Partial<PlayerState>;
  if (!state.role || !(state.role in ROLES)) return null;

  const storyTime = getStoryTime(state);
  const apiState = {
    ...INITIAL_STATE,
    role: state.role,
    location: typeof state.location === 'string' ? state.location.slice(0, 80) : '长安城门外',
    chapter: typeof state.chapter === 'string' ? state.chapter.slice(0, 60) : 'arrival',
    knownNPCs: cleanStringArray(state.knownNPCs, 20),
    events: cleanStringArray(state.events, 40),
    narrativeSummary: typeof state.narrativeSummary === 'string' ? state.narrativeSummary.slice(0, 500) : '',
    npcMemories: state.npcMemories && typeof state.npcMemories === 'object' ? state.npcMemories : {},
    eventVersions: normalizeEventVersions(state.eventVersions),
    crossLineEchoes: cleanStringArray(state.crossLineEchoes, 4),
    secondCorrespondentHints: cleanStringArray(state.secondCorrespondentHints).slice(-8),
    storyTime: {
      day: Number.isFinite(state.storyTime?.day) ? Number(state.storyTime?.day) : storyTime.day,
      period: state.storyTime?.period && STORY_PERIODS.includes(state.storyTime.period) ? state.storyTime.period : storyTime.period,
    },
    storyPhase: state.storyPhase || getStoryPhase(state).phase,
    awaitingFreeInput: Boolean(state.awaitingFreeInput),
    freeInputCount: Number.isFinite(state.freeInputCount) ? Number(state.freeInputCount) : 0,
    lastFreeInputTurn: Number.isFinite(state.lastFreeInputTurn) ? Number(state.lastFreeInputTurn) : 0,
    mailbox: getMailboxState(state),
    letterHistory: Array.isArray(state.letterHistory) ? state.letterHistory.slice(-12) as PlayerState['letterHistory'] : [],
    visualProfiles: state.visualProfiles && typeof state.visualProfiles === 'object' ? state.visualProfiles : {},
    turnCount: Number.isFinite(state.turnCount) ? Number(state.turnCount) : 0,
    actionsToday: 0,
    lastPlayDate: typeof state.lastPlayDate === 'string' ? state.lastPlayDate : new Date().toISOString().split('T')[0],
  };

  return normalizePlayerState(apiState);
}
