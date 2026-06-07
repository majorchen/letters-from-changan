import { INITIAL_STATE, PlayerState } from '../prompts';
import { normalizePlayerState } from '../normalize';
import type { ChatMessage, GameSave } from './types';
import { clearAllSaveStorage, clearLegacyStorageNow, getActiveSaveId, loadSaves, makeId, saveSaves, setActiveSaveId } from './saveStorage';

export function loadGameState(): (PlayerState & { role: string }) | null {
  if (typeof window === 'undefined') return null;
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
  const activeId = getActiveSaveId();
  const save = loadSaves().find((item) => item.id === activeId);
  if (save) return save.messages || [];
  return [];
}

const MAX_SCENE_IMAGES = 3;

function trimSceneImages(messages: ChatMessage[]): ChatMessage[] {
  let sceneCount = 0;
  const result = [...messages];
  for (let i = result.length - 1; i >= 0; i--) {
    if (result[i].sceneImage) {
      sceneCount++;
      if (sceneCount > MAX_SCENE_IMAGES) {
        result[i] = { ...result[i], sceneImage: undefined };
      }
    }
  }
  return result;
}

export function saveChatHistory(messages: ChatMessage[]): void {
  if (typeof window === 'undefined') return;
  const trimmed = trimSceneImages(messages);
  const saves = loadSaves();
  const activeId = getActiveSaveId();
  const index = saves.findIndex((save) => save.id === activeId);
  if (index >= 0) {
    saves[index] = {
      ...saves[index],
      messages: trimmed,
      updatedAt: Date.now(),
    };
    saveSaves(saves);
  }
}

export function clearGame(): void {
  if (typeof window === 'undefined') return;
  clearLegacyStorageNow();
  clearAllSaveStorage();
}
