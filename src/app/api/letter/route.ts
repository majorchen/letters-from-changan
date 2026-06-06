import { NextRequest } from 'next/server';
import OpenAI from 'openai';
import { LETTER_WRITER_PROMPT, IMAGE_STYLE_PREFIX, IMAGE_CONSTRAINT_SUFFIX } from '@/lib/prompts';

export const maxDuration = 60;

type LetterItem = {
  from: string;
  content: string;
};

type LetterPlayerContext = {
  role?: string;
  location?: string;
  chapter?: string;
  events?: string[];
  knownNPCs?: string[];
  narrativeSummary?: string;
  eventVersions?: Record<string, Record<string, string>>;
  crossLineEchoes?: string[];
  secondCorrespondentHints?: string[];
};

function cleanLetterHistory(value: unknown): LetterItem[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((letter): letter is LetterItem => {
      if (!letter || typeof letter !== 'object') return false;
      const item = letter as Record<string, unknown>;
      return (item.from === 'linShen' || item.from === 'player') && typeof item.content === 'string';
    })
    .slice(-12)
    .map((letter) => ({
      from: letter.from,
      content: letter.content.slice(0, 1200),
    }));
}

function cleanPlayerContext(value: unknown): LetterPlayerContext {
  if (!value || typeof value !== 'object') return {};
  const state = value as Record<string, unknown>;
  return {
    role: typeof state.role === 'string' ? state.role.slice(0, 40) : undefined,
    location: typeof state.location === 'string' ? state.location.slice(0, 80) : undefined,
    chapter: typeof state.chapter === 'string' ? state.chapter.slice(0, 60) : undefined,
    events: Array.isArray(state.events) ? state.events.filter((item): item is string => typeof item === 'string').slice(-8) : [],
    knownNPCs: Array.isArray(state.knownNPCs) ? state.knownNPCs.filter((item): item is string => typeof item === 'string').slice(-8) : [],
    narrativeSummary: typeof state.narrativeSummary === 'string' ? state.narrativeSummary.slice(0, 280) : undefined,
    eventVersions: state.eventVersions && typeof state.eventVersions === 'object' ? state.eventVersions as Record<string, Record<string, string>> : {},
    crossLineEchoes: Array.isArray(state.crossLineEchoes) ? state.crossLineEchoes.filter((item): item is string => typeof item === 'string').slice(0, 4) : [],
    secondCorrespondentHints: Array.isArray(state.secondCorrespondentHints) ? state.secondCorrespondentHints.filter((item): item is string => typeof item === 'string').slice(-4) : [],
  };
}

function getClient() {
  return new OpenAI({
    apiKey: process.env.AGNES_API_KEY || '',
    baseURL: process.env.AGNES_API_URL || 'https://apihub.agnes-ai.com/v1',
  });
}

function getLetterArcInstruction(letterNumber: number): string {
  if (letterNumber <= 1) {
    return `这是林深写出的第1封信。语气小心翼翼，像害怕吓跑对方。必须包含一个他不应该知道的长安细节，但不要解释来源。`;
  }
  if (letterNumber === 2) {
    return `这是林深写出的第2封信。林深开始相信对方真的存在，语气比第一封更打开。必须回应玩家回信里的一个具体词句，并透露一点2077的日常代价。`;
  }
  if (letterNumber === 3) {
    return `这是林深写出的第3封信。加入轻微不可靠：他提到一个长安细节、地点或人物版本，可能和玩家在长安听到的不完全一致。暗埋"长安不会永远这样"的时间警告，不解释。`;
  }
  if (letterNumber === 4) {
    return `这是林深写出的第4封信。允许出现摩擦：如果玩家上一封信有质疑、冷淡或追问，林深可以短暂防御或不舒服；如果没有，也要露出他藏着秘密的压力。`;
  }
  if (letterNumber === 5) {
    return `这是林深写出的第5封信。写出"隔了很久才写"的沉默感：他差点没有回信。透露他曾失去一个重要的人，但不要说明全貌。`;
  }
  return `这是林深写出的第${letterNumber}封信。林深已经变了：更诚实也更危险。必须承接玩家最近回信，推进一个个人秘密碎片或2077碎片，但仍保留悬念。`;
}

function buildWorldEchoInstruction(context: LetterPlayerContext): string {
  const lines: string[] = [];
  if (context.location) lines.push(`玩家当前在长安的地点：${context.location}`);
  if (context.narrativeSummary) lines.push(`玩家最近经历摘要：${context.narrativeSummary}`);
  if (context.events && context.events.length > 0) lines.push(`长安已发生事件：${context.events.join('、')}`);
  if (context.knownNPCs && context.knownNPCs.length > 0) lines.push(`玩家认识的人：${context.knownNPCs.join('、')}`);
  if (context.crossLineEchoes && context.crossLineEchoes.length > 0) lines.push(`其他角色线回声：${context.crossLineEchoes.join(' / ')}`);
  if (context.secondCorrespondentHints && context.secondCorrespondentHints.length > 0) lines.push(`第二通信人线索：${context.secondCorrespondentHints.join(' / ')}`);
  const versionEntries = Object.entries(context.eventVersions || {}).slice(-4);
  if (versionEntries.length > 0) {
    lines.push(`已记录矛盾版本：${versionEntries.map(([event, sources]) => `${event}(${Object.keys(sources).join('/')})`).join('、')}`);
  }
  if (lines.length === 0) return '';
  return `\n\n## 长安回响\n${lines.join('\n')}\n写信时可以让2077和上述长安事件产生微弱回声：林深可以提到某个后世痕迹、误认一个NPC或对某个事件表现出不该有的熟悉。但不要直接解释真相。`;
}

function getRoleKeyLetterInstruction(context: LetterPlayerContext, letterNumber: number): string {
  if (letterNumber < 3) return '';
  const role = context.role || '';
  const roleGuide: Record<string, string> = {
    merchant: '商人线的2077碎片：经济系统曾高度自动化，后来信用和供应链同时崩塌。林深可以提到价格、债务、合成粮、配给或旧市场遗址。',
    scholar: '书生线的2077碎片：文化记忆出现断层，许多典籍只剩摘要和模型重写版本。林深可以提到他分不清原文与重构文本。',
    wanderer: '游侠线的2077碎片：未来并不和平，城市安全由算法和私人武装共同维持。林深可以提到封锁、身份识别、无人巡逻或消失的人。',
    musician: '乐师线的2077碎片：AI替代了绝大多数创作，真人演奏变成奢侈或违法的怀旧。林深可以提到被自动生成音乐淹没的生活。',
  };
  const guide = roleGuide[role];
  if (!guide) return '';
  return `\n\n## 本线关键信碎片\n${guide}\n第三封信以后，每封信最多露出其中一个碎片。不要像设定说明一样完整解释。`;
}

const FALLBACK_FIRST_LETTER = `陌生的收信人：

我不知道这封信会不会抵达你手里。过去很久，我把许多纸片投进这个旧邮箱，只听见它们落下去的声音，从没有回响。

如果你真的能读到它，请不要害怕。我来自很远的地方，远到连我自己也说不清该怎样解释。奇怪的是，我好像知道你住的那间客栈——许多年后，它还在，只是地下多了一层。

你那里的夜晚，会不会也有人在街上打更？你看见长安的灯时，会想起谁？

林深`;

const FALLBACK_LETTER_SCENES = [
  'Medium shot, slightly high angle. Lin Shen sits alone at a translucent desk, one hand hovering over a glowing ceramic mailbox, head bowed, eyes soft with hesitation. Dim apartment, holographic city lights through rain-streaked window',
  'Wide shot, eye-level. Lin Shen stands by a floor-to-ceiling window, back half-turned, one palm pressed against the glass, watching neon reflections ripple in the rain below. Empty apartment behind him, single warm lamp',
  'Close-up, low angle. Lin Shen crouches beside the ceramic mailbox on a cluttered desk, fingers tracing its rim, brows furrowed with concentration, lips slightly parted. Soft golden glow from the mailbox illuminates his face from below',
];

const LIN_SHEN_VISUAL = 'Character continuity: 林深: A slim Chinese man in his early thirties from 2077, pale tired face, short slightly untidy black hair, dark reflective eyes, plain graphite-grey future jacket with subtle worn seams.';

function buildLetterImagePrompt(sceneDesc: string): string {
  return `${IMAGE_STYLE_PREFIX} ${sceneDesc}. Near-future Chinese city, restrained believable technology. ${LIN_SHEN_VISUAL} ${IMAGE_CONSTRAINT_SUFFIX}`;
}

function fallbackLetterScene(letterNumber: number): string {
  return FALLBACK_LETTER_SCENES[(letterNumber - 1) % FALLBACK_LETTER_SCENES.length];
}

export async function POST(req: NextRequest) {
  if (!process.env.AGNES_API_KEY) {
    return Response.json({ error: 'Missing AGNES_API_KEY' }, { status: 500 });
  }

  const { playerReply, letterHistory, playerState } = await req.json();
  const cleanedHistory = cleanLetterHistory(letterHistory);
  const cleanedReply = typeof playerReply === 'string' ? playerReply.slice(0, 1200) : null;
  const linShenLetterCount = cleanedHistory.filter((letter) => letter.from === 'linShen').length;
  const nextLetterNumber = linShenLetterCount + 1;
  const playerContext = cleanPlayerContext(playerState);
  const worldEchoInstruction = buildWorldEchoInstruction(playerContext);
  const keyLetterInstruction = getRoleKeyLetterInstruction(playerContext, nextLetterNumber);

  const messages: { role: 'system' | 'user' | 'assistant'; content: string }[] = [
    { role: 'system', content: LETTER_WRITER_PROMPT },
  ];

  if (cleanedHistory.length > 0) {
    for (const letter of cleanedHistory) {
      messages.push({
        role: letter.from === 'linShen' ? 'assistant' : 'user',
        content: letter.content,
      });
    }
  }

  const sceneInstruction = `\n\n写完信件正文后，另起一行输出配图标记：\n[LETTER_SCENE:shot type(close-up/medium/wide) + camera angle + Lin Shen's specific action and facial expression matching this letter's emotional tone + gaze direction(NOT looking at camera) + 2077 environment detail + lighting. 60 words max, English]`;

  if (cleanedReply) {
    messages.push({
      role: 'user',
      content: `${cleanedReply}\n\n${getLetterArcInstruction(nextLetterNumber)}${worldEchoInstruction}${keyLetterInstruction} 请写林深的下一封回信。${sceneInstruction}`,
    });
  } else if (cleanedHistory.length > 0) {
    messages.push({
      role: 'user',
      content: `请根据以上完整通信历史，让林深在一段沉默后主动写来下一封信。${getLetterArcInstruction(nextLetterNumber)}${worldEchoInstruction}${keyLetterInstruction} 可以承接玩家最近一封回信里的具体内容，也可以主动报告2077刚发生的一件小事或追问长安近况。不要假装玩家刚刚又回了信，不要重复之前已经写过的信，不要重新写第一封信。${sceneInstruction}`,
    });
  } else {
    messages.push({ role: 'user', content: `${getLetterArcInstruction(nextLetterNumber)}${worldEchoInstruction}${keyLetterInstruction} 请写第一封信给这位刚到长安的外乡人。${sceneInstruction}` });
  }

  try {
    const response = await getClient().chat.completions.create({
      model: 'agnes-2.0-flash',
      messages,
      temperature: 0.9,
      max_tokens: 400,
    });

    const rawContent = response.choices[0]?.message?.content || '';
    const sceneMatch = rawContent.match(/\[LETTER_SCENE:([^\]]+)\]/i);
    const content = rawContent.replace(/\[LETTER_SCENE:[^\]]+\]/i, '').trim();
    const sceneDesc = sceneMatch?.[1]?.trim() || fallbackLetterScene(nextLetterNumber);
    const imagePrompt = buildLetterImagePrompt(sceneDesc);
    return Response.json({ content, imagePrompt });
  } catch (err) {
    if (!cleanedReply && cleanedHistory.length === 0) {
      const imagePrompt = buildLetterImagePrompt(fallbackLetterScene(1));
      return Response.json({
        content: FALLBACK_FIRST_LETTER,
        imagePrompt,
        fallback: true,
      });
    }
    return Response.json({ error: String(err) }, { status: 500 });
  }
}
