# 来信长安 — 版本进度与功能清单

> 项目创建于 2026-06-04，由 Major 确认方向
> 线上地址：https://letters-from-changan.vercel.app
> GitHub：https://github.com/majorchen/letters-from-changan

---

## 技术栈
- Next.js 16 + TypeScript + Tailwind CSS 4
- Agnes API（agnes-2.0-flash 聊天 / agnes-image-2.1-flash 图片）
- Vercel 部署（majorchen 账号）
- localStorage 状态持久化

---

## v0.1 — MVP（2026-06-04）

### 核心功能
- [x] 4身份选择（商人/乐师/游侠/书生），各有独立开场叙述和季节设定
- [x] 5.7秒电影式序幕（黑屏→标题→氛围语→背景图→打字机开场）
- [x] AI 流式叙事对话（Agnes agnes-2.0-flash）
- [x] 快捷选项按钮（根据剧情阶段动态变化）
- [x] 玩家状态持久化（localStorage：位置/章节/NPC关系/事件/信件历史）
- [x] 继续旅程 / 新游戏

### 信件系统
- [x] AI [MAILBOX] 标记触发邮箱发现（纯剧情驱动，不硬编码轮数）
- [x] 邮箱按钮出现时隐藏普通选项（不竞争）
- [x] 信纸 modal（旧纸质感，红印章，手写字体风格）
- [x] 2077年林深通信（独立 /api/letter，基于完整历史生成）
- [x] 回信功能（textarea，寄出后 AI 自动续叙述）
- [x] 关闭信件后自动续叙述
- [x] 信匣（📜图标，按时间倒序回看所有信件，信纸质感）
- [x] 后续来信：回信后每5轮对话触发新信

### 场景图系统
- [x] 4张预生成角色场景 webp（~250KB/张，无需等待API）
- [x] AI [SCENE:描述] 标记触发动态换图（任意地点，不受枚举限制）
- [x] 关键词兜底匹配（8个高频地点预设prompt）
- [x] 标记从显示内容中清除（玩家看不到）

### 视觉设计
- [x] 画卷式布局：场景图 fixed 顶部，文字浮于图片之上
- [x] 文字区 CSS mask 淡出（15%→30%），滚到图片区域时自然消融
- [x] 半透明紧凑顶部bar（backdrop-blur，显示位置/身份/次数/信匣）
- [x] 无气泡纯文字排版（AI叙述左对齐 amber-100，玩家话右对齐 amber-500）
- [x] 敦煌暖金色调（amber/stone 色系）
- [x] 首页全屏背景图（Agnes生成，webp 246KB）+ slow zoom + 浮动微粒 + staggered fade-in

### 基础设施
- [x] PWA manifest（standalone，深色主题）
- [x] 唐三彩邮箱 app icon（favicon 16/32 + apple-touch 180 + PWA 192/512）
- [x] 字体：Noto Serif SC（next/font/google 本地化）
- [x] 每日10次行动限制
- [x] Agnes API key 通过 Vercel env vars 管理

---

## 已知问题 / 待优化

### Bug
- [ ] 信件重复触发：偶发，需要更严格的 unreadLetters 状态管理
- [ ] AI 偶尔在叙述中写出信件内容（prompt 规则需强化）

### 待做功能
- [ ] 视频生成（Agnes video API，作为"回忆"功能主动触发）
- [ ] 因果交叉系统（信中线索影响长安世界）
- [ ] 第二条书信线（新的时代/通信人）
- [ ] NPC 记忆系统完善（关系值持久化）
- [ ] 分享卡片生成（截图/canvas → 可发朋友圈）
- [ ] 付费层（解锁额外书信线/存档点/月卡）
- [ ] 用户系统（登录/云存档）

### Barlow 三阶段规划（2026-06-04 确认）

**Phase 1 — 植入钩子（本周 06-04~06-08）**
- [ ] 重写林深第一封信 prompt：必须包含一个"他不应该知道的细节"（如"你住的客栈，700年后还在。只是地下多了一层。"）
- [ ] 李无名（算命先生）加隐含线索：他似乎知道邮箱的存在
- [ ] 王掌柜无意中说一句话，和林深信里的内容产生矛盾
- [ ] 林深第三封信开始加入不可靠性（说法和NPC矛盾，玩家需判断谁在说谎）

**Phase 2 — 因果链（下周 06-09~06-15）**
- [ ] 玩家回信内容 → 影响长安NPC对话（不只影响下封信）
- [ ] 信中提到的地点/人名 → 可在长安找到对应物
- [ ] 长安事件 → 下封信里林深提到"你做的那件事，在我们这个时代还有回响"

**Phase 3 — 第二条书信线（06-16~06-22）**
- [ ] 新时代通信人（宋代临安 / 1945 / 待定）
- [ ] 两个通信人说的事情互相矛盾
- [ ] 玩家在三条线（长安+2077+新时代）的碎片中拼出真相

**核心原则：不加新功能，用"对话+信件"两个机制把深度做出来。**

---

## 专家系统
- **Sam Barlow**（第20位，2026-06-04）：互动叙事/碎片化信息/悬念设计
  - 路由触发：互动叙事/碎片信息/信件节奏/跨时空结构
  - 完整文件：experts/barlow/（core/thinking/principles/biography/user）

---

## Git 提交历史（2026-06-04）

1. feat: Letters from Chang'an — AI互动叙事游戏MVP
2. fix: lazy init OpenAI client
3. feat: Phase 2-4 — scene images, letter async, action limits
4. fix: use correct Agnes model names (agnes-2.0-flash)
5. fix: 6 issues — fixed opening, image-as-bg, scene triggers, letter dedup, mailbox timing
6. feat: letter box (信匣)
7. feat: immersive start screen — Agnes bg image, slow zoom, floating particles
8. perf: bg image jpg→webp (3.4MB→246KB)
9. feat: app icon — Tang Sancai mailbox favicon + apple-touch + PWA manifest
10. feat: cinematic prologue — 5s intro + typewriter opening
11. fix: prologue fixed 5.7s, force mailbox at 3rd interaction
12. redesign: remove bubbles/bar, literary text layout, pre-gen 4 scene webps
13. fix: restore header bar (translucent) + input box, location-based scene triggers
14. feat: AI-driven scene tags [SCENE:...] for dynamic image generation
15. fix: mailbox via AI [MAILBOX] tag only
16. fix: mailbox auto-opens letter modal
17. fix: fonts via next/font/google
18. fix: remove Ma Shan Zheng, use Noto Serif SC bold
19. redesign: scroll-over-image layout, compact header
20. tweak: text fade mask adjustments (→15%-30%)
21. feat: mailbox replaces options, auto-continue narration after letter
22. fix: tag cleanup, user text color, always continue after letter close
