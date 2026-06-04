import { NextRequest } from 'next/server';
import OpenAI from 'openai';
import { LETTER_WRITER_PROMPT } from '@/lib/prompts';

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

export async function POST(req: NextRequest) {
  if (!process.env.AGNES_API_KEY) {
    return Response.json({ error: 'Missing AGNES_API_KEY' }, { status: 500 });
  }

  const { playerReply, letterHistory } = await req.json();
  const cleanedHistory = cleanLetterHistory(letterHistory);
  const cleanedReply = typeof playerReply === 'string' ? playerReply.slice(0, 1200) : null;

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
    messages.push({ role: 'user', content: cleanedReply });
  } else {
    messages.push({ role: 'user', content: '请写第一封信给这位刚到长安的外乡人。' });
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
    return Response.json({ error: String(err) }, { status: 500 });
  }
}
