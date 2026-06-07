export type StoryPeriod = "清晨" | "午后" | "黄昏" | "夜晚";
export type StoryPhase = "act1" | "act2" | "act3";

export interface StoryTime {
  day: number;
  period: StoryPeriod;
}

export interface NpcMemory {
  lastInteraction: string;
  attitude: string;
  knownFacts: string[];
}

export interface AnchorFragment {
  id: string;
  phase: StoryPhase;
  roles?: string[];
  trigger: string;
  clue: string;
  eventCode: string;
}

export interface WorldEvent {
  code: string;
  phase: StoryPhase;
  roles?: string[];
  scene: string;
  detail: string;
}

export interface PlayerState {
  role: string;
  location: string;
  chapter: string;
  knownNPCs: string[];
  events: string[];
  narrativeSummary: string;
  npcMemories: Record<string, NpcMemory>;
  eventVersions: Record<string, Record<string, string>>;
  crossLineEchoes?: string[];
  secondCorrespondentHints: string[];
  storyTime: StoryTime;
  storyPhase: StoryPhase;
  awaitingFreeInput: boolean;
  freeInputCount: number;
  lastFreeInputTurn: number;
  mailbox: MailboxState;
  letterHistory: LetterEntry[];
  visualProfiles: Record<string, VisualProfile>;
  turnCount: number;
  actionsToday: number;
  lastPlayDate: string;
}

export interface LetterNotification {
  id: string;
  from: string;
  createdAt: number;
  noticeShown?: boolean;
}

export interface LetterEntry {
  id: string;
  from: "linShen" | "player";
  content: string;
  timestamp: number;
  readAt?: number;
  noticeShown?: boolean;
}

export interface PendingLetter {
  id: string;
  content: string;
}

export interface VisualProfile {
  name: string;
  description: string;
  createdAt: number;
}

export interface MailboxState {
  discovered: boolean;
  pendingFirstOpen: boolean;
  unread: LetterNotification[];
  lastGeneratedAtTurn: number;
  pending?: PendingLetter;
}
