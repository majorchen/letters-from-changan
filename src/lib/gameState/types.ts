import type { NpcMemory, PlayerState, VisualProfile } from '../prompts';

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
  visualProfiles?: Record<string, VisualProfile>;
  eventVersions?: Record<string, Record<string, string>>;
  secondCorrespondentHint?: string;
  visualCue?: 'none' | 'glitch' | 'memory' | 'ending';
  inputMode?: 'options' | 'free';
  mailbox?: 'none' | 'pending_first_open' | 'unread' | 'quiet';
}

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  hidden?: boolean;
  isLetter?: boolean;
  sceneImage?: string;
  options?: string[];
}
