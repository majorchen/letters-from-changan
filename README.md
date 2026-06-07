# 来信长安

AI 驱动的盛唐长安跨时空书信叙事游戏。

玩家以商人、乐师、游侠或书生的身份进入公元 742 年的长安，在市井、客栈、酒肆与陌生人之间游走。某个夜晚，一只像唐三彩陶器的信匣开始发光，来自 2077 年的林深把第一封信投向了这个时代。

线上版本：https://letterstang.aifisher.cn

## 当前玩法

- 选择身份进入不同开场。
- 与 AI 叙事者对话，探索长安地点、NPC、事件和矛盾线索。
- 每轮对话生成行动选项，并按场景生成画面。
- 通过信匣与 2077 年的林深通信；信件是文本系统，不再依赖视频。
- 支持多旅程本地存档；配置 Supabase 后可登录并跨设备同步。

## 技术栈

- Next.js 16 / React 19 / TypeScript
- Tailwind CSS 4
- Agnes API
  - `agnes-2.0-flash`：叙事、书信、结局文本
  - `agnes-image-2.0-flash`：场景图
- Supabase：可选云存档和邮箱 OTP 登录
- Vercel：线上部署
- `localStorage`：本地存档主存储

## 本地开发

```bash
npm install
npm run dev
```

本地环境变量：

```bash
AGNES_API_KEY=...
AGNES_API_URL=...
NEXT_PUBLIC_SITE_URL=https://letterstang.aifisher.cn
API_RATE_LIMIT_PER_MINUTE=100
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
```

Supabase 未配置时，游戏会自动回退为纯本地存档。

## 验证

```bash
npm run lint
npm run build
```

当前仓库没有 `scripts/` 目录，因此 README 和 `package.json` 不再保留旧的 `smoke:*` / `audit` 脚本。

## 当前架构

### 页面与组件

- `src/app/page.tsx`：首页/游戏页切换、存档列表入口。
- `src/components/StartScreen.tsx`：开始页、角色选择、存档选择、云登录入口。
- `src/components/GameScreen.tsx`：游戏主协调组件，只负责组合状态、hooks 和 UI。
- `src/components/ChatDisplay.tsx`：叙事消息列表、场景图展示、滚动锚点。
- `src/components/OptionPanel.tsx`：行动选项和自由输入。
- `src/components/GameHeader.tsx`：顶部位置、角色、分享、信匣入口。
- `src/components/LetterModal.tsx` / `LetterBox.tsx`：读信、回信、信箱。
- `src/components/ShareModal.tsx`：分享卡片预览。
- `src/components/TypewriterOpening.tsx` / `Prologue.tsx`：开场动画和打字机。
- `src/components/EndingSequence.tsx`：结局展示。
- `src/components/ErrorBoundary.tsx`：渲染异常兜底。

### Hooks

- `src/components/hooks/useOpeningFlow.ts`：历史恢复、开场 phase、打字机流程。
- `src/components/hooks/useGameChat.ts`：聊天发送、流式响应、状态更新、场景图、结局触发。
- `src/components/hooks/useLetterFlow.ts`：来信、读信、回信、信匣状态。
- `src/components/hooks/useShareCard.ts`：分享图 canvas 和二维码。
- `src/components/hooks/useStorageHealth.ts`：localStorage 容量提示、跨标签页存档变更提示。

### 游戏逻辑

- `src/lib/game/openingFlow.ts`：角色开场文案、默认场景、开场消息构建。
- `src/lib/game/chatStream.ts`：`/api/chat` SSE 流解析。
- `src/lib/game/narrativeParsing.ts`：正文清洗、选项提取、`[STATE]` 解析。
- `src/lib/game/optionLogic.ts`：选项归一化、fallback、矛盾追问。
- `src/lib/game/mailboxLogic.ts`：信匣发现、未读信、信件选项判断。
- `src/lib/game/responseSanitizers.ts`：AI 响应、选项、状态的防护层。
- `src/lib/game/sceneHelpers.ts`：场景图 fallback、人物视觉档案拼接。
- `src/lib/game/letterHelpers.ts`：读信/回信后的续写 prompt。
- `src/lib/game/shareHelpers.ts`：分享摘要提取。

### Prompt 与世界数据

- `src/lib/prompts.ts`：兼容出口，只做 re-export。
- `src/lib/types.ts`：核心类型，如 `PlayerState`、`LetterEntry`、`MailboxState`。
- `src/lib/prompts/worldSetting.ts`：世界观系统提示。
- `src/lib/prompts/buildPrompt.ts`：组装 `/api/chat` system prompt。
- `src/lib/prompts/letterWriter.ts`：林深写信提示。
- `src/lib/prompts/imagePrompt.ts`：场景图风格约束。
- `src/lib/prompts/formatters/*`：章节、记忆、回声、世界事件 formatter。
- `src/lib/gameData/*`：角色、NPC、锚点、世界事件、故事时间配置。

### 存档与安全

- `src/lib/gameState.ts`：兼容出口，只做 re-export。
- `src/lib/gameState/types.ts`：存档、消息、状态更新类型。
- `src/lib/gameState/saveStorage.ts`：本地存档数组、导入导出、容量治理、legacy 清理。
- `src/lib/gameState/activeGameStorage.ts`：当前存档、聊天历史、清档。
- `src/lib/gameState/chapterProgression.ts`：章节推进和结构化状态合并。
- `src/lib/normalize.ts`：`PlayerState` 归一化、API 输入校验、eventVersions 去重。
- `src/lib/cloudSaves.ts`：Supabase 云存档同步、OTP 登录、同步锁和重试。
- `src/lib/rateLimit.ts`：公开 API route 的宽松防滥用限流。

### API 路由

- `src/app/api/chat/route.ts`：主叙事流式对话。
- `src/app/api/letter/route.ts`：林深来信生成，保留最近信件原文并摘要更早通信。
- `src/app/api/image/route.ts`：场景图生成。
- `src/app/api/ending/route.ts`：结局文本生成。

`/api/video` 已删除，当前游戏不使用视频管线。

## 线上问题排查入口

- AI 回复没有选项：看 `src/lib/game/narrativeParsing.ts`、`src/lib/game/optionLogic.ts`、`src/lib/prompts/buildPrompt.ts`。
- 点到普通“信”字选项却打开信匣：看 `src/lib/game/mailboxLogic.ts` 和 `GameScreen.handleOptionClick`。
- 来信不出现或重复出现：看 `src/components/hooks/useLetterFlow.ts`、`src/app/api/letter/route.ts`、`src/lib/game/mailboxLogic.ts`。
- 场景图不生成或风格不对：看 `src/components/hooks/useGameChat.ts`、`src/app/api/image/route.ts`、`src/lib/prompts/imagePrompt.ts`。
- 状态丢失、存档变大、导入失败：看 `src/lib/gameState/saveStorage.ts`、`src/lib/normalize.ts`。
- 云存档登录/同步问题：看 `src/lib/cloudSaves.ts` 和 Supabase 配置。
- prompt 内容要调整：优先改 `src/lib/prompts/*` 和 `src/lib/gameData/*`，不要改 `prompts.ts` barrel。
- 主界面 UI 问题：看 `GameScreen.tsx` 的组合关系，再进入对应组件或 hook。

## 文档

- `docs/OPTIMIZATION_PLAN.md`：历史优化计划、任务完成记录、重构范围。
- `docs/DESIGN_DECISIONS.md`：核心产品和技术决策。

## 已知后置项

当前 Phase 1-7 文档任务已完成。仍建议后续人工验证以下线上体验：

- 长线游玩 30-60 分钟，确认信件节奏、状态推进和结局触发自然。
- 多设备云同步冲突场景，确认“最新版本优先”的策略符合预期。
- 移动端可访问性和软键盘体验。
- API rate limit 默认是防滥用，不是强使用限制；如正常玩家遇到 429，可调高 `API_RATE_LIMIT_PER_MINUTE`。
