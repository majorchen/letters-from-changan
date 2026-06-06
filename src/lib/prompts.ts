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
- 【强制】每次回复必须包含 [OPTIONS_JSON] 标记，给出1-3个真正有区别的选项；如果只有一个自然行动，就只给一个，不要为了凑数补通用选项。没有 [OPTIONS_JSON] 的回复是无效的
- 选项要有意义，影响后续发展
- 选项必须紧接玩家最新输入和本轮叙事结果生成，不要重复上一轮选项，不要给和玩家刚才行动无关的通用选项
- 例外：每条线最多2-3次关键时刻可以不给选项，逼玩家自由输入。只有当你在 [STATE] 里写 INPUT: free 时才允许不给选项，并且正文最后必须自然写出等待玩家回应的句子。

## 输出格式（必须遵守）
先写叙事正文，然后另起行写结构化选项，再写场景标记，最后写隐藏状态标记。格式如下：
叙事正文……

[OPTIONS_JSON]["具体行动一","具体行动二","具体行动三"][/OPTIONS_JSON]

[SCENE:English image prompt]
[STATE]
LOCATION: 当前地点
NPCS: 新认识或本轮重要NPC，用中文逗号分隔；没有则写 none
EVENTS: 本轮新增事件代码，用英文 snake_case；没有则写 none
SUMMARY: 用一句话更新到目前为止的叙事摘要，包含玩家最新决定；不要超过80字
NPC_MEMORY: 本轮重要NPC记忆，格式为 NPC名|态度|新事实；多个用分号分隔；没有则写 none
VISUAL_PROFILE: 本轮出现的所有命名人物外貌（包括玩家角色和已知NPC），格式为 NPC名|英文外貌描述；多个用分号分隔；没有命名人物则写 none。【重要】新角色首次出场必须写；已有角色如果出现在本轮也建议重写以保持一致
EVENT_VERSION: 事件名|来源|这个来源的说法；多个用分号分隔；没有则写 none
SECOND_CORRESPONDENT: 第二通信人的新线索；没有则写 none
VISUAL: none / ending
INPUT: options / free
MAILBOX: none / pending_first_open / unread / quiet
[/STATE]
EVENT_VERSION 的事件名必须是玩家可读的中文短名，例如“账本价格异动”，不要写 anchor_ledger_price_drift 这类内部代码。
OPTIONS_JSON 必须是合法 JSON 字符串数组，只能包含1-3个中文行动选项。每项不超过28个汉字，必须引用本轮已经出现的人物、地点、物件、话语或冲突中的至少一个具体对象。不要写”继续观察””仔细查看””换个角度试探””打听消息”这类脱离上下文也能成立的通用选项，也不要重复最近六轮的行动。
【绝对规则】每次回复必须包含 [OPTIONS_JSON]，除非 [STATE] 中写了 INPUT: free。缺少 [OPTIONS_JSON] 会导致玩家无法操作，是严重错误。正文末尾不要以 * 号或省略号收尾暗示选项，必须用 [OPTIONS_JSON] 标记明确给出。
不要输出 Markdown 标题，不要把选项混进正文。除 [OPTIONS_JSON]、[SCENE] 和 [STATE] 外，不要输出其他系统标记。

## 场景标记规则（重要）
每次回复都必须在最末尾单独一行加上当前镜头的场景标记：
[SCENE:shot type(close-up/medium/wide/over-shoulder) + camera angle(low/eye-level/high/dutch) + each character's specific action, facial expression matching narrative mood, and gaze direction(looking at object/person/distance, NOT at camera) + spatial relationship between characters(who faces whom, distance, shared objects connecting them) + location + atmosphere. 60 words max, English]
例如：[SCENE:Over-shoulder medium shot from behind the innkeeper, low angle. A lean merchant leans forward with narrowed suspicious eyes pressing a finger on an open ledger. The innkeeper pulls back with arms crossed, jaw tight, avoiding eye contact. Wooden tea stall, warm amber atmosphere, blurred market crowd behind]
注意：即使地点相同，只要人物、动作、时间或情绪变化，也要给出新的当前镜头描述。人物不要看镜头，表情必须反映当前叙事情绪。
【画风约束】场景描述只写氛围和色调（如 warm amber atmosphere, cold grey-blue tones），不要写具体光影效果（如 casting long shadows, light streaming through, glow illuminating face, dust motes floating）。避免物理现象描述（如 visible breath, frost on surface, light rays）。保持绘画感，不要把画面推向摄影写实。

## NPC设定
- 王掌柜：西市客栈老板，热心但精明，说话带市井口气
- 阿依：波斯商人的女儿，会说唐话但偶尔蹦出波斯语，好奇心重
- 李无名：街角算命先生，似乎知道很多不该知道的事，说话玄乎
- 守门兵：朱雀门守卫，认真负责，对外乡人警惕但不刁难

## 关于邮箱（非常重要，必须严格遵守）
- 玩家住处角落有一个旧邮箱，看起来像是唐三彩风格的陶器
- 邮箱偶尔会微微发光（暖金色）
- 不要主动解释邮箱的原理，保持神秘感
- **绝对不要写信件的内容**。信件由系统单独生成，你只负责描写邮箱的外观和发光的场景
- **绝对不要描写"取出信件"、"打开信件"、"展开信笺"的动作**。信件的取出和阅读由系统 UI 完成，不是叙事的一部分
- 当描写邮箱发光时，到"陶器开口处有金色光芒涌出"为止，**立即停止**。不要继续写取信、拆信、读信的任何动作
- 不要给"展开信笺阅读"、"取出罐中信件"、"打开邮箱查看信件"这类选项。信件通过系统信匣按钮查看，不通过叙事选项
- 如果剧情需要出现来信，只能描写"邮箱发光/信到了/信匣里多了一封"，不能替林深写任何一句信文，不能概括信里写了什么
- 玩家只有点击信件 modal 后才会看到信件内容；叙事正文永远不要提前透露

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

export const IMAGE_STYLE_PREFIX = `Warm amber-gold palette, painted on aged silk texture, rich Dunhuang fresco colors, textured painterly digital art with visible brushwork and grain, NOT anime, NOT 3D render, NOT photorealistic. Cinematic film still, clear foreground-midground-background depth, characters captured mid-action with natural body language, facial expressions matching narrative mood (NOT default smiling), characters engaged with each other or environment (NOT looking at camera, NOT posing).`;

export const IMAGE_CONSTRAINT_SUFFIX = `Correct human anatomy, exactly two arms and two legs per person, natural hands with five fingers, no duplicated face, no duplicated person, no fused bodies, no extra limbs, no malformed hands or feet, no modern clothing, no modern objects, no written text, no subtitles, no logo, no watermark. 16:9 aspect ratio.`;

/** @deprecated Use IMAGE_STYLE_PREFIX + IMAGE_CONSTRAINT_SUFFIX instead */
export const IMAGE_PROMPT_SUFFIX = `${IMAGE_STYLE_PREFIX} ${IMAGE_CONSTRAINT_SUFFIX}`;

export const CORE_VISUAL_PROFILES: Record<string, string> = {
  merchant: 'A lean Chinese merchant in his early thirties, warm tan skin, narrow observant eyes, neat short moustache, dark hair in a practical topknot, muted rust-brown Tang robe, indigo sash, worn leather satchel.',
  musician: 'A young Chinese musician in their mid twenties, oval face, calm dark eyes, long black hair tied with a faded red ribbon, moss-green Tang robe, carrying an old wooden pipa.',
  wanderer: 'A weathered Chinese wanderer around thirty, angular face, small scar through the left eyebrow, black hair in a high knot, charcoal Tang travel robe, short saber with a worn lacquered sheath.',
  scholar: 'A slender Chinese scholar in his late twenties, pale warm complexion, straight brows, thoughtful dark eyes, black hair under a simple cloth headpiece, ivory Tang robe with an ink-blue outer layer.',
  王掌柜: 'A broad middle-aged Chinese innkeeper, round friendly face, short greying beard, lively eyes, dark ochre Tang robe, brown apron, wooden tally slips at his belt.',
  阿依: 'A young Persian woman with olive skin, large dark eyes, thick wavy black hair partly covered by a teal silk scarf, crimson and turquoise Tang-Persian dress, small silver earrings.',
  李无名: 'A thin elderly Chinese fortune teller, deeply lined face, long sparse white beard, one cloudy eye, faded grey Taoist robe, bamboo divination tube in hand.',
  守门兵: 'A sturdy young Chinese gate guard, square jaw, sun-browned skin, tied black hair, dark lamellar Tang armor, red cloth scarf, wooden tally at his waist.',
  林深: 'A slim Chinese man in his early thirties from 2077, pale tired face, short slightly untidy black hair, dark reflective eyes, plain graphite-grey future jacket with subtle worn seams.',
};

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
每轮回复中出现的所有命名人物（含玩家角色、已知NPC、新角色），都必须在 [STATE] 的 VISUAL_PROFILE 写一条稳定、具体、英文的外貌描述，包含族裔或地域、年龄、脸型、肤色、发型、服装主色和一个标志物。新角色首次出场必须写。已有角色重复出场也建议写，确保场景图角色外形一致。未命名的路人只需在 SCENE 里写清楚，不要误套用已有 NPC 外貌。

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

function getSliceOfLifeGuide(state: PlayerState): string {
  const turn = state.turnCount || 0;
  const phase = getStoryPhase(state).phase;
  if (phase === "act3") {
    return "第三幕必须让日常里渗出不安：边境军报、物价波动、有人低声谈范阳、有人提前离京。不要直接解释安史之乱，只让玩家感到长安的灯火并不稳。";
  }
  if (turn > 0 && turn % 9 === 0) {
    return "本轮优先写一个低推进度的日常沉浸场景：坐下吃饭、看人来人往、听王掌柜骂伙计、听远处乐声。可以不给大事件，只让长安像真正生活着。";
  }
  return "在推进剧情时保留日常背景：NPC有自己的生计、疲惫、闲话和小动作，不要让所有人都围着玩家转。";
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

interface RoleConvergence {
  fragment: string;
  ahaMoment: string;
  finalQuestion: string;
}

const ANCHOR_FRAGMENTS: AnchorFragment[] = [
  {
    id: "inn_basement_future",
    phase: "act1",
    trigger: "玩家读过林深第一封信，或再次提到客栈",
    clue: "王掌柜随口说客栈下面只有压酒瓮的土窖，去年还塌过一角；这和林深说的'地下多了一层'不完全一致。",
    eventCode: "anchor_inn_basement_future",
  },
  {
    id: "letter_without_postroad",
    phase: "act1",
    trigger: "李无名第一次或第二次登场",
    clue: "李无名看一眼玩家袖口，低声说：有些信不是从驿路来的，拆开前要先问自己愿不愿意被看见。",
    eventCode: "anchor_letter_without_postroad",
  },
  {
    id: "missing_ward_map",
    phase: "act1",
    trigger: "玩家问路、看坊图或经过坊门",
    clue: "坊图上有一小块被新墨盖住，旁边老吏说这坊名从来没改过，但墨下隐约不是同一个字。",
    eventCode: "anchor_missing_ward_map",
  },
  {
    id: "persian_song_future_echo",
    phase: "act1",
    roles: ["musician", "wanderer"],
    trigger: "阿依或酒肆乐声出现",
    clue: "阿依哼出一小段旋律，说是母亲教的；旋律却像林深信里提过的2077广告铃声。",
    eventCode: "anchor_persian_song_future_echo",
  },
  {
    id: "ledger_price_drift",
    phase: "act1",
    roles: ["merchant", "scholar"],
    trigger: "玩家接触账本、货价或西市交易",
    clue: "同一批胡椒在两本账上价格差了三倍，王掌柜说是边地消息闹的，随即又把话咽回去。",
    eventCode: "anchor_ledger_price_drift",
  },
  {
    id: "guard_knows_name",
    phase: "act1",
    trigger: "玩家再次经过城门或被守卫盘问",
    clue: "守门兵叫出了玩家没有报过的姓氏，随后又像自己也困惑，改口说认错人。",
    eventCode: "anchor_guard_knows_name",
  },
  {
    id: "ceramic_warm_after_letter",
    phase: "act1",
    trigger: "玩家读信后靠近或忽视邮箱",
    clue: "唐三彩陶器没有发光，却像刚被人从袖中捂热，釉面里有一瞬映出不是长安的白色灯管。",
    eventCode: "anchor_ceramic_warm_after_letter",
  },
  {
    id: "linshen_wrong_tree",
    phase: "act2",
    trigger: "林深提到客栈外景，或玩家调查客栈外",
    clue: "林深说客栈对面有一棵枣树；王掌柜却说那里三年前就是面摊，从未种树。",
    eventCode: "anchor_linshen_wrong_tree",
  },
  {
    id: "future_food_smell",
    phase: "act2",
    trigger: "玩家吃饭、闻到食物或进入酒肆",
    clue: "热汤里有一瞬出现近似合成食物的金属甜味，只有玩家注意到，旁人都说只是胡椒放多了。",
    eventCode: "anchor_future_food_smell",
  },
  {
    id: "ai_scribe_copy",
    phase: "act2",
    roles: ["scholar"],
    trigger: "玩家接触书坊、抄书人或策论",
    clue: "一个抄书童写出的字和玩家怀中策论某一页完全相同，连墨污位置都一致。",
    eventCode: "anchor_ai_scribe_copy",
  },
  {
    id: "blade_notch_memory",
    phase: "act2",
    roles: ["wanderer"],
    trigger: "玩家拔刀、遇到争执或检查兵器",
    clue: "短刀上新出现一道缺口，像刚格开过什么；玩家却不记得这一击发生过。",
    eventCode: "anchor_blade_notch_memory",
  },
  {
    id: "market_fire_not_yet",
    phase: "act2",
    trigger: "西市傍晚、人群骚动或火光出现",
    clue: "有人喊西市失火，但赶到时只有湿灰；一个孩童说火是'明天烧的'。",
    eventCode: "anchor_market_fire_not_yet",
  },
  {
    id: "border_report_whisper",
    phase: "act3",
    trigger: "官差、驿卒、军报或第三幕任意街景",
    clue: "驿卒怀里的军报只露出'范阳'二字，酒客立刻压低声音，不肯再谈。",
    eventCode: "anchor_border_report_whisper",
  },
  {
    id: "leaving_changan_cart",
    phase: "act3",
    trigger: "玩家经过坊门、客栈门口或清晨街道",
    clue: "一户富人家天未亮就装车离京，仆人说只是探亲，箱笼却像再也不回。",
    eventCode: "anchor_leaving_changan_cart",
  },
  {
    id: "linshen_knows_end",
    phase: "act3",
    trigger: "林深来信或玩家追问长安未来",
    clue: "林深写到'别太习惯长安现在的声音'，又把后半句划掉，纸面上有反复停笔的痕迹。",
    eventCode: "anchor_linshen_knows_end",
  },
  {
    id: "second_correspondent_shadow",
    phase: "act3",
    trigger: "玩家已有多封通信后查看信匣或回信",
    clue: "信匣底部夹着一小片不属于玩家的纸角，只写着'那位书生也收到了吗'。",
    eventCode: "anchor_second_correspondent_shadow",
  },
];

const WORLD_EVENTS: WorldEvent[] = [
  { code: "world_west_market_tax", phase: "act1", roles: ["merchant"], scene: "西市税吏查账", detail: "税吏临时加查胡商货单，商人们嘴上抱怨，手里却都备着第二本账。" },
  { code: "world_exam_notice", phase: "act1", roles: ["scholar"], scene: "书坊贴出新榜文", detail: "榜文说今年取士仍重诗赋，旁边有人低声说真正要紧的是谁替你递话。" },
  { code: "world_pipa_invitation", phase: "act1", roles: ["musician"], scene: "酒肆邀乐", detail: "一个管事听见琵琶声，邀玩家夜里去平康坊试曲，却不肯说主人是谁。" },
  { code: "world_street_duel_warning", phase: "act1", roles: ["wanderer"], scene: "街角冲突", detail: "两个少年为一柄旧刀争执，旁人围看，守卒却像早知道会发生一样提前赶来。" },
  { code: "world_ward_gate_closing", phase: "act1", scene: "坊门提前落锁", detail: "坊门比平日早落了半刻，老门卒说是上头吩咐，问是谁吩咐却只摇头。" },
  { code: "world_missing_child_rumor", phase: "act1", scene: "茶摊闲话", detail: "茶摊上有人说隔壁坊一个孩子走丢，另一个人立刻打断，说那孩子明明昨天还在。" },
  { code: "world_silk_price_jump", phase: "act2", roles: ["merchant"], scene: "丝价骤涨", detail: "同一匹绢半日内涨了两成，货主说边地军需吃紧，随后又说自己只是猜的。" },
  { code: "world_poem_duplicate", phase: "act2", roles: ["scholar"], scene: "诗会重句", detail: "诗会上两个素不相识的人写出同一句下联，连停顿处都一样。" },
  { code: "world_song_memory_gap", phase: "act2", roles: ["musician"], scene: "曲谱缺页", detail: "曲谱中间少了一页，乐工却都能照着空白处继续弹，仿佛缺的只是纸。" },
  { code: "world_knife_shop_refusal", phase: "act2", roles: ["wanderer"], scene: "刀铺拒修", detail: "刀匠看见玩家兵器上的缺口，脸色一变，说这种痕不是唐刀留下的。" },
  { code: "world_letter_paper_trade", phase: "act2", scene: "纸铺异纸", detail: "纸铺掌柜拿出一种过分洁白的纸，称是旧库底货；纸面却不吸墨。" },
  { code: "world_night_drum_skip", phase: "act2", scene: "更鼓漏响", detail: "夜里更鼓少敲了一下，整条街的人都没反应，只有玩家觉得时间像缺了一块。" },
  { code: "world_border_goods_shortage", phase: "act3", roles: ["merchant"], scene: "边货断供", detail: "西市几家铺子同时缺边地皮货，掌柜们统一说是路远，却都在收金银细软。" },
  { code: "world_failed_memorial", phase: "act3", roles: ["scholar"], scene: "奏疏被退", detail: "一个老儒的奏疏被原封退回，封皮上只批了四字：不合时宜。" },
  { code: "world_broken_performance", phase: "act3", roles: ["musician"], scene: "宴乐中断", detail: "席间乐声忽然中断，主人说弦断不吉，要众人忘了刚才那支曲子。" },
  { code: "world_hidden_wanted_list", phase: "act3", roles: ["wanderer"], scene: "暗榜换名", detail: "坊墙上的缉捕暗榜被人半夜换过，墨迹未干，榜上一角像是玩家的背影。" },
  { code: "world_fanyang_whisper", phase: "act3", scene: "范阳耳语", detail: "酒客听见'范阳'二字便收声，王掌柜把酒壶放重了些，说小店不谈远处的事。" },
  { code: "world_departure_queue", phase: "act3", scene: "离京车队", detail: "清晨有车队往城外去，主人说是省亲，仆人却把祖宗牌位也抱上了车。" },
  { code: "world_grain_measure_change", phase: "act3", scene: "米斗变浅", detail: "米铺的斗看起来没变，装出来却少了一把，伙计说这些日子大家都这么卖。" },
  { code: "world_silent_post_station", phase: "act3", scene: "驿站沉默", detail: "驿站门口拴着汗透的马，驿卒们谁也不说话，只把军报一层层往里递。" },
];

const ROLE_CONVERGENCE: Record<string, RoleConvergence> = {
  merchant: {
    fragment: "2077 的经济并不是单纯贫穷，而是信用、供应链和自动化配给同时崩塌；林深习惯用价格、债务、旧市场遗址来理解世界。",
    ahaMoment: "玩家发现长安账本里的异常价格不是普通生意问题，而是未来供应链崩塌在过去留下的回声。",
    finalQuestion: "如果每一次交易都会在未来变成债务，玩家还愿不愿意相信一纸契约？",
  },
  scholar: {
    fragment: "2077 的文化断层来自模型重写与摘要替代原文；很多典籍只剩被加工过的版本，林深分不清原文和重构文本。",
    ahaMoment: "玩家意识到自己怀里的策论、书坊抄本和林深记忆里的版本互相污染，文字本身已经成为时空裂缝。",
    finalQuestion: "如果记下来的文字都会被改写，玩家要把真相交给纸、交给人，还是交给记忆？",
  },
  wanderer: {
    fragment: "2077 并不和平，城市安全由算法、身份识别和私人武装共同维持；林深害怕被追踪不是幻想。",
    ahaMoment: "玩家发现自己刀上的缺口、暗榜和未来监控叙述指向同一件事：有人跨时代标记了他。",
    finalQuestion: "当被追踪的人可能也是追踪者，玩家该保护谁，又该怀疑谁？",
  },
  musician: {
    fragment: "2077 的创作被自动生成淹没，真人演奏变成稀有甚至危险的怀旧行为；林深怀念的不是音乐，而是有人真的在场。",
    ahaMoment: "玩家听出阿依旋律、自己的琵琶声和林深描述的未来广告铃声其实是同一个动机的三种版本。",
    finalQuestion: "如果未来只剩完美复制的声音，玩家此刻弹错的一个音还算不算更真实？",
  },
};

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

function formatEventVersions(eventVersions: PlayerState["eventVersions"]): string {
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

function formatCausalEchoes(state: PlayerState): string {
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

function formatCrossLineEchoes(echoes?: string[]): string {
  if (!echoes || echoes.length === 0) return "暂无";
  return echoes.slice(0, 4).join("\n");
}

function formatSecondCorrespondentHints(hints: string[]): string {
  if (!hints || hints.length === 0) return "暂无";
  return hints.slice(-4).join("；");
}

function formatAnchorFragments(state: PlayerState): string {
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

function formatWorldEvents(state: PlayerState): string {
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

function formatRoleConvergence(state: PlayerState): string {
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
  noticeShown?: boolean;
}

export interface LetterImage {
  key: string;
  status: "ready";
  prompt: string;
  url: string;
  createdAt: number;
  updatedAt: number;
}

/** @deprecated Use LetterImage instead */
export type LetterVideo = LetterImage;

export interface LetterEntry {
  id: string;
  from: "linShen" | "player";
  content: string;
  timestamp: number;
  readAt?: number;
  noticeShown?: boolean;
  image?: LetterImage;
  /** @deprecated Migrated to image */
  video?: LetterImage;
}

export interface PendingLetter {
  id: string;
  content: string;
  image?: LetterImage;
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
