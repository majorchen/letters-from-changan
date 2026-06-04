import { NextRequest } from 'next/server';
import OpenAI from 'openai';
import { LETTER_WRITER_PROMPT } from '@/lib/prompts';

export const maxDuration = 60;

type LetterItem = {
  from: string;
  content: string;
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

const FALLBACK_FIRST_LETTER = `陌生的收信人：

我不知道这封信会不会抵达你手里。过去很久，我把许多纸片投进这个旧邮箱，只听见它们落下去的声音，从没有回响。

如果你真的能读到它，请不要害怕。我来自很远的地方，远到连我自己也说不清该怎样解释。奇怪的是，我好像知道你住的那间客栈——许多年后，它还在，只是地下多了一层。

你那里的夜晚，会不会也有人在街上打更？你看见长安的灯时，会想起谁？

林深`;

export async function POST(req: NextRequest) {
  if (!process.env.AGNES_API_KEY) {
    return Response.json({ error: 'Missing AGNES_API_KEY' }, { status: 500 });
  }

  const { playerReply, letterHistory } = await req.json();
  const cleanedHistory = cleanLetterHistory(letterHistory);
  const cleanedReply = typeof playerReply === 'string' ? playerReply.slice(0, 1200) : null;
  const linShenLetterCount = cleanedHistory.filter((letter) => letter.from === 'linShen').length;
  const nextLetterNumber = linShenLetterCount + 1;

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

  if (cleanedReply) {
    messages.push({
      role: 'user',
      content: `${cleanedReply}\n\n${getLetterArcInstruction(nextLetterNumber)} 请写林深的下一封回信。`,
    });
  } else if (cleanedHistory.length > 0) {
    messages.push({
      role: 'user',
      content: `请根据以上完整通信历史，写林深的下一封回信。${getLetterArcInstruction(nextLetterNumber)} 必须回应玩家最近一封信里的具体内容，不要重复之前已经写过的信，不要重新写第一封信。`,
    });
  } else {
    messages.push({ role: 'user', content: `${getLetterArcInstruction(nextLetterNumber)} 请写第一封信给这位刚到长安的外乡人。` });
  }

  try {
    const response = await getClient().chat.completions.create({
      model: 'agnes-2.0-flash',
      messages,
      temperature: 0.9,
      max_tokens: 400,
    });

    const content = response.choices[0]?.message?.content || '';
    return Response.json({ content });
  } catch (err) {
    if (!cleanedReply && cleanedHistory.length === 0) {
      return Response.json({ content: FALLBACK_FIRST_LETTER, fallback: true });
    }
    return Response.json({ error: String(err) }, { status: 500 });
  }
}
