import type { PlayerState } from '@/lib/types';
import { ANCHOR_FRAGMENTS } from '@/lib/gameData/anchors';
import { ROLE_CONVERGENCE } from '@/lib/gameData/roles';
import { WORLD_EVENTS } from '@/lib/gameData/worldEvents';
import { getStoryPhase } from '@/lib/gameData/storyConfig';

export function formatAnchorFragments(state: PlayerState): string {
  const phase = getStoryPhase(state).phase;
  const seenEvents = new Set(state.events || []);
  const candidates = ANCHOR_FRAGMENTS
    .filter((anchor) => anchor.phase === phase)
    .filter((anchor) => !seenEvents.has(anchor.eventCode))
    .filter((anchor) => !anchor.roles || anchor.roles.includes(state.role))
    .slice(0, 4);

  if (candidates.length === 0) return "当前阶段暂无未触发锚点。";
  return candidates
    .map((anchor) => `- ${anchor.eventCode}：触发条件：${anchor.trigger}；线索：${anchor.clue}。如果本轮触发，必须把 ${anchor.eventCode} 写入 [STATE] EVENTS。`)
    .join("\n");
}

export function formatWorldEvents(state: PlayerState): string {
  const phase = getStoryPhase(state).phase;
  const seenEvents = new Set(state.events || []);
  const candidates = WORLD_EVENTS
    .filter((event) => event.phase === phase)
    .filter((event) => !seenEvents.has(event.code))
    .filter((event) => !event.roles || event.roles.includes(state.role))
    .slice(0, 4);

  if (candidates.length === 0) return "当前阶段暂无新的世界事件候选。";
  return candidates
    .map((event) => `- ${event.code}：${event.scene}。${event.detail} 如果本轮采用，必须把 ${event.code} 写入 [STATE] EVENTS。`)
    .join("\n");
}

export function formatRoleConvergence(state: PlayerState): string {
  const guide = ROLE_CONVERGENCE[state.role];
  if (!guide) return "暂无。";
  const phase = getStoryPhase(state).phase;
  const lines = [
    `本线 2077 碎片：${guide.fragment}`,
    `本线啊哈时刻：${guide.ahaMoment}`,
  ];
  if (phase === "act1") {
    lines.push("第一幕只允许埋日常异常，不要解释上述碎片。");
  } else if (phase === "act2") {
    lines.push("第二幕可以让玩家开始把两个以上线索联系起来，但仍不要给最终答案。");
  } else {
    lines.push(`第三幕要把本线问题推向选择：${guide.finalQuestion}`);
  }
  lines.push("如果本轮触发关键认知翻转，必须把一个清晰事件代码写入 [STATE] EVENTS。");
  return lines.join("\n");
}
