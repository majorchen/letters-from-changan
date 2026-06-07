import { normalizePlayerState } from '../normalize';
import { ROLES } from '../prompts';
import type { PlayerState } from '../prompts';
import type { ChatMessage, GameSave, SaveSummary } from './types';

const LEGACY_STORAGE_KEY = 'letters-from-changan-state';
const LEGACY_HISTORY_KEY = 'letters-from-changan-history';
const LEGACY_SAVES_KEY = 'letters-from-changan-saves-v1';
const STORAGE_KEY = 'letters-from-changan-state-v2';
const HISTORY_KEY = 'letters-from-changan-history-v2';
const SAVES_KEY = 'letters-from-changan-saves-v2';
const ACTIVE_SAVE_KEY = 'letters-from-changan-active-save-v2';
const STORAGE_WARNING_BYTES = 4 * 1024 * 1024;

export function makeId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `save-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function loadSaves(): GameSave[] {
  if (typeof window === 'undefined') return [];
  clearLegacyStorageOnce();
  const raw = localStorage.getItem(SAVES_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function compactSavesForStorage(saves: GameSave[]): GameSave[] {
  return saves.slice(0, 12).map((save) => ({
    ...save,
    messages: (save.messages || []).slice(-80).map((message) => ({
      ...message,
      content: message.content.slice(0, 3000),
    })),
    state: {
      ...save.state,
      events: (save.state.events || []).slice(-80),
      knownNPCs: (save.state.knownNPCs || []).slice(-40),
      letterHistory: (save.state.letterHistory || []).map((letter) => ({
        ...letter,
        content: letter.content.slice(0, 3000),
      })).slice(-80),
    },
  }));
}

export function saveSaves(saves: GameSave[]): void {
  if (typeof window === 'undefined') return;
  const serialized = JSON.stringify(saves);
  try {
    localStorage.setItem(SAVES_KEY, serialized.length > STORAGE_WARNING_BYTES ? JSON.stringify(compactSavesForStorage(saves)) : serialized);
  } catch (error) {
    console.warn('[storage] save quota exceeded, compacting saves', error);
    localStorage.setItem(SAVES_KEY, JSON.stringify(compactSavesForStorage(saves).slice(0, 5)));
  }
}

let legacyStorageCleared = false;

export function clearLegacyStorageNow(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(LEGACY_STORAGE_KEY);
  localStorage.removeItem(LEGACY_HISTORY_KEY);
  localStorage.removeItem(LEGACY_SAVES_KEY);
  localStorage.removeItem('letters-from-changan-active-save');
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(HISTORY_KEY);
}

export function clearLegacyStorageOnce(): void {
  if (legacyStorageCleared) return;
  clearLegacyStorageNow();
  legacyStorageCleared = true;
}

export function normalizeGameSave(save: GameSave): GameSave {
  return {
    ...save,
    state: normalizePlayerState(save.state),
    messages: Array.isArray(save.messages) ? save.messages : [],
    createdAt: save.createdAt || Date.now(),
    updatedAt: save.updatedAt || Date.now(),
  };
}

export function getActiveSaveId(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(ACTIVE_SAVE_KEY);
}

export function setActiveSaveId(id: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(ACTIVE_SAVE_KEY, id);
}

export function listSaveSummaries(): SaveSummary[] {
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
  return JSON.stringify({
    app: 'letters-from-changan',
    version: 1,
    exportedAt: Date.now(),
    saves: loadSaves(),
  }, null, 2);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function isValidChatMessage(value: unknown): value is ChatMessage {
  if (!isRecord(value)) return false;
  return (
    (value.role === 'user' || value.role === 'assistant' || value.role === 'system')
    && typeof value.content === 'string'
    && (typeof value.timestamp === 'number' || value.timestamp === undefined)
  );
}

function isValidPlayerStateInput(value: unknown): value is PlayerState {
  if (!isRecord(value)) return false;
  return (
    typeof value.role === 'string'
    && value.role in ROLES
    && typeof value.location === 'string'
    && typeof value.chapter === 'string'
    && isStringArray(value.knownNPCs)
    && isStringArray(value.events)
    && Array.isArray(value.letterHistory)
    && isRecord(value.mailbox)
  );
}

function isValidGameSaveInput(value: unknown): value is GameSave {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === 'string'
    && typeof value.role === 'string'
    && value.role in ROLES
    && isValidPlayerStateInput(value.state)
    && (value.messages === undefined || (Array.isArray(value.messages) && value.messages.every(isValidChatMessage)))
  );
}

export function importSaves(raw: string): number {
  const parsed = JSON.parse(raw) as { saves?: unknown };
  const incoming = Array.isArray(parsed.saves) ? parsed.saves : [];
  const validSaves = incoming
    .filter(isValidGameSaveInput)
    .map((save) => ({
      ...save,
      state: normalizePlayerState(save.state),
      messages: Array.isArray(save.messages) ? save.messages.map((message) => ({
        ...message,
        content: message.content.slice(0, 3000),
        timestamp: message.timestamp || Date.now(),
      })).slice(-120) : [],
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
    else clearActiveSaveId();
  }
}

export function clearActiveSaveId(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(ACTIVE_SAVE_KEY);
}

export function clearAllSaveStorage(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(ACTIVE_SAVE_KEY);
  localStorage.removeItem(SAVES_KEY);
}

export function getStorageUsage(): { bytes: number; warningBytes: number; isNearLimit: boolean } {
  if (typeof window === 'undefined') return { bytes: 0, warningBytes: STORAGE_WARNING_BYTES, isNearLimit: false };
  let bytes = 0;
  for (let index = 0; index < localStorage.length; index++) {
    const key = localStorage.key(index) || '';
    const value = localStorage.getItem(key) || '';
    bytes += key.length + value.length;
  }
  return { bytes, warningBytes: STORAGE_WARNING_BYTES, isNearLimit: bytes >= STORAGE_WARNING_BYTES };
}

export function isSaveStorageKey(key: string | null): boolean {
  return key === SAVES_KEY || key === ACTIVE_SAVE_KEY;
}
