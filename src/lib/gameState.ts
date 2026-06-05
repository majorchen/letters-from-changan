import { PlayerState, INITIAL_STATE, getMailboxState, advanceStoryTime, getStoryPhase, NpcMemory } from './prompts';

const LEGACY_STORAGE_KEY = 'letters-from-changan-state';
const LEGACY_HISTORY_KEY = 'letters-from-changan-history';
const LEGACY_SAVES_KEY = 'letters-from-changan-saves-v1';
const STORAGE_KEY = 'letters-from-changan-state-v2';
const HISTORY_KEY = 'letters-from-changan-history-v2';
const SCENE_CACHE_KEY = 'letters-from-changan-scenes';
const SAVES_KEY = 'letters-from-changan-saves-v2';
const ACTIVE_SAVE_KEY = 'letters-from-changan-active-save-v2';

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
  summary?: string;
  npcMemories?: Record<string, NpcMemory>;
  eventVersions?: Record<string, Record<string, string>>;
  secondCorrespondentHint?: string;
  visualCue?: 'none' | 'glitch' | 'memory';
  inputMode?: 'options' | 'free';
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

function clearLegacyStorage(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(LEGACY_STORAGE_KEY);
  localStorage.removeItem(LEGACY_HISTORY_KEY);
  localStorage.removeItem(LEGACY_SAVES_KEY);
  localStorage.removeItem('letters-from-changan-active-save');
}

function normalizePlayerState(state: PlayerState): PlayerState {
  const mailbox = getMailboxState(state);
  const storyPhase = state.storyPhase || getStoryPhase(state).phase;
  return {
    ...state,
    knownNPCs: Array.isArray(state.knownNPCs) ? state.knownNPCs : [],
    events: Array.isArray(state.events) ? state.events : [],
    narrativeSummary: typeof state.narrativeSummary === 'string' ? state.narrativeSummary : '',
    npcMemories: state.npcMemories && typeof state.npcMemories === 'object' ? state.npcMemories : {},
    eventVersions: state.eventVersions && typeof state.eventVersions === 'object' ? state.eventVersions : {},
    secondCorrespondentHints: Array.isArray(state.secondCorrespondentHints) ? state.secondCorrespondentHints : [],
    storyTime: state.storyTime || INITIAL_STATE.storyTime,
    storyPhase,
    awaitingFreeInput: Boolean(state.awaitingFreeInput),
    freeInputCount: state.freeInputCount || 0,
    lastFreeInputTurn: state.lastFreeInputTurn || 0,
    letterHistory: Array.isArray(state.letterHistory) ? state.letterHistory : [],
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

export function listSaveSummaries(): SaveSummary[] {
  clearLegacyStorage();
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

export function exportSaves(): string {
  clearLegacyStorage();
  return JSON.stringify({
    app: 'letters-from-changan',
    version: 1,
    exportedAt: Date.now(),
    saves: loadSaves(),
  }, null, 2);
}

export function importSaves(raw: string): number {
  const parsed = JSON.parse(raw) as { saves?: unknown };
  const incoming = Array.isArray(parsed.saves) ? parsed.saves : [];
  const validSaves = incoming
    .filter((item): item is GameSave => {
      if (!item || typeof item !== 'object') return false;
      const save = item as Partial<GameSave>;
      return typeof save.id === 'string' && typeof save.role === 'string' && Boolean(save.state);
    })
    .map((save) => ({
      ...save,
      state: normalizePlayerState(save.state),
      messages: Array.isArray(save.messages) ? save.messages : [],
      createdAt: save.createdAt || Date.now(),
      updatedAt: Date.now(),
    }));

  if (validSaves.length === 0) return 0;
  const existing = loadSaves();
  const existingIds = new Set(existing.map((save) => save.id));
  const merged = [
    ...validSaves.map((save) => existingIds.has(save.id) ? { ...save, id: makeId() } : save),
    ...existing,
  ];
  saveSaves(merged);
  if (!getActiveSaveId()) setActiveSaveId(merged[0].id);
  return validSaves.length;
}

export function getCrossLineEchoes(currentRole: string): string[] {
  if (typeof window === 'undefined') return [];
  return loadSaves()
    .filter((save) => save.role !== currentRole)
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, 3)
    .map((save) => {
      const state = normalizePlayerState(save.state);
      const recentEvents = state.events.slice(-3).join("、") || "暂无事件";
      const npcs = state.knownNPCs.slice(-3).join("、") || "无人";
      const letterCount = state.letterHistory.filter((letter) => letter.from === "linShen").length;
      return `${save.role}线曾到过${state.location}，牵连NPC：${npcs}；事件：${recentEvents}；林深来信${letterCount}封。`;
    });
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
  clearLegacyStorage();
  const activeId = getActiveSaveId();
  const saves = loadSaves();
  const save = saves.find((item) => item.id === activeId) || saves[0];
  if (save) {
    setActiveSaveId(save.id);
    return normalizePlayerState(save.state);
  }
  return null;
}

export function saveGameState(state: PlayerState): void {
  if (typeof window === 'undefined') return;
  const normalized = normalizePlayerState(state);
  clearLegacyStorage();
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
  clearLegacyStorage();
  const activeId = getActiveSaveId();
  const save = loadSaves().find((item) => item.id === activeId);
  if (save) return save.messages || [];
  return [];
}

export function saveChatHistory(messages: ChatMessage[]): void {
  if (typeof window === 'undefined') return;
  clearLegacyStorage();
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
  clearLegacyStorage();
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(HISTORY_KEY);
  localStorage.removeItem(ACTIVE_SAVE_KEY);
  localStorage.removeItem(SAVES_KEY);
}

export function updateChapter(state: PlayerState, content: string, narrativeState?: NarrativeStateUpdate): PlayerState {
  const nextTurnCount = (state.turnCount || 0) + 1;
  const updated = normalizePlayerState({ ...state, turnCount: nextTurnCount });
  if (state.awaitingFreeInput) {
    updated.awaitingFreeInput = false;
  }
  updated.storyTime = advanceStoryTime(updated);
  updated.storyPhase = getStoryPhase(updated).phase;
  const addEvent = (event: string) => {
    if (!updated.events.includes(event)) {
      updated.events = [...updated.events, event];
    }
  };

  if (!narrativeState && state.chapter === 'arrival' && (content.includes('客栈') || content.includes('安顿') || content.includes('住处'))) {
    if (content.includes('邮箱') || content.includes('陶器') || content.includes('发光')) {
      updated.chapter = 'mailbox_found';
      updated.mailbox = {
        ...updated.mailbox,
        discovered: true,
        pendingFirstOpen: true,
        unread: updated.mailbox.unread.length > 0 ? updated.mailbox.unread : [{ id: `letter-${Date.now()}`, from: 'linShen', createdAt: Date.now() }],
      };
      addEvent('发现邮箱');
    } else {
      updated.location = '王掌柜客栈';
      if (!updated.knownNPCs.includes('王掌柜')) {
        updated.knownNPCs = [...updated.knownNPCs, '王掌柜'];
      }
    }
  }

  if (!narrativeState && state.chapter === 'mailbox_found' && content.includes('信')) {
    updated.chapter = 'first_letter_read';
    updated.mailbox = {
      ...updated.mailbox,
      pendingFirstOpen: false,
      unread: [],
    };
  }

  if (!narrativeState?.npcs && content.includes('阿依')) {
    if (!updated.knownNPCs.includes('阿依')) {
      updated.knownNPCs = [...updated.knownNPCs, '阿依'];
    }
  }
  if (!narrativeState?.npcs && content.includes('李无名')) {
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
  const locationHint = !narrativeState?.location ? locationHints.find((hint) => content.includes(hint.keyword)) : undefined;
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
  if (narrativeState?.summary) {
    updated.narrativeSummary = narrativeState.summary.slice(0, 260);
  } else if (!updated.narrativeSummary && content.trim()) {
    updated.narrativeSummary = content.replace(/\s+/g, ' ').slice(0, 180);
  }
  if (narrativeState?.npcMemories) {
    updated.npcMemories = {
      ...updated.npcMemories,
      ...Object.fromEntries(
        Object.entries(narrativeState.npcMemories).map(([name, memory]) => {
          const previous = updated.npcMemories[name] || { lastInteraction: '', attitude: '中立', knownFacts: [] };
          return [name, {
            lastInteraction: memory.lastInteraction || previous.lastInteraction,
            attitude: memory.attitude || previous.attitude,
            knownFacts: Array.from(new Set([...(previous.knownFacts || []), ...(memory.knownFacts || [])])).slice(-8),
          }];
        }),
      ),
    };
  }
  if (narrativeState?.eventVersions) {
    updated.eventVersions = { ...updated.eventVersions };
    for (const [event, sources] of Object.entries(narrativeState.eventVersions)) {
      updated.eventVersions[event] = {
        ...(updated.eventVersions[event] || {}),
        ...sources,
      };
    }
  }
  if (narrativeState?.secondCorrespondentHint) {
    updated.secondCorrespondentHints = Array.from(new Set([
      ...(updated.secondCorrespondentHints || []),
      narrativeState.secondCorrespondentHint.slice(0, 160),
    ])).slice(-12);
  }
  if (narrativeState?.inputMode === 'free') {
    const farEnough = updated.turnCount - (updated.lastFreeInputTurn || 0) >= 12;
    if ((updated.freeInputCount || 0) < 3 && farEnough) {
      updated.awaitingFreeInput = true;
      updated.freeInputCount = (updated.freeInputCount || 0) + 1;
      updated.lastFreeInputTurn = updated.turnCount;
    }
  } else if (narrativeState?.inputMode === 'options') {
    updated.awaitingFreeInput = false;
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
  return updated;
}
