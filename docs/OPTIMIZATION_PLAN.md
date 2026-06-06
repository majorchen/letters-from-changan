# Letters from Chang'an - 优化计划

> 2026-06-06 创建 · 按 Phase 执行，每个 Task 独立可交付
> 状态标记：⬜ 待做 · 🔄 进行中 · ✅ 完成

---

## Phase 1：体验热修复（30分钟）

立刻修复当前可感知的 bug，不涉及大改动。

### Task 1.1 ⬜ 信件选项误触空信匣（EP-4）

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

### Task 1.2 ⬜ Fallback 选项改为单按钮"静观其变..."（EP-3）

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

### Task 1.3 ⬜ lint + build + push

完成 1.1 和 1.2 后，运行 `npm run lint && npm run build`，通过后 commit 并 push。

---

## Phase 2：信件附件从视频改为图片（1-2小时）

彻底消除视频生成导致的信件系统卡顿和触发失败。

### Task 2.1 ⬜ letter API 改为返回图片 prompt

**文件**：`src/app/api/letter/route.ts`

**改法**：
- `buildVideoPrompt()` → `buildLetterImagePrompt()`
- 返回字段 `videoPrompt` → `imagePrompt`
- 图片 prompt 使用游戏同款风格，内容描述2077场景，格式：

```typescript
function buildLetterImagePrompt(content: string, letterNumber: number): string {
  const excerpt = content.replace(/\s+/g, ' ').slice(0, 300);
  return `${IMAGE_STYLE_PREFIX} Medium shot, a scene from the year 2077 implied by this letter (number ${letterNumber}): ${excerpt}. Near-future Chinese city, restrained believable technology, traces of loneliness and human habitation. Character continuity: 林深: A slim Chinese man in his early thirties from 2077, pale tired face, short slightly untidy black hair, dark reflective eyes, plain graphite-grey future jacket with subtle worn seams. ${IMAGE_CONSTRAINT_SUFFIX}`;
}
```

其中 `IMAGE_STYLE_PREFIX` 和 `IMAGE_CONSTRAINT_SUFFIX` 从 prompts.ts import（见 Task 3.2）。

---

### Task 2.2 ⬜ GameScreen 信件流程同步化

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

### Task 2.3 ⬜ LetterModal 视频播放器改为图片展示

**文件**：`src/components/LetterModal.tsx`（或信匣内的信件展示组件）

**改法**：
- `<video>` 元素 → `<Image>` 组件
- 去掉播放按钮、播放状态管理
- 图片以 16:9 比例展示，保持信匣沉浸感

---

### Task 2.4 ⬜ 类型清理

**文件**：`src/lib/prompts.ts`（类型定义区域）

**改法**：
- `LetterVideo` 类型 → `LetterImage`，字段简化为 `{ key: string; status: 'ready'; prompt: string; url: string; createdAt: number; updatedAt: number }`
- 去掉 `taskId`、`videoId`、`status: 'queued'` 等视频专用字段
- 全项目搜索 `LetterVideo` 替换为 `LetterImage`

---

### Task 2.5 ⬜ 生成预置首封信图片

用 Agnes Image 生成一张2077投信机场景图：
- prompt: `{IMAGE_STYLE_PREFIX} Wide shot, eye-level. A glowing ceramic mailbox sits on a translucent desk in a dim near-future apartment. Soft golden light emanates from inside the mailbox, illuminating scattered handwritten letters around it. Holographic city skyline visible through a rain-streaked window behind. Quiet, intimate, a bridge between two eras. {IMAGE_CONSTRAINT_SUFFIX}`
- 上传到 Supabase Storage，拿到固定 URL
- 替换代码中的 `FIRST_LETTER_VIDEO_URL`

---

### Task 2.6 ⬜ lint + build + push

---

## Phase 3：场景图电影镜头感（30分钟）

提升每轮对话头部场景图的视觉质量，增加镜头语言和人物互动感。已做好的风格和人物一致性不改动。

### Task 3.1 ⬜ SCENE prompt 规则改写

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

### Task 3.2 ⬜ IMAGE_PROMPT_SUFFIX 拆为前缀 + 后缀

**文件**：`src/lib/prompts.ts`

**现在**：单个 `IMAGE_PROMPT_SUFFIX` 常量，拼在 SCENE 描述之后。

**改为**两个常量：

```typescript
export const IMAGE_STYLE_PREFIX = `Warm amber-gold palette, painted on aged silk texture, rich Dunhuang fresco colors, textured painterly digital art with visible brushwork and grain, NOT anime, NOT 3D render, NOT photorealistic. Cinematic film still, clear foreground-midground-background depth, characters captured mid-action with natural body language, facial expressions matching narrative mood (NOT default smiling), characters engaged with each other or environment (NOT looking at camera, NOT posing).`;

export const IMAGE_CONSTRAINT_SUFFIX = `Correct human anatomy, exactly two arms and two legs per person, natural hands with five fingers, no duplicated face, no duplicated person, no fused bodies, no extra limbs, no malformed hands or feet, no modern clothing, no modern objects, no written text, no subtitles, no logo, no watermark. 16:9 aspect ratio.`;
```

删除旧的 `IMAGE_PROMPT_SUFFIX`。

---

### Task 3.3 ⬜ 场景图拼接顺序改造

**文件**：`src/components/GameScreen.tsx`，所有 `generateSceneImage()` 调用处（约3处）

**现在**：`sceneDesc + visualProfiles + IMAGE_PROMPT_SUFFIX`

**改为**：`IMAGE_STYLE_PREFIX + ' ' + sceneDesc + visualProfiles + ' ' + IMAGE_CONSTRAINT_SUFFIX`

风格放最前，让文生图模型优先锁定画风。

同步更新 import：从 `IMAGE_PROMPT_SUFFIX` 改为 import `IMAGE_STYLE_PREFIX` 和 `IMAGE_CONSTRAINT_SUFFIX`。

---

### Task 3.4 ⬜ lint + build + push + 实际体验验证

push 后在线上开一局新游戏，对比前后场景图效果。重点观察：
- 人物是否不再正面看镜头
- 表情是否跟随剧情变化
- 多人场景是否有互动关系
- 风格和人物一致性是否保持

---

## Phase 4：代码防护层 sanitizeResponse（1-2小时）

核心原则：Prompt 只管创意，代码强制规则。在 AI 响应和玩家之间加一层铁门。

### Task 4.1 ⬜ 实现 sanitizeResponse() 函数

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

### Task 4.2 ⬜ 实现 sanitizeOptions() 函数

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

### Task 4.3 ⬜ 实现 sanitizeState() 函数

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

### Task 4.4 ⬜ 在 handleSendMessage 中接入三个清洗函数

**文件**：`src/components/GameScreen.tsx`

在 AI 响应解析后、展示前，依次调用：
1. `content = sanitizeResponse(rawContent, state)`
2. `options = sanitizeOptions(extractedOptions, messages)`
3. `parsedState = sanitizeState(parsedState, state)`

---

### Task 4.5 ⬜ lint + build + push

---

## Phase 5：架构重构（2-3天）

大型重构，降低维护成本。每个 Task 独立 commit，可逐步推进。

### Task 5.1 ⬜ prompts.ts 拆分

**现状**：738 行，5种职责混杂。

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
│   ├── roles.ts           — ROLES + ROLE_CONVERGENCE + CORE_VISUAL_PROFILES（~60行）
│   └── storyConfig.ts     — STORY_PERIODS + 时间/阶段函数（~60行）
├── gameState.ts           — 不变
└── cloudSaves.ts          — 不变
```

每个文件 < 200 行。旧的 `prompts.ts` 改为 re-export barrel 文件过渡，确保外部 import 不 break。

---

### Task 5.2 ⬜ GameScreen.tsx 拆分

**现状**：1600+ 行单体组件。

**目标结构**：
```
src/components/
├── GameScreen.tsx          — 状态协调（~300行）
├── ChatDisplay.tsx         — 消息列表渲染 + 滚动
├── OptionPanel.tsx         — 选项按钮 / 自由输入切换
├── LetterSystem.tsx        — 信件生成、通知
└── hooks/
    ├── useGameChat.ts      — 聊天流式请求 + 解析
    ├── useLetterFlow.ts    — 信件生成流程（Phase 2 后已无轮询）
    └── useGameState.ts     — PlayerState 读写 + 持久化
```

---

### Task 5.3 ⬜ normalizePlayerState 去重

**现状**：`gameState.ts` 和 `api/chat/route.ts` 各有一份独立实现，字段默认值不同步。

**改法**：提取到 `src/lib/normalize.ts`，前后端 import 同一份。

---

### Task 5.4 ⬜ saveGameState 双写清理

**现状**：同时写 saves 数组和单独 localStorage key（历史遗留双格式），`clearLegacyStorage()` 每次操作都执行。

**改法**：确认无旧格式用户后，移除双写和 `clearLegacyStorage()` 调用。

---

### Task 5.5 ⬜ video/route.ts 拆分

**现状**：414 行，同时处理创建、轮询、持久化、格式归一化。

**改法**：
- 提取 `src/lib/videoHelpers.ts`：`persistVideoAsset()`、`normalizeAgnesResponse()`
- `route.ts` 只保留 HTTP handler（~150行）
- 注意：Phase 2 完成后信件不再用视频，但其他功能（如结局）可能仍需要

---

## Phase 6：可靠性与安全（1-2天）

### Task 6.1 ⬜ API 路由保护

**文件**：新建 `src/middleware.ts`（Next.js Middleware）

**改法**：
- Origin/Referer 校验（只允许自己的域名）
- IP 级 rate limit（推荐 `@upstash/ratelimit`）
- 至少覆盖 `/api/chat`、`/api/letter`、`/api/image`

---

### Task 6.2 ⬜ React Error Boundary

**文件**：新建 `src/components/ErrorBoundary.tsx`

**改法**：
- 在 `GameScreen` 和 `LetterModal` 外层包 Error Boundary
- 白屏时显示"长安遇到了意外…"恢复 UI + "重新加载"按钮
- 捕获渲染错误日志（console.error）

---

### Task 6.3 ⬜ localStorage 容量治理

**改法**：
- 加 `getStorageUsage()` 检测当前占用
- 超过 4MB 时自动压缩：旧消息只保留摘要，图片 URL 归档到 IndexedDB
- 或整体迁移到 IndexedDB，localStorage 只存轻量索引

---

### Task 6.4 ⬜ 云存档事务安全

**改法**：
- `syncCloudSaves()` 加乐观锁（`updated_at` 版本号），写入前校验版本
- 冲突时提示用户选择保留哪份
- 至少加 1 次自动重试 + 错误提示 UI

---

### Task 6.5 ⬜ 信件系统容错

**改法**：
- `/api/letter` 加 1 次自动重试（间隔 3 秒）
- 前端节流：同一存档 60 秒内不重复请求信件
- 请求失败时 UI 显示"林深还在写..."而非静默

---

### Task 6.6 ⬜ importSaves schema 验证

**改法**：用 zod 对导入的 JSON 做 schema 验证，拒绝不符合 `PlayerState` 结构的数据。

---

## Phase 7：体验打磨（1天）

### Task 7.1 ⬜ OG/Social meta tags

**文件**：`src/app/layout.tsx`

**改法**：加 `og:image`（用 `bg-changan.webp`）、`og:description`（"你在唐朝收到了一封来自2077年的信"）、`twitter:card`。

---

### Task 7.2 ⬜ 信件历史摘要压缩

**现状**：letter route 只取最近12封信（`.slice(-12)`），长线玩家丢失早期连贯性。

**改法**：对前 N 封信做 AI 摘要压缩（200字总结），拼接最近6封原文。

---

### Task 7.3 ⬜ eventVersions 去重

**改法**：STATE 解析时对 eventVersions 做 dedup（同一事件+同一来源只保留最新说法）。

---

### Task 7.4 ⬜ Accessibility 基础

**改法**：核心交互元素加 `aria-label`，选项按钮加 `:focus-visible` 样式。

---

### Task 7.5 ⬜ CHANGELOG 拆分

**改法**：拆出 `docs/DESIGN_DECISIONS.md` 存放9个核心设计决策，CHANGELOG 只保留版本流水。

---

### Task 7.6 ⬜ 跨标签页检测

**改法**：监听 `window.addEventListener('storage', ...)`，检测到外部写入时提示"其他标签页正在游玩此存档"。

---

### Task 7.7 ⬜ PWA 决策

**改法**：要么加 next-pwa 实现离线 fallback，要么去掉 manifest 中的 PWA 声明。

---

### Task 7.8 ⬜ OpenAI client 单例化

**改法**：`chat/route.ts` 模块顶层创建 client 实例，所有请求共用。

---

## 总览

| Phase | 主题 | 预估工时 | 核心收益 |
|-------|------|---------|---------|
| **Phase 1** | 体验热修复 | 30分钟 | 消除信匣误触 + fallback 乱选项 |
| **Phase 2** | 信件视频→图片 | 1-2小时 | 信件系统从卡5分钟变成10秒 |
| **Phase 3** | 场景图镜头感 | 30分钟 | 画面从摆拍变电影感 |
| **Phase 4** | 代码防护层 | 1-2小时 | prompt 规则不再脆弱 |
| **Phase 5** | 架构重构 | 2-3天 | 1600行→300行，可维护 |
| **Phase 6** | 可靠性与安全 | 1-2天 | API 保护 + 容错 + 数据安全 |
| **Phase 7** | 体验打磨 | 1天 | 传播、无障碍、代码整洁 |

**推荐执行顺序**：Phase 1 → 2 → 3 → 4 → 6.1 → 5 → 6 余项 → 7
