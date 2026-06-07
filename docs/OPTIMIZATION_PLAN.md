# Letters from Chang'an - 优化计划

> 2026-06-06 创建 · 按 Phase 执行，每个 Task 独立可交付
> 最后更新：2026-06-08 02:40
> 状态标记：⬜ 待做 · 🔄 进行中 · ✅ 完成
>
> **进度概览：Phase 1-7 ✅ 全部完成 | 补充 Task ✅**

---

## 2026-06-07 当前校准

- `src/lib/prompts.ts` 已拆为 barrel re-export，原始内容按职责迁移到 `src/lib/types.ts`、`src/lib/prompts/*`、`src/lib/gameData/*`。验证：`npm run lint`、`npm run build` 均通过。
- `normalizePlayerState` 已提取到 `src/lib/normalize.ts`，`gameState.ts` 和 `/api/chat` 共用同一套状态规范化逻辑；API 侧保留角色校验和字段长度裁剪。
- `GameScreen.tsx` 拆分主体已完成：纯逻辑迁出到 `src/lib/game/*`，组件从 1384 行降到约 246 行；`ChatDisplay`、`OptionPanel`、`GameHeader`、`ShareModal`、`TypewriterOpening`、`useLetterFlow`、`useShareCard`、`useGameChat`、`useOpeningFlow` 已拆出，流式请求迁到 `src/lib/game/chatStream.ts`，开场文案/打字机逻辑迁到 `src/lib/game/openingFlow.ts` 和 `useOpeningFlow`。
- `gameState.ts` 已拆为 `src/lib/gameState/*`，原 `src/lib/gameState.ts` 保留为 barrel；`saveGameState` / `saveChatHistory` 已移除 `STORAGE_KEY` / `HISTORY_KEY` 双写，以 saves-v2 为唯一真实来源。
- `promptFormatters.ts` 已拆为 `src/lib/prompts/formatters/*`，原文件保留为兼容 re-export。
- 信件附件方案已经和早期 Phase 2 文档分叉：当前代码不是“视频改图片”，而是信件不再附带图片，`/api/letter` 只返回 `content`，前端直接完成来信投递。
- `package.json` 和 README 已清理不存在的 `smoke:*` / `audit` 脚本引用，当前验证命令以 `npm run lint`、`npm run build` 为准。
- README 中部分 docs 链接指向已不存在的历史计划文件，后续应并入 Phase 7 文档清理。

---

## Phase 1：体验热修复（30分钟）✅ 完成

立刻修复当前可感知的 bug，不涉及大改动。commit `edcc4b3`

### Task 1.1 ✅ 信件选项误触空信匣（EP-4）

**问题**：`isLetterRelatedOption()` 匹配到含"信"字的选项后，即使没有未读信也没有 pending，第三个分支会强制触发邮箱发现 → 打开空信匣。

**文件**：`src/components/GameScreen.tsx`

**改法**：`handleOptionClick()` 内 `isLetterRelatedOption` 分支，去掉第三个分支（强制触发邮箱发现）。该场景已被 `shouldForceFirstMailbox()` 在 AI 响应阶段覆盖，不需要在选项点击时重复触发。没有未读、没有 pending 时，当普通选项处理，继续正常对话流程。

```typescript
if (isLetterRelatedOption(option)) {
  const unreadLetter = findUnreadLetter(currentState);
  if (unreadLetter) { void openLetter(unreadLetter.id); return; }
  if (currentState.mailbox.pendingFirstOpen || currentState.mailbox.pending) {
    setShowLetterBox(true); return;
  }
  // 没有未读、没有 pending → 不拦截，当普通选项继续走正常对话
}
```

**验证**：新开一条线，到客栈后，出现含"信"字的普通选项时点击，应正常推进对话而非打开空信匣。

---

### Task 1.2 ✅ Fallback 选项改为单按钮"静观其变..."（EP-3）

**问题**：`fallbackOptions()` 用 npc/place/clue 变量填充模板选项，变量提取经常不准，导致和剧情无关的选项。

**文件**：`src/components/GameScreen.tsx`

**改法**：整个 `fallbackOptions()` 函数替换为：

```typescript
function fallbackOptions(state: PlayerState, content: string, playerInput = ''): string[] {
  const contradictionOption = getContradictionOption(state);
  const context = `${playerInput}\n${content}`;
  // arrival 阶段保留特定引导
  if (state.chapter === 'arrival' && /(客栈|客房|房间|投宿|安顿|住下|王掌柜)/.test(context)) {
    return ['请王掌柜安排一间客房', '先把行李放进房里'];
  }
  // 所有其他情况：单按钮
  return withContradictionOption(['静观其变...'], contradictionOption);
}
```

可同时删除 `findContextSubjects()` 函数（只有 fallbackOptions 在用）。

**验证**：触发 fallback 时（AI 未输出 OPTIONS_JSON），应只出现"静观其变..."按钮（+可能的矛盾追问选项）。

---

### Task 1.3 ✅ lint + build + push

完成 1.1 和 1.2 后，运行 `npm run lint && npm run build`，通过后 commit 并 push。

---

## Phase 2：信件附件从视频改为图片（1-2小时）✅ 完成

彻底消除视频生成导致的信件系统卡顿和触发失败。commit `1249d60`

### Task 2.1 ✅ letter API 改为返回图片 prompt

**文件**：`src/app/api/letter/route.ts`

**改法**：
- `buildVideoPrompt()` → `buildLetterImagePrompt()`
- 返回字段 `videoPrompt` → `imagePrompt`
- 图片 prompt 使用游戏同款风格，内容描述2077场景，格式：

**方案**：让 AI 在生成信件时同时输出镜头描述，而不是代码硬匹配关键词。与 Phase 3 场景图的 SCENE 标签同等要求。

**letter API prompt 追加指令**（在请求信件时附加）：
```
写完信件正文后，另起一行输出配图标记：
[LETTER_SCENE:shot type(close-up/medium/wide) + camera angle + Lin Shen's specific action and facial expression matching this letter's emotional tone + gaze direction(NOT looking at camera) + 2077 environment detail + lighting. 60 words max, English]
例如：[LETTER_SCENE:Close-up, low angle. Lin Shen sits on a rooftop edge at dusk, knees drawn up, chin resting on folded arms, eyes distant and glassy with unshed tears, gazing at a horizon of holographic billboards. Cold blue city glow below, warm orange sunset above, wind pulling at his collar]
```

**letter route 解析**（`src/app/api/letter/route.ts`）：
```typescript
// 从 AI 响应中提取信件内容和镜头描述
const sceneMatch = rawContent.match(/\[LETTER_SCENE:([^\]]+)\]/i);
const letterContent = rawContent.replace(/\[LETTER_SCENE:[^\]]+\]/i, '').trim();
const sceneDesc = sceneMatch?.[1]?.trim() || fallbackLetterScene(letterNumber);

// 拼接完整图片 prompt（风格前缀 + AI镜头 + 人物档案 + 约束后缀）
const imagePrompt = `${IMAGE_STYLE_PREFIX} ${sceneDesc}. Near-future Chinese city, restrained believable technology. Character continuity: 林深: A slim Chinese man in his early thirties from 2077, pale tired face, short slightly untidy black hair, dark reflective eyes, plain graphite-grey future jacket with subtle worn seams. ${IMAGE_CONSTRAINT_SUFFIX}`;

return Response.json({ content: letterContent, imagePrompt });
```

**fallback**（AI 未输出 LETTER_SCENE 时的兜底）：
```typescript
function fallbackLetterScene(letterNumber: number): string {
  const scenes = [
    'Medium shot, slightly high angle. Lin Shen sits alone at a translucent desk, one hand hovering over a glowing ceramic mailbox, head bowed, eyes soft with hesitation. Dim apartment, holographic city lights through rain-streaked window',
    'Wide shot, eye-level. Lin Shen stands by a floor-to-ceiling window, back half-turned, one palm pressed against the glass, watching neon reflections ripple in the rain below. Empty apartment behind him, single warm lamp',
    'Close-up, low angle. Lin Shen crouches beside the ceramic mailbox on a cluttered desk, fingers tracing its rim, brows furrowed with concentration, lips slightly parted. Soft golden glow from the mailbox illuminates his face from below',
  ];
  return scenes[(letterNumber - 1) % scenes.length];
}
```

**核心原则**：信件配图和场景图使用完全相同的 `IMAGE_STYLE_PREFIX` + `IMAGE_CONSTRAINT_SUFFIX`（见 Task 3.2），确保风格一致。镜头描述由 AI 根据每封信的情绪动态生成（景别、角度、表情、目光、动作、环境），不靠代码硬匹配。

---

### Task 2.2 ✅ GameScreen 信件流程同步化

**文件**：`src/components/GameScreen.tsx`

**改法**：
1. `prepareIncomingLetter()` 改为：
   - 调 `/api/letter` 拿信件内容 + `imagePrompt`
   - 调 `/api/image` 用 `imagePrompt` 生成图片（~10秒，同步等待）
   - 拿到图片 URL 后直接调 `finishIncomingLetter()`
   - 不再调 `/api/video`
2. 第一封信：预置视频 URL `FIRST_LETTER_VIDEO_URL` → 换成预置图片 URL `FIRST_LETTER_IMAGE_URL`（需要先用 Agnes Image 生成一张2077投信机场景图，上传到 Supabase Storage 拿固定 URL）
3. 删除以下不再需要的代码：
   - `resumePendingLetter()` 函数
   - `pollVideoStatus()` / `pollLetterVideo()` 函数
   - 视频轮询相关的 state/ref（`videoPollingRef` 等）
   - `LetterVideo` 类型中的 `taskId`、`videoId` 字段

---

### Task 2.3 ✅ LetterModal 视频播放器改为图片展示

**文件**：`src/components/LetterModal.tsx`（或信匣内的信件展示组件）

**改法**：
- `<video>` 元素 → `<Image>` 组件
- 去掉播放按钮、播放状态管理
- 图片以 16:9 比例展示，保持信匣沉浸感

---

### Task 2.4 ✅ 类型清理

**文件**：`src/lib/prompts.ts`（类型定义区域）

**改法**：
- `LetterVideo` 类型 → `LetterImage`，字段简化为 `{ key: string; status: 'ready'; prompt: string; url: string; createdAt: number; updatedAt: number }`
- 去掉 `taskId`、`videoId`、`status: 'queued'` 等视频专用字段
- 全项目搜索 `LetterVideo` 替换为 `LetterImage`

---

### Task 2.5 ✅ 生成预置首封信图片

用 Agnes Image 生成一张2077投信机场景图：
- prompt: `{IMAGE_STYLE_PREFIX} Wide shot, eye-level. A glowing ceramic mailbox sits on a translucent desk in a dim near-future apartment. Soft golden light emanates from inside the mailbox, illuminating scattered handwritten letters around it. Holographic city skyline visible through a rain-streaked window behind. Quiet, intimate, a bridge between two eras. {IMAGE_CONSTRAINT_SUFFIX}`
- 上传到 Supabase Storage，拿到固定 URL
- 替换代码中的 `FIRST_LETTER_VIDEO_URL`

---

### Task 2.6 ✅ lint + build + push

---

## Phase 3：场景图电影镜头感（30分钟）✅ 完成

提升每轮对话头部场景图的视觉质量，增加镜头语言和人物互动感。已做好的风格和人物一致性不改动。commit `1249d60`（与 Phase 2 合并提交）

### Task 3.1 ✅ SCENE prompt 规则改写

**文件**：`src/lib/prompts.ts`，WORLD_SETTING 内的「场景标记规则」段落

**现在**：
```
[SCENE:用英文描述当前画面，50词以内，包含地点、光线、氛围、主要人物和正在发生的动作]
```

**改为**：
```
[SCENE:shot type(close-up/medium/wide/over-shoulder) + camera angle(low/eye-level/high/dutch) + each character's specific action, facial expression matching narrative mood, and gaze direction(looking at object/person/distance, NOT at camera) + spatial relationship between characters(who faces whom, distance, shared objects connecting them) + location + lighting. 60 words max]
```

同时更新示例：
```
例如：[SCENE:Over-shoulder medium shot from behind the innkeeper, low angle. A lean merchant leans forward with narrowed suspicious eyes pressing a finger on an open ledger. The innkeeper pulls back with arms crossed, jaw tight, avoiding eye contact. Wooden tea stall, warm lantern glow casting long shadows, blurred market crowd behind]
```

---

### Task 3.2 ✅ IMAGE_PROMPT_SUFFIX 拆为前缀 + 后缀

**文件**：`src/lib/prompts.ts`

**现在**：单个 `IMAGE_PROMPT_SUFFIX` 常量，拼在 SCENE 描述之后。

**改为**两个常量：

```typescript
export const IMAGE_STYLE_PREFIX = `Warm amber-gold palette, painted on aged silk texture, rich Dunhuang fresco colors, textured painterly digital art with visible brushwork and grain, NOT anime, NOT 3D render, NOT photorealistic. Cinematic film still, clear foreground-midground-background depth, characters captured mid-action with natural body language, facial expressions matching narrative mood (NOT default smiling), characters engaged with each other or environment (NOT looking at camera, NOT posing).`;

export const IMAGE_CONSTRAINT_SUFFIX = `Correct human anatomy, exactly two arms and two legs per person, natural hands with five fingers, no duplicated face, no duplicated person, no fused bodies, no extra limbs, no malformed hands or feet, no modern clothing, no modern objects, no written text, no subtitles, no logo, no watermark. 16:9 aspect ratio.`;
```

删除旧的 `IMAGE_PROMPT_SUFFIX`。

---

### Task 3.3 ✅ 场景图拼接顺序改造

**文件**：`src/components/GameScreen.tsx`，所有 `generateSceneImage()` 调用处（约3处）

**现在**：`sceneDesc + visualProfiles + IMAGE_PROMPT_SUFFIX`

**改为**：`IMAGE_STYLE_PREFIX + ' ' + sceneDesc + visualProfiles + ' ' + IMAGE_CONSTRAINT_SUFFIX`

风格放最前，让文生图模型优先锁定画风。

同步更新 import：从 `IMAGE_PROMPT_SUFFIX` 改为 import `IMAGE_STYLE_PREFIX` 和 `IMAGE_CONSTRAINT_SUFFIX`。

---

### Task 3.4 ✅ lint + build + push + 实际体验验证

push 后在线上开一局新游戏，对比前后场景图效果。重点观察：
- 人物是否不再正面看镜头
- 表情是否跟随剧情变化
- 多人场景是否有互动关系
- 风格和人物一致性是否保持

---

## Phase 4：代码防护层 sanitizeResponse（1-2小时）✅ 完成

核心原则：Prompt 只管创意，代码强制规则。在 AI 响应和玩家之间加一层铁门。commit `7df2175`

### Task 4.1 ✅ 实现 sanitizeResponse() 函数

**文件**：`src/components/GameScreen.tsx`（或提取到 `src/lib/sanitize.ts`）

**功能**：接收 AI 原始响应 + playerState，返回清洗后的响应。

```typescript
function sanitizeResponse(raw: string, state: PlayerState): string {
  let content = raw;

  // 1. 信件内容泄露截断
  content = content.replace(/信上写着[：:][\s\S]*/g, '');
  content = content.replace(/信中说[：:][\s\S]*/g, '');
  content = content.replace(/林深写道[：:][\s\S]*/g, '');

  // 2. 邮箱描写越界截断（到"金色光芒"为止）
  const mailboxOverflow = content.match(/(金色光[芒辉]|金光涌出)[，。].*/s);
  if (mailboxOverflow) {
    content = content.slice(0, content.indexOf(mailboxOverflow[0]) + mailboxOverflow[0].indexOf('。') + 1);
  }

  // 3. 超长截断（>500字截到最后完整句）
  if ([...content].length > 500) {
    const truncated = [...content].slice(0, 500).join('');
    const lastPeriod = Math.max(truncated.lastIndexOf('。'), truncated.lastIndexOf('」'));
    if (lastPeriod > 200) content = truncated.slice(0, lastPeriod + 1);
  }

  return content;
}
```

---

### Task 4.2 ✅ 实现 sanitizeOptions() 函数

**功能**：过滤 AI 生成的选项。

```typescript
function sanitizeOptions(options: string[], messages: ChatMessage[]): string[] {
  const GENERIC_BLACKLIST = /^(观察细节|仔细查看|换个角度试探|打听消息|继续观察|四处看看)$/;
  let filtered = options.filter(opt => !GENERIC_BLACKLIST.test(opt));

  // 信件选项已有 isLetterRelatedOption 拦截，这里额外过滤
  filtered = filtered.filter(opt => !isLetterRelatedOption(opt));

  return filtered;
}
```

---

### Task 4.3 ✅ 实现 sanitizeState() 函数

**功能**：清洗解析出的 STATE 标记。

```typescript
function sanitizeState(parsed: ParsedState, playerState: PlayerState): ParsedState {
  // VISUAL: ending 只在 act3 生效
  if (parsed.visual === 'ending' && getStoryPhase(playerState).phase !== 'act3') {
    parsed.visual = 'none';
  }
  // 忽略已废弃的 glitch/memory 值
  if (['glitch', 'memory'].includes(parsed.visual)) {
    parsed.visual = 'none';
  }
  // 自由输入次数限制
  if (parsed.input === 'free' && (playerState.freeInputCount || 0) >= 3) {
    parsed.input = 'options';
  }
  return parsed;
}
```

---

### Task 4.4 ✅ 在 handleSendMessage 中接入三个清洗函数

**文件**：`src/components/GameScreen.tsx`

在 AI 响应解析后、展示前，依次调用：
1. `content = sanitizeResponse(rawContent, state)`
2. `options = sanitizeOptions(extractedOptions, messages)`
3. `parsedState = sanitizeState(parsedState, state)`

---

### Task 4.5 ✅ lint + build + push

---

## Phase 5：架构重构（2-3天）

大型重构，降低维护成本。每个 Task 独立 commit，可逐步推进。

### Task 5.1 ✅ prompts.ts 拆分

**原现状**：681 行，5种职责混杂。

**目标结构**：
```
src/lib/
├── types.ts               — 所有接口和类型定义（~120行）
├── prompts/
│   ├── worldSetting.ts    — WORLD_SETTING 常量（~70行）
│   ├── letterWriter.ts    — LETTER_WRITER_PROMPT（~30行）
│   ├── imagePrompt.ts     — IMAGE_STYLE_PREFIX + IMAGE_CONSTRAINT_SUFFIX
│   └── buildPrompt.ts     — buildSystemPrompt() + format* 辅助函数（~200行）
├── gameData/
│   ├── anchors.ts         — ANCHOR_FRAGMENTS 16个锚点碎片（~120行）
│   ├── worldEvents.ts     — WORLD_EVENTS 20个事件（~25行）
│   ├── npcs.ts            — CORE_VISUAL_PROFILES
│   ├── roles.ts           — ROLES + ROLE_CONVERGENCE
│   └── storyConfig.ts     — STORY_PERIODS + 时间/阶段函数（~60行）
├── gameState.ts           — 不变
└── cloudSaves.ts          — 不变
```

**完成情况**：旧的 `prompts.ts` 已改为 re-export barrel 文件，确保外部 import 不 break；`buildPrompt.ts` 的 format helper 额外拆到 `promptFormatters.ts`，保证拆分后文件都低于 200 行。

**验证**：`npm run lint`、`npm run build` 通过。

---

### Task 5.2 ✅ GameScreen.tsx 拆分

**原现状**：1384 行单体组件。

**当前进展**：已迁出纯逻辑、显示组件和主要交互 hooks：
- `src/lib/game/narrativeParsing.ts`：叙事正文清洗、选项提取、STATE 解析
- `src/lib/game/optionLogic.ts`：fallback、去重、矛盾追问选项
- `src/lib/game/mailboxLogic.ts`：信匣选项、未读信、首次邮箱触发判断
- `src/lib/game/responseSanitizers.ts`：AI 响应 / 选项 / 状态防护层
- `src/lib/game/sceneHelpers.ts`：场景图 fallback 和人物视觉档案拼接
- `src/lib/game/letterHelpers.ts`：读信/回信后的续写 prompt
- `src/lib/game/shareHelpers.ts`：分享摘要提取
- `src/lib/game/openingFlow.ts`：角色开场文案、默认场景、开场消息构建
- `src/lib/game/chatStream.ts`：聊天 API 请求、SSE 解析、重试兜底
- `src/components/ChatDisplay.tsx`：消息列表渲染、滚动锚点、场景图展示
- `src/components/OptionPanel.tsx`：选项按钮、自由输入切换、发送中态
- `src/components/GameHeader.tsx`：顶部状态栏、离开、分享、信匣入口
- `src/components/ShareModal.tsx`：分享卡片预览弹窗
- `src/components/TypewriterOpening.tsx`：开场打字机展示页
- `src/components/hooks/useLetterFlow.ts`：信件弹窗、信箱、回信、来信完成回调
- `src/components/hooks/useShareCard.ts`：分享卡片 canvas、二维码、下载状态
- `src/components/hooks/useGameChat.ts`：聊天发送、状态更新、场景图生成、结局触发
- `src/components/hooks/useOpeningFlow.ts`：历史恢复、开场 phase、打字机流程

**验证**：`npm run lint`、`npm run build` 通过。

**完成情况**：已继续抽出开场常量 / 游戏 phase hook，`GameScreen.tsx` 约 246 行。

**目标结构**：
```
src/components/
├── GameScreen.tsx          — 状态协调（~300行）
├── GameHeader.tsx          — 顶部状态栏
├── ChatDisplay.tsx         — 消息列表渲染 + 滚动
├── OptionPanel.tsx         — 选项按钮 / 自由输入切换
├── ShareModal.tsx          — 分享卡片弹窗
├── TypewriterOpening.tsx   — 开场打字机展示
├── LetterModal.tsx         — 信件阅读 / 回信 UI（既有）
├── LetterBox.tsx           — 信箱 UI（既有）
└── hooks/
    ├── useGameChat.ts      — 聊天流式请求 + 解析
    ├── useLetterFlow.ts    — 信件生成流程（Phase 2 后已无轮询）
    └── useShareCard.ts     — 分享图生成
```

---

### Task 5.3 ✅ normalizePlayerState 去重

**现状**：`gameState.ts` 和 `api/chat/route.ts` 各有一份独立实现，字段默认值不同步。

**改法**：提取到 `src/lib/normalize.ts`，前后端 import 同一份。

**完成情况**：新增 `normalizePlayerState()` 和 `normalizePlayerStateForApi()`，前端存档使用前者，`/api/chat` 使用后者以保留输入校验、长度裁剪和角色白名单。

**验证**：`npm run lint`、`npm run build` 通过。

---

### Task 5.4 ✅ gameState.ts 拆分 + saveGameState 双写清理

**现状**：`gameState.ts` 同时承担类型定义、存档仓储、当前游戏读写、聊天历史和章节推进；`saveGameState()` / `saveChatHistory()` 同时写 saves 数组和单独 localStorage key（历史遗留双格式），`clearLegacyStorage()` 每次操作都执行。

**改法**：
- 拆为 `src/lib/gameState/types.ts`、`saveStorage.ts`、`activeGameStorage.ts`、`chapterProgression.ts`、`index.ts`
- 保留 `@/lib/gameState` barrel 出口，避免现有 import 断裂
- 以 saves-v2 为唯一真实来源，移除 `STORAGE_KEY` / `HISTORY_KEY` 双写
- 保留一次性 legacy 清理函数，但不再在每次读写时重复执行

**完成情况**：已完成；`src/lib/gameState.ts` 现在只 re-export `./gameState/index`。

**验证**：`npm run lint`、`npm run build` 通过。

---

### Task 5.5 ✅ 移除未使用视频管线

**原现状**：当前游戏前端已不再调用 `/api/video`，视频相关只剩 README / docs / `src/app/api/video/route.ts` / `src/lib/videoCache.ts` 等历史遗留。

**改法**：
- 删除 `src/app/api/video/route.ts`、`src/lib/videoCache.ts`
- 清理 README 中 Agnes video 环境变量和旧视频管线链接
- 更新 docs，避免后续继续围绕已废弃视频能力做优化

**完成情况**：已删除 `src/app/api/video/route.ts` 和 `src/lib/videoCache.ts`；README 已移除 Agnes video 模型、`AGNES_VIDEO_MODEL` 和失效视频计划链接。

**验证**：`npm run lint`、`npm run build` 通过。

---

### Task 5.6 ✅ promptFormatters.ts 拆分

**现状**：物理行数约 159 行，但长模板字符串和规则密度高，实际维护成本偏高；同时包含章节引导、记忆格式化、因果回声、世界事件/锚点/汇流规则。

**改法**：
- `src/lib/prompts/formatters/chapterGuides.ts`
- `src/lib/prompts/formatters/memoryFormatters.ts`
- `src/lib/prompts/formatters/echoFormatters.ts`
- `src/lib/prompts/formatters/worldFormatters.ts`
- `src/lib/prompts/formatters/index.ts`
- 保留 `src/lib/prompts/promptFormatters.ts` 作为兼容 re-export

**完成情况**：已完成；`promptFormatters.ts` 现在只 re-export `./formatters`。

**验证**：`npm run lint`、`npm run build` 通过。

---

## Phase 6：可靠性与安全（1-2天）

### Task 6.1 ✅ API 路由保护

**文件**：新建 `src/middleware.ts`（Next.js Middleware）

**改法**：
- Origin/Referer 校验（只允许自己的域名）
- IP 级 rate limit（推荐 `@upstash/ratelimit`）
- 至少覆盖 `/api/chat`、`/api/letter`、`/api/image`

---

### Task 6.2 ✅ React Error Boundary

**文件**：新建 `src/components/ErrorBoundary.tsx`

**改法**：
- 在 `GameScreen` 和 `LetterModal` 外层包 Error Boundary
- 白屏时显示"长安遇到了意外…"恢复 UI + "重新加载"按钮
- 捕获渲染错误日志（console.error）

---

### Task 6.3 ✅ localStorage 容量治理

**改法**：
- 加 `getStorageUsage()` 检测当前占用
- 超过 4MB 时自动压缩：旧消息只保留摘要，图片 URL 归档到 IndexedDB
- 或整体迁移到 IndexedDB，localStorage 只存轻量索引

---

### Task 6.4 ✅ 云存档事务安全

**改法**：
- `syncCloudSaves()` 加乐观锁（`updated_at` 版本号），写入前校验版本
- 冲突时提示用户选择保留哪份
- 至少加 1 次自动重试 + 错误提示 UI

---

### Task 6.5 ✅ 信件系统容错

**改法**：
- `/api/letter` 加 1 次自动重试（间隔 3 秒）
- 前端节流：同一存档 60 秒内不重复请求信件
- 请求失败时 UI 显示"林深还在写..."而非静默

---

### Task 6.6 ✅ importSaves schema 验证

**完成情况**：未引入新依赖，使用手写 schema guard 校验 `GameSave`、`PlayerState`、`ChatMessage` 基础结构；导入时裁剪消息数量和内容长度。

---

## Phase 7：体验打磨（1天）

### Task 7.1 ✅ OG/Social meta tags

**文件**：`src/app/layout.tsx`

**完成情况**：已配置 `og:image`、`og:description`、`twitter:card`，并补充 `metadataBase`，build 不再出现 metadataBase warning。

---

### Task 7.2 ✅ 信件历史摘要压缩

**现状**：letter route 只取最近12封信（`.slice(-12)`），长线玩家丢失早期连贯性。

**改法**：对前 N 封信做 AI 摘要压缩（200字总结），拼接最近6封原文。

---

### Task 7.3 ✅ eventVersions 去重

**完成情况**：新增 `normalizeEventVersions()`，导入存档、API 状态归一化和 `updateChapter()` 都会裁剪并归一化 event/source/version，同一事件+来源只保留最新版本。

---

### Task 7.4 ✅ Accessibility 基础

**完成情况**：核心入口、选项按钮、输入框、发送、顶部栏和分享弹窗补充 `aria-label` / `focus-visible` 样式。

---

### Task 7.5 ✅ 设计决策文档拆分

**完成情况**：新增 `docs/DESIGN_DECISIONS.md`，沉淀核心产品与技术决策；README 已加入链接。

---

### Task 7.6 ✅ 跨标签页检测

**完成情况**：新增 `useStorageHealth()`，监听 saves/active save 的 storage event，检测到其他标签页写入时显示游戏内提示。

---

### Task 7.7 ✅ PWA 决策

**决策**：保持 manifest 不变（支持移动端"添加到主屏幕"全屏体验），不加 service worker（游戏必须在线调用 Agnes API，离线无意义）。

---

### Task 7.8 ✅ OpenAI client 单例化

**改法**：`chat/route.ts` 模块顶层创建 client 实例，所有请求共用。

---

## 补充 Task（Phase 外，按需添加）

### Task S.1 ✅ 场景图自动清理（防 localStorage 膨胀）

**问题**：每轮对话生成的场景图 URL 存在 `ChatMessage.sceneImage` 里，持久化到 localStorage，导致存储越来越大。

**改法**：`saveChatHistory()` 保存前自动调用 `trimSceneImages()`，只保留最近 3 条 `sceneImage`，更早的消息清掉该字段。来信配图（`letterHistory[].image`）不受影响，永久保留。

**文件**：`src/lib/gameState.ts`，commit `84ddfd9`

---

## 总览

| Phase | 主题 | 预估工时 | 状态 | 核心收益 |
|-------|------|---------|------|---------|
| **Phase 1** | 体验热修复 | 30分钟 | ✅ 完成 | 消除信匣误触 + fallback 乱选项 |
| **Phase 2** | 信件视频→图片 | 1-2小时 | ✅ 完成 | 信件系统从卡5分钟变成10秒 |
| **Phase 3** | 场景图镜头感 | 30分钟 | ✅ 完成 | 画面从摆拍变电影感 |
| **Phase 4** | 代码防护层 | 1-2小时 | ✅ 完成 | prompt 规则不再脆弱 |
| **Phase 5** | 架构重构 | 2-3天 | ⬜ 推后 | 1600行→300行，可维护 |
| **Phase 6** | 可靠性与安全 | 1-2天 | ✅ 完成 | API 保护 + 容错 + 数据安全 |
| **Phase 7** | 体验打磨 | 1天 | ✅ 完成 | 传播、无障碍、代码整洁 |
| **补充** | 场景图清理 | 15分钟 | ✅ 完成 | 防 localStorage 膨胀 |

**已完成补充修复（2026-06-07）**：
- 选项按钮不显示：`setIsStreaming(false)` 提前到 `setMessages` 之后同批渲染
- NPC 画风写实问题：去除 CORE_VISUAL_PROFILES 和 VISUAL_PROFILE 指令中的写实描述词
- API IP 级 rate limit（20次/分钟，内存 Map，无外部依赖）
- 信件系统容错（1次自动重试 + 失败 UI 提示"林深还在写信..."）
- 角色场景图全部用 Agnes 2.0 重制 + 全局画风统一（去除写实光影描述）
