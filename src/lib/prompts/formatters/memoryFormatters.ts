import type { PlayerState } from '@/lib/types';

export function formatRecentLetters(letterHistory: PlayerState["letterHistory"]): string {
  if (!letterHistory || letterHistory.length === 0) return "暂无。";
  return letterHistory
    .slice(-4)
    .map((letter) => {
      const sender = letter.from === "player" ? "玩家回信" : "林深来信";
      const content = letter.content.replace(/\s+/g, " ").slice(0, 220);
      return `- ${sender}：${content}`;
    })
    .join("\n");
}

export function formatNpcMemories(memories: PlayerState["npcMemories"]): string {
  const entries = Object.entries(memories || {}).slice(-8);
  if (entries.length === 0) return "暂无";
  return entries
    .map(([name, memory]) => {
      const facts = (memory.knownFacts || []).slice(-3).join("；") || "无";
      return `${name}（${memory.attitude || "中立"}）：${memory.lastInteraction || "暂无最近互动"}；记得：${facts}`;
    })
    .join("\n");
}

export function formatEventVersions(eventVersions: PlayerState["eventVersions"]): string {
  const entries = Object.entries(eventVersions || {}).slice(-8);
  if (entries.length === 0) return "暂无";
  return entries
    .map(([event, sources]) => {
      const sourceText = Object.entries(sources || {})
        .slice(-4)
        .map(([source, version]) => `${source}说：${version}`)
        .join("；");
      return `${event}：${sourceText}`;
    })
    .join("\n");
}
