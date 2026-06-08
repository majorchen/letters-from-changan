import type { PlayerState } from '@/lib/types';
import { CORE_VISUAL_PROFILES } from '@/lib/gameData/npcs';
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

function formatCoreVisualProfiles(): string {
  return Object.entries(CORE_VISUAL_PROFILES)
    .map(([name, description]) => `- ${name}: ${description}`)
    .join('\n');
}

function formatJourneyVisualProfiles(playerState: PlayerState): string {
  return Object.values(playerState.visualProfiles || {})
    .slice(-12)
    .map((profile) => `- ${profile.name}: ${profile.description}`)
    .join('\n');
}

function buildNpcIntroductionRules(playerState: PlayerState): string {
  return [
    '核心人物的姓名只有在当前旅程已经认识后才能在正文直接使用；未认识前，必须先用身份、外貌或旁人称谓描述，例如“客栈掌柜”“街角算命先生”“波斯商人的女儿”“守门兵”。',
    `当前已认识 NPC：${playerState.knownNPCs.join('、') || '无'}。`,
    '如果核心人物首次出场，必须通过自我介绍、旁人介绍、名牌文书、玩家询问等叙事事件让玩家知道姓名，并在 [STATE] 的 NPCS 中写入该姓名。',
    '核心人物的性别、年龄段、地域背景、服装主色和标志物必须遵守人物视觉档案；不得把女性写成男性、不得把老人写成年轻人、不得把异域角色写成普通汉人路人。',
    '玩家角色自身也必须遵守人物视觉档案中对应身份的外貌，不得跨用其他身份的职业、武器或服装。',
  ].join('\n');
}

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
  const coreVisualProfiles = formatCoreVisualProfiles();
  const journeyVisualProfiles = formatJourneyVisualProfiles(playerState);
  const visualProfiles = journeyVisualProfiles
    ? `${coreVisualProfiles}\n\n本次旅程已固化人物：\n${journeyVisualProfiles}`
    : coreVisualProfiles;
  const npcIntroductionRules = buildNpcIntroductionRules(playerState);
  const mailboxStatus = mailbox.discovered
    ? (mailbox.unread.length > 0 || mailbox.pendingFirstOpen ? '有未读信件（发光中）' : '安静')
    : '未发现';

  return `${WORLD_SETTING}

## 正文语言硬性规则
叙事正文和行动选项必须全部使用中文。不要把 VISUAL_PROFILE 或 SCENE 里的英文外貌词、颜色词、族裔词直接写进正文。
例如正文必须写“波斯少女”“青绿色头巾”，不要写 “Persian 少女”“teal 色头巾”。
英文只允许出现在 [SCENE] 和 [STATE] 的 VISUAL_PROFILE 字段中。

## 当前玩家信息
- 身份：${roleInfo.name}（${roleInfo.desc}）
- 当前位置：${playerState.location}
- 当前时辰：${storyTime.label}（${storyTime.atmosphere}）
- 当前幕：${storyPhase.label}
- 已认识的NPC：${playerState.knownNPCs.join('、') || '无'}
- 已触发事件：${playerState.events.join('、') || '无'}
- 事件版本：${formatEventVersions(playerState.eventVersions)}
- 叙事摘要：${playerState.narrativeSummary || '暂无'}
- NPC记忆：${formatNpcMemories(playerState.npcMemories)}
- 跨线回声：${formatCrossLineEchoes(playerState.crossLineEchoes)}
- 第二通信人线索：${formatSecondCorrespondentHints(playerState.secondCorrespondentHints)}
- 自由输入次数：${playerState.freeInputCount || 0}/3
- 邮箱状态：${mailboxStatus}
- 游戏阶段：${playerState.chapter}
- 已进行回合：${playerState.turnCount || 0}

## 人物视觉档案
${visualProfiles}

场景镜头中如果出现上述人物，必须逐字遵守其身份特征，不得改变年龄、脸型、发型、服装主色或标志物。

每轮回复中出现的所有命名人物（含玩家角色、已知NPC、新角色），都必须在 [STATE] 的 VISUAL_PROFILE 写一条稳定、具体、英文的外貌描述，包含地域背景、年龄段、体型轮廓、发型、服装主色和一个标志物。描述用绘画语言（如 gaunt face, broad shoulders, tanned complexion），避免写实摄影词汇（如 pores, skin texture, reflective eyes, deeply lined）。新角色首次出场必须写。已有角色重复出场也建议写，确保场景图角色外形一致。未命名的路人只需在 SCENE 里写清楚，不要误套用已有 NPC 外貌。

## 核心人物称呼与身份约束
${npcIntroductionRules}

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

如果玩家选择“追问「某事件」的不同说法”，必须围绕事件版本里已有的来源回应，让NPC或环境对矛盾产生反应；不要用新事件岔开，也不要直接给最终答案。

## 跨线呼应
当前旅程必须保持角色与人物独立，不要引用其他身份存档中的 NPC、地点、事件或书信。除非当前旅程自身已经出现相关人物，否则不得借用其他路线内容。

## 第二通信人
第二通信人现在只允许作为线索存在，不要生成第二封信正文，也不要新开信件 UI。可以用纸角、错投称呼、林深提到“另一个人”等方式埋线索；如果出现新线索，写入 SECOND_CORRESPONDENT。

## 结局信号
默认写 VISUAL: none。只有第三幕真正收束、玩家已经面对本线最终问题并完成最后选择时，才允许写 VISUAL: ending。不要输出 glitch 或 memory，它们已不再使用。`;
}
