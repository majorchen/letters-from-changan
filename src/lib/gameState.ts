import { PlayerState, INITIAL_STATE, getMailboxState } from './prompts';

const STORAGE_KEY = 'letters-from-changan-state';
const HISTORY_KEY = 'letters-from-changan-history';
const SCENE_CACHE_KEY = 'letters-from-changan-scenes';
const SAVES_KEY = 'letters-from-changan-saves-v1';
const ACTIVE_SAVE_KEY = 'letters-from-changan-active-save';

export interface GameSave {
  id: string;
  title: string;
  role: string;
  state: PlayerState;
  messages: ChatMessage[];
  createdAt: number;
  updatedAt: number;
}

export interface SaveSummary {
  id: string;
  title: string;
  role: string;
  location: string;
  chapter: string;
  letterCount: number;
  messageCount: number;
  updatedAt: number;
}

export interface NarrativeStateUpdate {
  location?: string;
  npcs?: string[];
  events?: string[];
  mailbox?: 'none' | 'pending_first_open' | 'unread' | 'quiet';
}

// Scene image cache: location key → image URL (persists across sessions)
export function loadSceneCache(): Record<string, string> {
  if (typeof window === 'undefined') return {};
  try {
    return JSON.parse(localStorage.getItem(SCENE_CACHE_KEY) || '{}');
  } catch {
    return {};
  }
}

export function saveSceneCache(cache: Record<string, string>): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(SCENE_CACHE_KEY, JSON.stringify(cache));
}

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  isLetter?: boolean;
  sceneImage?: string;
  options?: string[];
}

function makeId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `save-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function loadSaves(): GameSave[] {
  if (typeof window === 'undefined') return [];
  const raw = localStorage.getItem(SAVES_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveSaves(saves: GameSave[]): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(SAVES_KEY, JSON.stringify(saves));
}

function normalizePlayerState(state: PlayerState): PlayerState {
  const mailbox = getMailboxState(state);
  return {
    ...state,
    knownNPCs: Array.isArray(state.knownNPCs) ? state.knownNPCs : [],
    events: Array.isArray(state.events) ? state.events : [],
    letterHistory: Array.isArray(state.letterHistory) ? state.letterHistory : [],
    hasMailbox: mailbox.discovered,
    unreadLetters: mailbox.unread.length,
    mailbox,
    turnCount: state.turnCount || 0,
    actionsToday: state.actionsToday || 0,
    lastPlayDate: state.lastPlayDate || new Date().toISOString().split('T')[0],
  };
}

function getActiveSaveId(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(ACTIVE_SAVE_KEY);
}

function setActiveSaveId(id: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(ACTIVE_SAVE_KEY, id);
}

function migrateLegacySave(): void {
  if (typeof window === 'undefined') return;
  if (localStorage.getItem(SAVES_KEY)) return;

  const rawState = localStorage.getItem(STORAGE_KEY);
  if (!rawState) return;

  try {
    const state = normalizePlayerState(JSON.parse(rawState) as PlayerState);
    const rawHistory = localStorage.getItem(HISTORY_KEY);
    const messages = rawHistory ? JSON.parse(rawHistory) as ChatMessage[] : [];
    const now = Date.now();
    const save: GameSave = {
      id: makeId(),
      title: `${state.role || '旅人'}的长安`,
      role: state.role,
      state,
      messages: Array.isArray(messages) ? messages : [],
      createdAt: now,
      updatedAt: now,
    };
    saveSaves([save]);
    setActiveSaveId(save.id);
  } catch {
    // Ignore broken legacy saves.
  }
}

export function listSaveSummaries(): SaveSummary[] {
  migrateLegacySave();
  return loadSaves()
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .map((save) => ({
      id: save.id,
      title: save.title,
      role: save.role,
      location: save.state.location,
      chapter: save.state.chapter,
      letterCount: save.state.letterHistory?.length || 0,
      messageCount: save.messages.length,
      updatedAt: save.updatedAt,
    }));
}

export function activateSave(id: string): PlayerState | null {
  const save = loadSaves().find((item) => item.id === id);
  if (!save) return null;
  setActiveSaveId(id);
  return normalizePlayerState(save.state);
}

export function deleteSave(id: string): void {
  const saves = loadSaves().filter((save) => save.id !== id);
  saveSaves(saves);
  if (getActiveSaveId() === id) {
    if (saves[0]) setActiveSaveId(saves[0].id);
    else localStorage.removeItem(ACTIVE_SAVE_KEY);
  }
}

export function loadGameState(): (PlayerState & { role: string }) | null {
  if (typeof window === 'undefined') return null;
  migrateLegacySave();
  const activeId = getActiveSaveId();
  const saves = loadSaves();
  const save = saves.find((item) => item.id === activeId) || saves[0];
  if (save) {
    setActiveSaveId(save.id);
    return normalizePlayerState(save.state);
  }

  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    return normalizePlayerState(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function saveGameState(state: PlayerState): void {
  if (typeof window === 'undefined') return;
  const normalized = normalizePlayerState(state);
  migrateLegacySave();
  const saves = loadSaves();
  const activeId = getActiveSaveId();
  const index = saves.findIndex((save) => save.id === activeId);
  if (index >= 0) {
    saves[index] = {
      ...saves[index],
      role: normalized.role,
      state: normalized,
      updatedAt: Date.now(),
    };
    saveSaves(saves);
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
}

export function createNewGame(role: string): PlayerState {
  const state: PlayerState = normalizePlayerState({ ...INITIAL_STATE, role, letterHistory: [], knownNPCs: [], events: [] });
  const now = Date.now();
  const save: GameSave = {
    id: makeId(),
    title: `${role}的长安`,
    role,
    state,
    messages: [],
    createdAt: now,
    updatedAt: now,
  };
  const saves = loadSaves();
  saveSaves([save, ...saves]);
  setActiveSaveId(save.id);
  saveGameState(state);
  return state;
}

export function loadChatHistory(): ChatMessage[] {
  if (typeof window === 'undefined') return [];
  migrateLegacySave();
  const activeId = getActiveSaveId();
  const save = loadSaves().find((item) => item.id === activeId);
  if (save) return save.messages || [];

  const raw = localStorage.getItem(HISTORY_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export function saveChatHistory(messages: ChatMessage[]): void {
  if (typeof window === 'undefined') return;
  migrateLegacySave();
  const saves = loadSaves();
  const activeId = getActiveSaveId();
  const index = saves.findIndex((save) => save.id === activeId);
  if (index >= 0) {
    saves[index] = {
      ...saves[index],
      messages,
      updatedAt: Date.now(),
    };
    saveSaves(saves);
  }
  localStorage.setItem(HISTORY_KEY, JSON.stringify(messages));
}

export function clearGame(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(HISTORY_KEY);
  localStorage.removeItem(ACTIVE_SAVE_KEY);
}

export function updateChapter(state: PlayerState, content: string, narrativeState?: NarrativeStateUpdate): PlayerState {
  const updated = normalizePlayerState({ ...state, turnCount: (state.turnCount || 0) + 1 });
  const addEvent = (event: string) => {
    if (!updated.events.includes(event)) {
      updated.events = [...updated.events, event];
    }
  };

  if (state.chapter === 'arrival' && (content.includes('客栈') || content.includes('安顿') || content.includes('住处'))) {
    if (content.includes('邮箱') || content.includes('陶器') || content.includes('发光')) {
      updated.chapter = 'mailbox_found';
      updated.hasMailbox = true;
      updated.mailbox = {
        ...updated.mailbox,
        discovered: true,
        pendingFirstOpen: true,
        unread: updated.mailbox.unread.length > 0 ? updated.mailbox.unread : [{ id: `letter-${Date.now()}`, from: 'linShen', createdAt: Date.now() }],
      };
      updated.unreadLetters = updated.mailbox.unread.length;
      addEvent('发现邮箱');
    } else {
      updated.location = '王掌柜客栈';
      if (!updated.knownNPCs.includes('王掌柜')) {
        updated.knownNPCs = [...updated.knownNPCs, '王掌柜'];
      }
    }
  }

  if (state.chapter === 'mailbox_found' && content.includes('信')) {
    updated.chapter = 'first_letter_read';
    updated.unreadLetters = 0;
    updated.mailbox = {
      ...updated.mailbox,
      pendingFirstOpen: false,
      unread: [],
    };
  }

  if (content.includes('阿依')) {
    if (!updated.knownNPCs.includes('阿依')) {
      updated.knownNPCs = [...updated.knownNPCs, '阿依'];
    }
  }
  if (content.includes('李无名')) {
    if (!updated.knownNPCs.includes('李无名')) {
      updated.knownNPCs = [...updated.knownNPCs, '李无名'];
    }
  }

  const locationHints = [
    { keyword: '西市', location: '西市' },
    { keyword: '东市', location: '东市' },
    { keyword: '客栈', location: '王掌柜客栈' },
    { keyword: '酒肆', location: '酒肆' },
    { keyword: '朱雀大街', location: '朱雀大街' },
    { keyword: '城门', location: '长安城门' },
    { keyword: '道观', location: '道观' },
  ];
  const locationHint = locationHints.find((hint) => content.includes(hint.keyword));
  if (locationHint) {
    updated.location = locationHint.location;
  }

  if (narrativeState?.location && narrativeState.location !== 'none') {
    updated.location = narrativeState.location.slice(0, 80);
  }
  for (const npc of narrativeState?.npcs || []) {
    if (npc && npc !== 'none' && !updated.knownNPCs.includes(npc)) {
      updated.knownNPCs = [...updated.knownNPCs, npc.slice(0, 40)];
    }
  }
  for (const event of narrativeState?.events || []) {
    if (event && event !== 'none') addEvent(event.slice(0, 60));
  }
  if (narrativeState?.mailbox === 'pending_first_open') {
    updated.chapter = 'mailbox_found';
    updated.mailbox = {
      ...updated.mailbox,
      discovered: true,
      pendingFirstOpen: true,
      unread: updated.mailbox.unread.length > 0 ? updated.mailbox.unread : [{ id: `letter-${Date.now()}`, from: 'linShen', createdAt: Date.now() }],
    };
  } else if (narrativeState?.mailbox === 'unread') {
    updated.mailbox = {
      ...updated.mailbox,
      discovered: true,
      unread: updated.mailbox.unread.length > 0 ? updated.mailbox.unread : [{ id: `letter-${Date.now()}`, from: 'linShen', createdAt: Date.now() }],
      lastGeneratedAtTurn: updated.turnCount,
    };
  } else if (narrativeState?.mailbox === 'quiet') {
    updated.mailbox = {
      ...updated.mailbox,
      discovered: true,
      pendingFirstOpen: false,
      unread: [],
    };
  }
  updated.hasMailbox = updated.mailbox.discovered;
  updated.unreadLetters = updated.mailbox.unread.length;

  return updated;
}
