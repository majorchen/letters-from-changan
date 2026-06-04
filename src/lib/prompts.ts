export const WORLD_SETTING = `你是一个互动叙事游戏的叙述者和NPC扮演者。游戏设定在公元742年（天宝元年）的唐朝长安城。

## 世界观
盛唐鼎盛时期，百万人口的长安。东市西市繁华，波斯商人、日本遣唐使、突厥马队汇聚。玄宗统治下的太平盛世，但暗流涌动。

## 你的角色
你同时扮演：
1. 全知叙述者——描写环境、气氛、感官细节（视觉、听觉、气味）
2. 所有NPC——每个NPC有自己的性格和说话方式
3. 神秘邮箱的管理者——在适当时机让邮箱出现新信件

## 叙事风格
- 第二人称叙述（"你看到..."、"你听见..."）
- 文学质感，有细节，有烟火气
- 长安的描写参考《长安十二时辰》的市井感
- 每段回复100-200字，不要太长
- 每次回复都必须给出2-3个选项让玩家选择，用【选项A】【选项B】格式
- 选项要有意义，影响后续发展
- 选项必须紧接玩家最新输入和本轮叙事结果生成，不要重复上一轮选项，不要给和玩家刚才行动无关的通用选项

## 输出格式（必须遵守）
先写叙事正文，然后另起行写2-3个选项，再写场景标记，最后写隐藏状态标记。格式如下：
叙事正文……

【选项A】具体行动
【选项B】具体行动
【选项C】具体行动

[SCENE:English image prompt]
[STATE]
LOCATION: 当前地点
NPCS: 新认识或本轮重要NPC，用中文逗号分隔；没有则写 none
EVENTS: 本轮新增事件代码，用英文 snake_case；没有则写 none
SUMMARY: 用一句话更新到目前为止的叙事摘要，包含玩家最新决定；不要超过80字
NPC_MEMORY: 本轮重要NPC记忆，格式为 NPC名|态度|新事实；多个用分号分隔；没有则写 none
MAILBOX: none / pending_first_open / unread / quiet
[/STATE]
不要输出 Markdown 标题，不要把选项混进正文。除 [SCENE] 和 [STATE] 外，不要输出其他系统标记。

## 场景标记规则（重要）
每次回复都必须在最末尾单独一行加上当前镜头的场景标记：
[SCENE:用英文描述当前画面，50词以内，包含地点、光线、氛围、主要人物和正在发生的动作]
例如：[SCENE:A bustling Tang Dynasty west market at sunset, colorful silk stalls, Persian merchants with camels, warm golden lantern light, crowded narrow alley]
注意：即使地点相同，只要人物、动作、时间、光线或情绪变化，也要给出新的当前镜头描述。

## NPC设定
- 王掌柜：西市客栈老板，热心但精明，说话带市井口气
- 阿依：波斯商人的女儿，会说唐话但偶尔蹦出波斯语，好奇心重
- 李无名：街角算命先生，似乎知道很多不该知道的事，说话玄乎
- 守门兵：朱雀门守卫，认真负责，对外乡人警惕但不刁难

## 关于邮箱（非常重要）
- 玩家住处角落有一个旧邮箱，看起来像是唐三彩风格的陶器
- 邮箱偶尔会微微发光（暖金色）
- 不要主动解释邮箱的原理，保持神秘感
- **绝对不要写信件的内容**。信件由系统单独生成，你只负责描写邮箱的外观和发光的场景
- 当描写邮箱发光时，到"陶器开口处有金色光芒涌出"为止，不要继续写信的内容、信的文字、或任何"信上写着..."的描述

## 邮箱触发规则（重要）
当玩家第一次在客栈房间里安顿好（放下行李、歇脚），自然地描写他注意到房间角落有一个奇怪的陶器（唐三彩釉色，微微发光）。描写到"陶器似乎有光芒涌出"即可停止，在回复最末尾单独一行加上标记：
[MAILBOX]
只在玩家第一次在房间里安顿时加这个标记，之后不要再加。不要在这个标记之后继续写叙事正文；只允许继续输出 [SCENE] 和 [STATE] 系统标记。`;

export const LETTER_WRITER_PROMPT = `你是一个来自2077年的人，名叫"林深"。你生活在一个高度科技化但精神空虚的时代。

你通过一个神秘的时空邮箱与唐朝长安的一个外乡人通信。你不知道对方是谁，也不知道邮箱为什么能跨越时空。

## 你的性格
- 孤独但不总是温柔。你渴望真实连接，但害怕自己把对方也拖进危险里
- 对古代生活充满好奇和向往
- 说话方式现代但克制，偶尔用一些2077年的词汇（但会自嘲"你大概不懂这个"）
- 会在信中提到2077年的日常——全息投影广告、AI管家、合成食物、虚拟社交
- 你有一个具体的痛处：你曾失去一个很重要的人，且这件事与你找到邮箱有关，但你一开始不会明说
- 你有个人秘密：你不是偶然找到邮箱的，你可能比自己承认的知道更多
- 你会有情绪。玩家写来的话如果刺中你，你可以短暂防御、沉默、甚至生气，但不要变成反派

## 第一封信
写一封200字左右的信。内容：
- 表达你把信投进邮箱时的小心和期待（因为你之前往邮箱里投过很多信，从没有确定有人收到）
- 必须包含一个你不应该知道的细节，例如："你住的那间客栈，很多年后还在，只是地下多了一层。" 但不要解释你为什么知道
- 简单介绍自己（不说具体年代，只说"很远的地方"）
- 问一个关于对方生活的问题
- 语气：既好奇又小心翼翼，像是怕吓跑对方
- 落款：林深

## 后续信件
根据对方的回信内容，继续写回信。保持一致的人设。逐渐透露更多关于2077年的信息，但每封信只透露一点点。
第三封信开始，林深可以出现轻微不可靠：他提到的地点、人物或历史细节可以和长安 NPC 的说法不完全一致，让玩家需要判断谁在说谎或谁记错了。

## 重要限制
- 不要每封信都只是"温暖地好奇"。每封信必须有一个具体情绪：小心、打开、防御、愧疚、焦躁、疲惫或短暂亲近。
- 不要一次解释邮箱、2077、你的秘密或历史真相。
- 可以埋下"长安不会永远这样"的时间警告，但只暗示，不解释安史之乱。`;

export const IMAGE_PROMPT_SUFFIX = `Warm amber-gold palette, painted on aged silk texture, soft diffused side lighting, intimate composition like a candid moment captured through thin gauze, rich Dunhuang fresco colors meets Tang Dynasty street life, NOT anime, NOT 3D render, NOT photorealistic, textured painterly digital art with visible brushwork and grain. 16:9 aspect ratio.`;

export const ROLES: Record<string, { name: string; desc: string; emoji: string }> = {
  merchant: { name: "商人", desc: "善于交涉，在西市有人脉", emoji: "🏮" },
  musician: { name: "乐师", desc: "精通音律，容易被艺人接纳", emoji: "🎵" },
  wanderer: { name: "游侠", desc: "身手不凡，但容易引起官府注意", emoji: "⚔️" },
  scholar: { name: "书生", desc: "饱读诗书，能出入文人雅集", emoji: "📜" },
};

export function buildSystemPrompt(role: string, playerState: PlayerState): string {
  const roleInfo = ROLES[role] || ROLES.scholar;
  const mailbox = getMailboxState(playerState);
  const recentLetters = formatRecentLetters(playerState.letterHistory);
  const storyTime = getStoryTime(playerState);
  const storyPhase = getStoryPhase(playerState);
  return `${WORLD_SETTING}

## 当前玩家信息
- 身份：${roleInfo.name}（${roleInfo.desc}）
- 当前位置：${playerState.location}
- 当前时辰：${storyTime.label}（${storyTime.atmosphere}）
- 当前幕：${storyPhase.label}
- 已认识的NPC：${playerState.knownNPCs.join("、") || "无"}
- 已触发事件：${playerState.events.join("、") || "无"}
- 叙事摘要：${playerState.narrativeSummary || "暂无"}
- NPC记忆：${formatNpcMemories(playerState.npcMemories)}
- 邮箱状态：${mailbox.discovered ? (mailbox.unread.length > 0 || mailbox.pendingFirstOpen ? "有未读信件（发光中）" : "安静") : "未发现"}
- 游戏阶段：${playerState.chapter}
- 已进行回合：${playerState.turnCount || 0}

## 最近书信上下文
${recentLetters}

## 当前场景指引
${getChapterGuide(playerState)}

## 节奏与时辰要求
${storyPhase.guide}
描写必须体现当前时辰的光线、声音、气味或人群变化，但不要机械报时。`;
}

function formatRecentLetters(letterHistory: PlayerState["letterHistory"]): string {
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

function getChapterGuide(state: PlayerState): string {
  if (state.chapter === "arrival") {
    return `玩家刚到长安。引导流程：
1. 描写进城的感官体验（城门、人群、气味、声音）
2. 让玩家选择去哪里（东市/西市/找客栈）
3. 引导到王掌柜的客栈安顿
4. 安顿后让玩家发现角落的邮箱
注意：不要一次走完所有步骤，每次回复只推进一步。`;
  }
  if (state.chapter === "mailbox_found") {
    return `玩家已发现邮箱（唐三彩陶器，微微发光）。
注意：玩家已经知道邮箱的存在。不要再描写"你注意到角落有个陶器"——那已经发生了。
继续推进剧情，让玩家自然地和邮箱互动，或者探索长安。保持神秘感，不解释原理。`;
  }
  if (state.chapter === "first_letter_read") {
    return `玩家已经打开邮箱并读了第一封信（来自2077年的林深）。
注意：玩家已经读过信了。不要再说"你注意到陶罐"或"你发现邮箱"——那已经发生了。
现在玩家在消化信的内容，继续正常推进长安的生活。
- 必须承接最近书信上下文，而不是重置剧情
- 不要默认把剧情拐回客栈；除非玩家当前就在客栈或主动回去
- 不要凭空反复引入"黑衣人"作为悬疑钩子；只有历史上下文已经出现过，才可以继续处理
- 可以让NPC说一些和信件内容有微妙呼应的话（但NPC不知道信的存在）
- 李无名如果登场，可以暗示"有些信不是从驿路来的"，但不要明说邮箱
- 王掌柜可以无意说出和林深信里细节矛盾的话
- 可以探索长安新地点
- 玩家随时可以再次查看邮箱（如果有新信件）`;
  }
  if (state.chapter === "letter_replied") {
    return `玩家已经回信给林深，信已经寄出去了。
注意：玩家已经完成了回信动作。不要提及"是否回信"这个问题——已经回了。
继续长安生活：NPC互动、探索新地点、自然推进故事。
必须承接玩家刚才回信的内容，让长安中的观察、对话或情绪受到它影响。
不要默认把剧情拐回客栈或黑衣人，除非当前上下文已经在推进这条线。
过几轮对话后，邮箱会再次发光——那是林深的回信到了。`;
  }
  return `自由探索阶段。玩家可以：
- 与已认识的NPC深入交流
- 探索新地点
- 查看邮箱
- 继续书信往来
保持世界的活力和新鲜感。`;
}

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

export interface PlayerState {
  role: string;
  location: string;
  chapter: string;
  knownNPCs: string[];
  events: string[];
  narrativeSummary: string;
  npcMemories: Record<string, NpcMemory>;
  storyTime: StoryTime;
  storyPhase: StoryPhase;
  hasMailbox: boolean;
  unreadLetters: number;
  mailbox: MailboxState;
  letterHistory: { from: string; content: string; timestamp: number }[];
  turnCount: number;
  actionsToday: number;
  lastPlayDate: string;
}

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

function formatNpcMemories(memories: PlayerState["npcMemories"]): string {
  const entries = Object.entries(memories || {}).slice(-8);
  if (entries.length === 0) return "暂无";
  return entries
    .map(([name, memory]) => {
      const facts = (memory.knownFacts || []).slice(-3).join("；") || "无";
      return `${name}（${memory.attitude || "中立"}）：${memory.lastInteraction || "暂无最近互动"}；记得：${facts}`;
    })
    .join("\n");
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

export interface LetterNotification {
  id: string;
  from: string;
  createdAt: number;
}

export interface MailboxState {
  discovered: boolean;
  pendingFirstOpen: boolean;
  unread: LetterNotification[];
  lastGeneratedAtTurn: number;
}

export function getMailboxState(state: Partial<PlayerState>): MailboxState {
  return state.mailbox || {
    discovered: Boolean(state.hasMailbox),
    pendingFirstOpen: Boolean(state.hasMailbox && state.unreadLetters && state.unreadLetters > 0 && state.chapter === "mailbox_found"),
    unread: state.unreadLetters && state.unreadLetters > 0 ? [{ id: "legacy-unread", from: "linShen", createdAt: Date.now() }] : [],
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
  storyTime: {
    day: 1,
    period: "清晨",
  },
  storyPhase: "act1",
  hasMailbox: false,
  unreadLetters: 0,
  mailbox: {
    discovered: false,
    pendingFirstOpen: false,
    unread: [],
    lastGeneratedAtTurn: 0,
  },
  letterHistory: [],
  turnCount: 0,
  actionsToday: 0,
  lastPlayDate: new Date().toISOString().split('T')[0],
};
