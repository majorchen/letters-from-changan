# Letters from Chang'an - 优化计划

> 2026-06-06 审阅生成，仅分析不动代码

---

## 一、架构级问题（优先处理）

### 1. GameScreen.tsx 单体组件（1600 行）

**问题**：聊天显示、选项渲染、信件系统、视频轮询、状态管理全部揉在一个组件里，8+ useCallback、5+ useState，阅读和维护成本极高。

**建议拆分**：
```
GameScreen.tsx (300行，状态协调)
├── ChatDisplay.tsx        — 消息列表渲染 + 滚动
├── OptionPanel.tsx         — 选项按钮 / 自由输入切换
├── LetterSystem.tsx        — 信件生成、轮询、通知
├── VideoPlayer.tsx         — 视频播放 + 状态管理
└── hooks/
    ├── useGameChat.ts      — 聊天流式请求 + 解析
    ├── useLetterPolling.ts — 信件 & 视频轮询逻辑
    └── useGameState.ts     — PlayerState 读写 + 持久化
```

**收益**：每个文件 < 400 行，可独立测试，改信件系统不用碰聊天逻辑。

---

### 2. prompts.ts 职责混杂（738 行）

**问题**：一个文件同时承担 5 种职责：
- Prompt 文本（WORLD_SETTING、LETTER_WRITER_PROMPT、IMAGE_PROMPT_SUFFIX）
- 游戏数据常量（16 个 ANCHOR_FRAGMENTS、20 个 WORLD_EVENTS、4 个 ROLE_CONVERGENCE）
- TypeScript 类型定义（PlayerState、MailboxState、LetterEntry 等 10+ 接口）
- 状态管理函数（getMailboxState、advanceStoryTime、INITIAL_STATE）
- 格式化工具函数（formatNpcMemories、formatEventVersions 等 8 个）

**建议拆分**：
```
src/lib/
├── types.ts               — 所有接口和类型定义（PlayerState, MailboxState, etc.）
├── prompts/
│   ├── worldSetting.ts    — WORLD_SETTING 常量
│   ├── letterWriter.ts    — LETTER_WRITER_PROMPT 常量
│   ├── imagePrompt.ts     — IMAGE_PROMPT_SUFFIX
│   └── buildPrompt.ts     — buildSystemPrompt() + 所有 format* 辅助函数
├── gameData/
│   ├── anchors.ts         — ANCHOR_FRAGMENTS（16 个锚点碎片）
│   ├── worldEvents.ts     — WORLD_EVENTS（20 个世界事件）
│   ├── roles.ts           — ROLES + ROLE_CONVERGENCE + CORE_VISUAL_PROFILES
│   └── storyConfig.ts     — STORY_PERIODS, 时间/阶段相关常量和函数
├── gameState.ts           — 现有存档逻辑 + INITIAL_STATE + getMailboxState + advanceStoryTime
└── cloudSaves.ts          — 不变
```

**收益**：
- 策划改锚点碎片 → 只动 `anchors.ts`，不碰 prompt 逻辑
- 改 prompt 措辞 → 只动 `worldSetting.ts`，不碰数据
- 加新类型字段 → 只动 `types.ts`
- 每个文件 < 150 行，职责单一

---

### 3. localStorage 容量隐患

**问题**：完整聊天记录 + 场景图片 URL + 视频缓存全存 localStorage，长线游玩（200+ 回合）可能撞 5-10MB 上限。无清理机制，满了会静默失败。

**建议**：
- 加 `getStorageUsage()` 检测当前占用
- 超过 4MB 时自动压缩：旧消息只保留摘要，场景图片 URL 归档到 IndexedDB
- 或整体迁移到 IndexedDB（容量无上限），localStorage 只存轻量索引

---

### 4. 云存档事务安全

**问题**：`syncCloudSaves()` 执行 3 次独立 Supabase 调用（select → upsert → local save），中间失败会导致不一致状态，无重试。

**建议**：
- 用 Supabase RPC 做原子操作（单次 DB 调用完成 diff + upsert）
- 或加乐观锁（`updated_at` 版本号），写入前校验版本，冲突时提示用户选择
- 至少加 1 次自动重试 + 错误提示 UI

---

## 二、叙事引擎逻辑

### 5. 信件历史截断（`.slice(-12)`）

**问题**：letter route 只取最近 12 封信作上下文，长线玩家丢失早期信件连贯性，林深可能"忘记"之前说过的话。

**建议**：对前 N 封信做 AI 摘要压缩（一次性生成 200 字总结），拼接最近 6 封原文，而非简单截断。

---

### 6. fallbackOptions 脆弱

**问题**：AI 没输出 `[OPTIONS_JSON]` 时，fallback 用正则从叙事文本提取关键词拼选项。这条链路本身也容易失败，且模板句跨角色复用缺乏多样性。

**建议**：
- 第一选择：retry 一次 AI（只请求选项，附带当前叙事文本，token 成本低）
- 第二选择：按角色分别维护 fallback 模板池
- 现有正则 fallback 降级为第三道防线

---

### 7. 事件版本（eventVersions）无去重

**问题**：同一回合内可能累积重复的 EVENT_VERSION 条目，长期运行后矛盾追踪膨胀。

**建议**：STATE 解析时对 eventVersions 做 dedup（同一事件+同一来源只保留最新说法）。

---

## 三、API 可靠性

### 8. Agnes API 容错不对称

**问题**：
- `/api/chat` 失败重试 1 次 — 合理
- `/api/letter` 只有第一封有 fallback，后续信件无重试 — 信件是核心玩法
- 无 rate limiting

**建议**：
- `/api/letter` 加 1 次自动重试（间隔 3 秒）
- 前端加节流：同一存档 60 秒内不重复请求信件
- 可选：请求失败时 UI 显示"林深还在写..."而非静默

---

### 9. 视频轮询策略

**问题**：固定 10 秒间隔轮询（最多 30 次 = 5 分钟），浪费请求。中途刷新页面导致视频任务孤立（`video_assets` 卡在 `queued`）。

**建议**：
- 指数退避：10s → 20s → 40s → 60s（4 次覆盖 2 分钟，比 12 次 10s 省 8 次请求）
- 页面加载时检查 `video_assets` 中 `queued` 超过 10 分钟的条目，标记为 `failed` 并允许重试

---

## 四、边界场景

### 10. PWA 有声明无实现

**问题**：`manifest.json` 存在但无 Service Worker，不是真正的 PWA。

**建议**：要么加 next-pwa 实现离线 fallback，要么去掉 manifest 中的 PWA 声明避免误导。

---

### 11. 跨标签页不同步

**问题**：两个标签页同时玩同一存档会互相覆盖 localStorage。

**建议**：监听 `window.addEventListener('storage', ...)` 事件，检测到外部写入时提示用户"其他标签页正在游玩此存档"。

---

### 12. 视觉描述 hardcode

**问题**：`CORE_VISUAL_PROFILES` 写死 14 个角色描述，新 NPC 需手动加。

**建议**：保持核心角色 hardcode（稳定性优先），但对叙事中动态出现的命名 NPC，让 AI 在 `VISUAL_PROFILE` 字段生成后自动追加到 `playerState.visualProfiles`（目前已有此机制，确认运行正常即可）。

---

## 五、优先级排序

| 优先级 | 项目 | 影响面 | 工作量 |
|--------|------|--------|--------|
| P0 | GameScreen 拆分 | 可维护性 | 1-2 天 |
| P0 | prompts.ts 拆分 | 可维护性 | 半天 |
| P1 | localStorage 容量治理 | 长线玩家稳定性 | 半天 |
| P1 | 信件系统容错（retry + UI） | 核心体验 | 2-3 小时 |
| P1 | 云存档事务安全 | 数据安全 | 半天 |
| P2 | 信件历史摘要压缩 | 叙事连贯性 | 3-4 小时 |
| P2 | 视频轮询指数退避 | 性能 | 1 小时 |
| P2 | fallbackOptions 改进 | 体验兜底 | 2-3 小时 |
| P3 | eventVersions 去重 | 数据整洁 | 1 小时 |
| P3 | PWA 决策（实现或移除） | 一致性 | 1-2 小时 |
| P3 | 跨标签页检测 | 边界防护 | 1 小时 |

---

## 六、prompts.ts 拆分详细方案

当前 738 行文件的内容分布：

```
L1-70     WORLD_SETTING（prompt 文本）
L72-101   LETTER_WRITER_PROMPT（prompt 文本）
L103      IMAGE_PROMPT_SUFFIX（prompt 文本）
L105-115  CORE_VISUAL_PROFILES（游戏数据）
L117-122  ROLES（游戏数据）
L124-202  buildSystemPrompt()（组装函数）
L204-269  getSliceOfLifeGuide / getChapterGuide（叙事逻辑）
L271-538  类型定义 + 时间/阶段函数
L540-638  format* 系列工具函数 + 数据常量
L640-738  状态管理 + INITIAL_STATE
```

**拆分后每个文件行数估算**：
- `types.ts`: ~120 行（纯类型）
- `prompts/worldSetting.ts`: ~70 行
- `prompts/letterWriter.ts`: ~30 行
- `prompts/buildPrompt.ts`: ~200 行（buildSystemPrompt + format* + guide 函数）
- `gameData/anchors.ts`: ~120 行
- `gameData/worldEvents.ts`: ~25 行（常量）
- `gameData/roles.ts`: ~60 行
- `gameData/storyConfig.ts`: ~60 行

每个文件控制在 200 行以内，职责清晰。

---

## 七、代码重复与冗余（深度审查补充）

### 13. `normalizePlayerState()` 重复实现 ⚠️

**问题**：`gameState.ts`（L106-165）有完整版 `normalizePlayerState()`，`api/chat/route.ts` 里又独立实现了一份。两份逻辑不同步——一边改了字段默认值，另一边不会自动跟上，前后端状态归一化结果可能出现差异。

**建议**：提取到 `src/lib/normalize.ts`，前后端 import 同一份。这是最容易产生隐蔽 bug 的地方。

---

### 14. `saveGameState()` 双写冗余

**问题**：`saveGameState()` 同时写入 saves 数组和单独的 localStorage key（历史遗留的双格式并存）。`clearLegacyStorage()` 在 `loadSaves()`、`saveGameState()`、`deleteSave()` 等几乎每个函数里都被调用，每次操作都执行一次清理扫描。

**建议**：确认已无旧格式用户后，移除双写逻辑和 `clearLegacyStorage()` 调用，减少无意义 I/O。

---

### 15. video/route.ts 复杂度（414 行）

**问题**：仅次于 GameScreen.tsx 的第二大文件，同时处理 POST（创建视频）、GET（轮询状态）、Supabase Storage 持久化、多种 Agnes API 响应格式归一化。

**建议**：拆分为：
- `videoHelpers.ts`：`persistVideoAsset()`、`persistQueuedAsset()`、`normalizeAgnesResponse()`
- `route.ts`：只保留 HTTP handler 逻辑（~150 行）

---

## 八、安全与健壮性（深度审查补充）

### 16. API 路由无任何保护 ⚠️

**问题**：`/api/chat`、`/api/letter`、`/api/image`、`/api/video` 四个路由完全裸露，无 rate limiting、无 origin 检查、无 CORS 配置。任何人可以直接调用这些接口消耗 Agnes API 额度。

**建议**：
- 至少加 origin 校验（检查 `Referer` 或 `Origin` header）
- 用 Vercel Edge Middleware 或 `@upstash/ratelimit` 做简单的 IP 级 rate limit
- 敏感路由（letter、video）考虑加 session token 验证

---

### 17. `importSaves()` 缺乏验证

**问题**：用户导入存档时只做了最浅的检查，恶意 JSON 可以注入任意字段到 localStorage。

**建议**：用 zod 对导入的 JSON 做 schema 验证，拒绝不符合 `PlayerState` 结构的数据。

---

### 18. React Error Boundary 缺失 ⚠️

**问题**：任何子组件 render 报错（如 `letterHistory` 某条数据格式异常、`options` 数组包含非字符串）会导致整个游戏白屏，无恢复手段。

**建议**：在 `GameScreen` 和 `LetterModal` 外层包 Error Boundary，白屏时显示"长安遇到了意外…"的恢复 UI，提供"重新加载"按钮。

---

### 19. OpenAI client 每请求重建

**问题**：`chat/route.ts` 每次 POST 都执行 `new OpenAI()`。虽然 Serverless 环境下影响有限，但模块级单例可以减少初始化开销。

**建议**：在模块顶层创建 client 实例，所有请求共用。

---

## 九、体验与分发（深度审查补充）

### 20. 缺少 OG/Social meta tags

**问题**：`layout.tsx` 有基本 viewport 和 PWA 配置，但没有 `og:image`、`og:description`、`twitter:card`。微信/Twitter 分享时没有预览卡片，降低传播效果。

**建议**：加 OpenGraph meta，用 `bg-changan.webp` 作为 `og:image`，描述用"你在唐朝收到了一封来自2077年的信"。

---

### 21. Accessibility 基础支持

**问题**：没有 `aria-label`、没有键盘导航、选项按钮无 focus 样式。对视觉障碍用户完全不可用。

**建议**：至少给核心交互元素加 `aria-label`（选项按钮、信件、输入框、关闭按钮），选项按钮加 `:focus-visible` 样式。

---

### 22. CHANGELOG.md 身份混乱（400+ 行）

**问题**：同时充当版本日志、设计决策文档和功能规格说明。9 个核心设计决策（如"为什么不做多人"、"为什么 localStorage 优先"、"信件不入主聊天流"）埋在版本记录中间，难以查阅。

**建议**：拆出 `docs/DESIGN_DECISIONS.md` 存放设计决策与原因，CHANGELOG 只保留版本流水。

---

### 23. `pollLetterVideo` 递归调用

**问题**：`GameScreen.tsx` L824-844 的 `pollLetterVideo` 用递归实现轮询，最多 30 层深（每层 await 10s）。技术上可行但调试时 call stack 信息不友好。

**建议**：改为 while 循环 + 指数退避（与 #9 视频轮询策略合并实施）。

---

## 更新后的优先级排序

| 优先级 | 项目 | 影响面 | 工作量 |
|--------|------|--------|--------|
| **P0** | #1 GameScreen 拆分 | 可维护性 | 1-2 天 |
| **P0** | #2 prompts.ts 拆分 | 可维护性 | 半天 |
| **P0** | #13 normalizePlayerState 去重 | 正确性 | 1 小时 |
| **P1** | #16 API 路由保护 | 安全/成本 | 2-3 小时 |
| **P1** | #18 React Error Boundary | 用户体验 | 1-2 小时 |
| **P1** | #3 localStorage 容量治理 | 长线稳定性 | 半天 |
| **P1** | #8 信件系统容错（retry + UI） | 核心体验 | 2-3 小时 |
| **P1** | #4 云存档事务安全 | 数据安全 | 半天 |
| **P2** | #20 OG/Social meta tags | 传播效果 | 30 分钟 |
| **P2** | #5 信件历史摘要压缩 | 叙事连贯性 | 3-4 小时 |
| **P2** | #9+#23 视频轮询指数退避 | 性能 | 1 小时 |
| **P2** | #6 fallbackOptions 改进 | 体验兜底 | 2-3 小时 |
| **P2** | #15 video/route.ts 拆分 | 可维护性 | 1-2 小时 |
| **P2** | #22 CHANGELOG 拆分 | 文档可读性 | 1 小时 |
| **P2** | #14 saveGameState 双写清理 | 代码整洁 | 1 小时 |
| **P3** | #19 OpenAI client 单例 | 微优化 | 15 分钟 |
| **P3** | #17 importSaves 验证 | 安全 | 1 小时 |
| **P3** | #21 Accessibility 基础 | 包容性 | 2 小时 |
| **P3** | #7 eventVersions 去重 | 数据整洁 | 1 小时 |
| **P3** | #10 PWA 决策 | 一致性 | 1-2 小时 |
| **P3** | #11 跨标签页检测 | 边界防护 | 1 小时 |
