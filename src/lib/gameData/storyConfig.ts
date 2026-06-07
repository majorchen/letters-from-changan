import type { MailboxState, PlayerState, StoryPeriod, StoryPhase, StoryTime } from '@/lib/types';

export const STORY_PERIODS: StoryPeriod[] = ["清晨", "午后", "黄昏", "夜晚"];

export function getStoryTime(state: Partial<PlayerState>): StoryTime & { label: string; atmosphere: string } {
  const fallbackPeriod = STORY_PERIODS[((state.turnCount || 0) / 4 | 0) % STORY_PERIODS.length];
  const storyTime = state.storyTime || { day: 1, period: fallbackPeriod };
  const atmosphereMap: Record<StoryPeriod, string> = {
    清晨: "卸货声、蒸饼热气、坊门初开",
    午后: "日光发白、尘土浮起、人声疲热",
    黄昏: "收摊吆喝、灯笼渐亮、归人脚步",
    夜晚: "更鼓遥远、酒肆喧声、巷口灯影",
  };
  return {
    day: storyTime.day || 1,
    period: storyTime.period || fallbackPeriod,
    label: `第${storyTime.day || 1}日 ${storyTime.period || fallbackPeriod}`,
    atmosphere: atmosphereMap[storyTime.period || fallbackPeriod],
  };
}

export function getStoryPhase(state: Partial<PlayerState>): { phase: StoryPhase; label: string; guide: string } {
  const turn = state.turnCount || 0;
  const phase: StoryPhase = turn < 60 ? "act1" : turn < 180 ? "act2" : "act3";
  if (phase === "act1") {
    return {
      phase,
      label: "第一幕：抵达与建立",
      guide: "第一幕重点是建立长安日常、身份处境、林深信件的异常感。不要急着揭露真相，优先让玩家相信这个世界。",
    };
  }
  if (phase === "act2") {
    return {
      phase,
      label: "第二幕：牵连与矛盾",
      guide: "第二幕要让信件、NPC说法和玩家选择互相牵连。可以出现轻微矛盾和追问线索，但不要直接解释。",
    };
  }
  return {
    phase,
    label: "第三幕：收束与不安",
    guide: "第三幕要出现长安将变的前兆：边境军报、物价波动、有人离京。让玩家感到时间不多了，但不要明说历史结局。",
  };
}

export function advanceStoryTime(state: Partial<PlayerState>): StoryTime {
  const current = getStoryTime(state);
  const currentIndex = STORY_PERIODS.indexOf(current.period);
  const shouldAdvance = (state.turnCount || 0) > 0 && (state.turnCount || 0) % 4 === 0;
  if (!shouldAdvance) return { day: current.day, period: current.period };
  const nextIndex = (currentIndex + 1) % STORY_PERIODS.length;
  return {
    day: nextIndex === 0 ? current.day + 1 : current.day,
    period: STORY_PERIODS[nextIndex],
  };
}

export function getMailboxState(state: Partial<PlayerState>): MailboxState {
  return state.mailbox || {
    discovered: false,
    pendingFirstOpen: false,
    unread: [],
    lastGeneratedAtTurn: 0,
  };
}

export const INITIAL_STATE: Omit<PlayerState, 'role'> = {
  location: "长安城门外",
  chapter: "arrival",
  knownNPCs: [],
  events: [],
  narrativeSummary: "",
  npcMemories: {},
  eventVersions: {},
  secondCorrespondentHints: [],
  storyTime: {
    day: 1,
    period: "清晨",
  },
  storyPhase: "act1",
  awaitingFreeInput: false,
  freeInputCount: 0,
  lastFreeInputTurn: 0,
  mailbox: {
    discovered: false,
    pendingFirstOpen: false,
    unread: [],
    lastGeneratedAtTurn: 0,
  },
  letterHistory: [],
  visualProfiles: {},
  turnCount: 0,
  actionsToday: 0,
  lastPlayDate: new Date().toISOString().split('T')[0],
};
