import { NextRequest } from 'next/server';
import OpenAI from 'openai';
import { PlayerState, ROLES } from '@/lib/prompts';

export const maxDuration = 60;

const client = new OpenAI({
  apiKey: process.env.AGNES_API_KEY || '',
  baseURL: process.env.AGNES_API_URL || 'https://apihub.agnes-ai.com/v1',
});

type EndingPayload = {
  title: string;
  scenes: string[];
};

function parseEnding(raw: string, state: PlayerState): EndingPayload {
  try {
    const json = raw.match(/\{[\s\S]*\}/)?.[0] || raw;
    const parsed = JSON.parse(json) as Partial<EndingPayload>;
    const scenes = Array.isArray(parsed.scenes)
      ? parsed.scenes.filter((item): item is string => typeof item === 'string' && item.trim().length > 0).slice(0, 6)
      : [];
    if (scenes.length >= 4) {
      return { title: parsed.title?.trim() || '故事落幕', scenes };
    }
  } catch {
    // Use the deterministic fallback below.
  }
  const role = ROLES[state.role]?.name || '旅人';
  const summary = state.narrativeSummary || '你在长安走过的路，已经悄悄改变了两端的时间。';
  return {
    title: '故事落幕',
    scenes: [
      `长安的灯火仍在风里摇晃。作为${role}的你回望来路，终于明白，那些看似偶然的相遇都留下了回声。`,
      `${summary}这段经历没有给出一个整齐的答案，却让你知道自己为何作出最后的选择。`,
      '林深的字迹停在最后一页。隔着一千三百多年的时间，你们都曾因为另一个人的存在，重新相信真实的连接。',
      '天将亮时，信匣的金光慢慢暗下去。长安继续醒来，街市、马蹄与炊烟都像往常一样，而你已经不再是初到城门外的那个人。',
    ],
  };
}

export async function POST(req: NextRequest) {
  if (!process.env.AGNES_API_KEY) {
    return Response.json({ error: 'Missing AGNES_API_KEY' }, { status: 500 });
  }
  const { playerState, recentMessages } = await req.json() as {
    playerState?: PlayerState;
    recentMessages?: { role?: string; content?: string }[];
  };
  if (!playerState?.role) return Response.json({ error: 'Invalid playerState' }, { status: 400 });
  const context = (recentMessages || [])
    .slice(-12)
    .map((message) => `${message.role}: ${String(message.content || '').slice(0, 500)}`)
    .join('\n');
  const prompt = `为互动叙事游戏《来信长安》写最终落幕。玩家身份：${ROLES[playerState.role]?.name || playerState.role}。地点：${playerState.location}。叙事摘要：${playerState.narrativeSummary}。关键事件：${(playerState.events || []).slice(-12).join('、')}。林深往来信件数：${(playerState.letterHistory || []).filter((letter) => letter.from === 'linShen').length}。
最近剧情：
${context}

只输出合法 JSON：{"title":"四到八字结局名","scenes":["段落1","段落2","段落3","段落4"]}。scenes 必须有4到6段，每段45到90字。第一段是“故事落幕”的核心摘要，后续依次回应玩家身份、关键选择、林深关系和长安余韵。文学但克制，不解释系统，不写制作人员。`;
  try {
    const response = await client.chat.completions.create({
      model: 'agnes-2.0-flash',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.75,
      max_tokens: 900,
    });
    return Response.json(parseEnding(response.choices[0]?.message?.content || '', playerState));
  } catch {
    return Response.json(parseEnding('', playerState), { status: 200 });
  }
}
