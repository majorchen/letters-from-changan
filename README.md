# 来信长安

AI 驱动的盛唐长安跨时空书信叙事游戏。

玩家以商人、乐师、游侠或书生的身份进入公元 742 年的长安，在市井、客栈、酒肆与陌生人之间游走。某个夜晚，一只像唐三彩陶器的信匣开始发光，来自 2077 年的林深把第一封信投向了这个时代。

线上版本：https://letterstang.aifisher.cn

## 当前玩法

- 选择身份进入不同开场。
- 与 AI 叙事者对话，探索长安地点和 NPC。
- 每轮对话生成行动选项与场景画面。
- 通过信匣与 2077 年的林深通信。
- 多旅程存档保存在当前浏览器，可在首页继续选择。

## 技术栈

- Next.js 16
- React 19
- TypeScript
- Tailwind CSS 4
- Agnes API
  - `agnes-2.0-flash`：叙事与书信
  - `agnes-image-2.0-flash`：场景图
  - `agnes-video-v2.0`：视频事件基础封装
- Vercel 自动部署
- `localStorage` 本地存档

## 本地开发

```bash
npm install
npm run dev
```

需要在本地环境中配置：

```bash
AGNES_API_KEY=...
AGNES_API_URL=...
AGNES_VIDEO_MODEL=agnes-video-v2.0
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
```

Supabase 未配置时，游戏会自动回退为纯本地存档。

## 验证

```bash
npm run lint
npm run build
npm run mechanics:audit
npm run roadmap:audit
npm run smoke:chat
npm run smoke:letter
```

`smoke:*` 脚本默认需要一个可访问的本地或线上服务，可通过 `SMOKE_BASE_URL` 指定。

## 路线图

- 结构化叙事状态协议：把地点、NPC、事件、邮箱状态从正文解析中拆出来。
- 邮箱状态机：稳定处理首次发现、未读来信、后续回信与重复触发。
- Barlow Phase 1：植入不可靠信息、跨时空矛盾与早期悬念钩子。
- NPC 记忆与因果链：让玩家回信和对话选择影响长安世界。
- 云存档与账号体系：支持跨设备继续旅程。

## 设计与后续计划

- [docs/PLAYTEST_ACCEPTANCE.md](docs/PLAYTEST_ACCEPTANCE.md)：长线试玩、啊哈时刻和人工反馈的验收标准。
- [docs/CLOUD_SAVE_PLAN.md](docs/CLOUD_SAVE_PLAN.md)：账号与云存档接入方案。
- [docs/VIDEO_PIPELINE_PLAN.md](docs/VIDEO_PIPELINE_PLAN.md)：Agnes video、缓存与结局视频管线。
- [docs/WEEKEND_LAUNCH_CHECKLIST.md](docs/WEEKEND_LAUNCH_CHECKLIST.md)：Supabase、Vercel 和周末试玩上线清单。
