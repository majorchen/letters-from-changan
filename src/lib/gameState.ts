import { PlayerState, INITIAL_STATE } from './prompts';

const STORAGE_KEY = 'letters-from-changan-state';
const HISTORY_KEY = 'letters-from-changan-history';
const SCENE_CACHE_KEY = 'letters-from-changan-scenes';

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

export function loadGameState(): (PlayerState & { role: string }) | null {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function saveGameState(state: PlayerState): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function createNewGame(role: string): PlayerState {
  const state: PlayerState = { ...INITIAL_STATE, role, letterHistory: [], knownNPCs: [], events: [] };
  saveGameState(state);
  return state;
}

export function loadChatHistory(): ChatMessage[] {
  if (typeof window === 'undefined') return [];
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
  localStorage.setItem(HISTORY_KEY, JSON.stringify(messages));
}

export function clearGame(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(HISTORY_KEY);
}

export function updateChapter(state: PlayerState, content: string): PlayerState {
  const updated = { ...state };

  if (state.chapter === 'arrival' && (content.includes('客栈') || content.includes('安顿') || content.includes('住处'))) {
    if (content.includes('邮箱') || content.includes('陶器') || content.includes('发光')) {
      updated.chapter = 'mailbox_found';
      updated.hasMailbox = true;
      updated.events = [...updated.events, '发现邮箱'];
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

  const today = new Date().toISOString().split('T')[0];
  if (updated.lastPlayDate !== today) {
    updated.actionsToday = 0;
    updated.lastPlayDate = today;
  }
  updated.actionsToday++;

  return updated;
}
