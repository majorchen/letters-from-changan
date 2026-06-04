# 来信长安

AI 驱动的盛唐长安跨时空书信叙事游戏。

玩家以商人、乐师、游侠或书生的身份进入公元 742 年的长安，在市井、客栈、酒肆与陌生人之间游走。某个夜晚，一只像唐三彩陶器的信匣开始发光，来自 2077 年的林深把第一封信投向了这个时代。

线上版本：https://letters-from-changan.vercel.app

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
```

## 验证

```bash
npm run lint
npm run build
```

## 路线图

- 结构化叙事状态协议：把地点、NPC、事件、邮箱状态从正文解析中拆出来。
- 邮箱状态机：稳定处理首次发现、未读来信、后续回信与重复触发。
- Barlow Phase 1：植入不可靠信息、跨时空矛盾与早期悬念钩子。
- NPC 记忆与因果链：让玩家回信和对话选择影响长安世界。
- 云存档与账号体系：支持跨设备继续旅程。
