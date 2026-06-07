import { advanceStoryTime, getStoryPhase, PlayerState } from '../prompts';
import { normalizeEventVersions, normalizePlayerState } from '../normalize';
import type { NarrativeStateUpdate } from './types';

function shouldAcceptLocationUpdate(currentLocation: string, nextLocation: string, content: string, chapter: string): boolean {
  const normalizedNext = nextLocation.trim();
  if (!normalizedNext || normalizedNext.toLowerCase() === 'none') return false;
  const looksLikePromptLeak = /scene|image prompt|visual prompt|tang dynasty|composition/i.test(normalizedNext);
  if (looksLikePromptLeak) return false;

  const isStartLocation = /长安城门外|长安城门|朱雀门外/.test(normalizedNext);
  const contentMentionsGate = /城门|朱雀门|入城|出城|门洞|守门/.test(content);
  if (chapter !== 'arrival' && currentLocation !== normalizedNext && isStartLocation && !contentMentionsGate) {
    return false;
  }

  return true;
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
      };
      addEvent('发现邮箱');
    } else {
      updated.location = '王掌柜客栈';
      if (!updated.knownNPCs.includes('王掌柜')) {
        updated.knownNPCs = [...updated.knownNPCs, '王掌柜'];
      }
    }
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

  if (narrativeState?.location && shouldAcceptLocationUpdate(updated.location, narrativeState.location, content, updated.chapter)) {
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
  if (narrativeState?.visualProfiles) {
    updated.visualProfiles = {
      ...updated.visualProfiles,
      ...narrativeState.visualProfiles,
    };
  }
  if (narrativeState?.eventVersions) {
    updated.eventVersions = { ...updated.eventVersions };
    for (const [event, sources] of Object.entries(normalizeEventVersions(narrativeState.eventVersions))) {
      updated.eventVersions[event] = {
        ...(updated.eventVersions[event] || {}),
        ...sources,
      };
    }
    updated.eventVersions = normalizeEventVersions(updated.eventVersions);
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
    };
  } else if (narrativeState?.mailbox === 'unread') {
    updated.mailbox = {
      ...updated.mailbox,
      discovered: true,
    };
  } else if (narrativeState?.mailbox === 'quiet') {
    updated.mailbox = {
      ...updated.mailbox,
      discovered: true,
      pendingFirstOpen: false,
    };
  }
  return updated;
}
