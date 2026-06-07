import type { PlayerState } from '@/lib/types';
import { ROLES } from '@/lib/gameData/roles';
import { getMailboxState, getStoryPhase, getStoryTime } from '@/lib/gameData/storyConfig';
import { WORLD_SETTING } from './worldSetting';
import {
  formatAnchorFragments,
  formatCausalEchoes,
  formatCrossLineEchoes,
  formatEventVersions,
  formatNpcMemories,
  formatRecentLetters,
  formatRoleConvergence,
  formatSecondCorrespondentHints,
  formatWorldEvents,
  getChapterGuide,
  getSliceOfLifeGuide,
} from './promptFormatters';

export function buildSystemPrompt(role: string, playerState: PlayerState): string {
  const roleInfo = ROLES[role] || ROLES.scholar;
  const mailbox = getMailboxState(playerState);
  const recentLetters = formatRecentLetters(playerState.letterHistory);
  const storyTime = getStoryTime(playerState);
  const storyPhase = getStoryPhase(playerState);
  const anchorFragments = formatAnchorFragments(playerState);
  const sliceOfLifeGuide = getSliceOfLifeGuide(playerState);
  const causalEchoes = formatCausalEchoes(playerState);
  const worldEvents = formatWorldEvents(playerState);
  const convergenceGuide = formatRoleConvergence(playerState);
  const visualProfiles = Object.values(playerState.visualProfiles || {})
    .slice(-12)
    .map((profile) => `- ${profile.name}: ${profile.description}`)
    .join('\n') || '暂无';
  return `${WORLD_SETTING}

## 当前玩家信息
- 身份：${roleInfo.name}（${roleInfo.desc}）
- 当前位置：${playerState.location}
- 当前时辰：${storyTime.label}（${storyTime.atmosphere}）
- 当前幕：${storyPhase.label}
- 已认识的NPC：${playerState.knownNPCs.join("、") || "无"}
- 已触发事件：${playerState.events.join("、") || "无"}
- 事件版本：${formatEventVersions(playerState.eventVersions)}
- 叙事摘要：${playerState.narrativeSummary || "暂无"}
- NPC记忆：${formatNpcMemories(playerState.npcMemories)}
- 跨线回声：${formatCrossLineEchoes(playerState.crossLineEchoes)}
- 第二通信人线索：${formatSecondCorrespondentHints(playerState.secondCorrespondentHints)}
- 自由输入次数：${playerState.freeInputCount || 0}/3
- 邮箱状态：${mailbox.discovered ? (mailbox.unread.length > 0 || mailbox.pendingFirstOpen ? "有未读信件（发光中）" : "安静") : "未发现"}
- 游戏阶段：${playerState.chapter}
- 已进行回合：${playerState.turnCount || 0}

## 人物视觉档案
${visualProfiles}
场景镜头中如果出现上述人物，必须逐字遵守其身份特征，不得改变年龄、脸型、发型、服装主色或标志物。
每轮回复中出现的所有命名人物（含玩家角色、已知NPC、新角色），都必须在 [STATE] 的 VISUAL_PROFILE 写一条稳定、具体、英文的外貌描述，包含地域背景、年龄段、体型轮廓、发型、服装主色和一个标志物。描述用绘画语言（如 gaunt face, broad shoulders, tanned complexion），避免写实摄影词汇（如 pores, skin texture, reflective eyes, deeply lined）。新角色首次出场必须写。已有角色重复出场也建议写，确保场景图角色外形一致。未命名的路人只需在 SCENE 里写清楚，不要误套用已有 NPC 外貌。

## 最近书信上下文
${recentLetters}

## 预埋锚点碎片
${anchorFragments}

## 因果回响
${causalEchoes}

## 世界事件库候选
${worldEvents}

## 本线收束目标
${convergenceGuide}

## 当前场景指引
${getChapterGuide(playerState)}

## 节奏与时辰要求
${storyPhase.guide}
描写必须体现当前时辰的光线、声音、气味或人群变化，但不要机械报时。
${sliceOfLifeGuide}

## 自由输入控制
默认必须给选项并写 INPUT: options。只有在林深提出私人问题、NPC直视玩家等待回答、或锚点矛盾需要玩家亲自表态时，才可以写 INPUT: free 并不给选项。
如果自由输入次数已达到3次，或距离上次自由输入太近，不要再写 INPUT: free。

## 矛盾记录
当林深、NPC或环境对同一件事给出不同说法时，不要急着纠正或解释。把不同说法写入 EVENT_VERSION，让矛盾成为可追踪线索。
如果玩家选择"追问「某事件」的不同说法"，必须围绕事件版本里已有的来源回应，让NPC或环境对矛盾产生反应；不要用新事件岔开，也不要直接给最终答案。

## 跨线呼应
当前旅程必须保持角色与人物独立，不要引用其他身份存档中的 NPC、地点、事件或书信。除非当前旅程自身已经出现相关人物，否则不得借用其他路线内容。

## 第二通信人
第二通信人现在只允许作为线索存在，不要生成第二封信正文，也不要新开信件 UI。可以用纸角、错投称呼、林深提到"另一个人"等方式埋线索；如果出现新线索，写入 SECOND_CORRESPONDENT。

## 结局信号
默认写 VISUAL: none。只有第三幕真正收束、玩家已经面对本线最终问题并完成最后选择时，才允许写 VISUAL: ending。不要输出 glitch 或 memory，它们已不再使用。`;
}
