import type { PlayerState } from '@/lib/types';

export function formatCausalEchoes(state: PlayerState): string {
  const latestPlayerLetter = [...(state.letterHistory || [])].reverse().find((letter) => letter.from === "player");
  const echoes: string[] = [];
  if (latestPlayerLetter) {
    echoes.push(`玩家最近回信大意：${latestPlayerLetter.content.replace(/\s+/g, " ").slice(0, 160)}。后续长安叙事应让这封信影响玩家的情绪、选择或NPC反应。`);
  }
  const recentEvents = (state.events || []).slice(-5);
  if (recentEvents.length > 0) {
    echoes.push(`最近长安事件：${recentEvents.join("、")}。如果林深或2077线索出现，应让这些事件产生微弱回响，而不是互不相干。`);
  }
  if (Object.keys(state.eventVersions || {}).length > 0) {
    echoes.push("已有矛盾版本时，优先让玩家能调查、核对或被NPC试探，不要把矛盾当作错误抹平。");
  }
  return echoes.length > 0 ? echoes.join("\n") : "暂无明确回响。";
}

export function formatCrossLineEchoes(echoes?: string[]): string {
  if (!echoes || echoes.length === 0) return "暂无";
  return echoes.slice(0, 4).join("\n");
}

export function formatSecondCorrespondentHints(hints: string[]): string {
  if (!hints || hints.length === 0) return "暂无";
  return hints.slice(-4).join("；");
}
