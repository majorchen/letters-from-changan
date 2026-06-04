import { NextRequest } from 'next/server';
import OpenAI from 'openai';
import { LETTER_WRITER_PROMPT } from '@/lib/prompts';

function getClient() {
  return new OpenAI({
    apiKey: process.env.AGNES_API_KEY || '',
    baseURL: process.env.AGNES_API_URL || 'https://apihub.agnes-ai.com/v1',
  });
}

export async function POST(req: NextRequest) {
  const { playerReply, letterHistory } = await req.json();

  const messages: { role: 'system' | 'user' | 'assistant'; content: string }[] = [
    { role: 'system', content: LETTER_WRITER_PROMPT },
  ];

  if (letterHistory && letterHistory.length > 0) {
    for (const letter of letterHistory) {
      messages.push({
        role: letter.from === 'linShen' ? 'assistant' : 'user',
        content: letter.content,
      });
    }
  }

  if (playerReply) {
    messages.push({ role: 'user', content: playerReply });
  } else {
    messages.push({ role: 'user', content: '请写第一封信给这位刚到长安的外乡人。' });
  }

  try {
    const response = await getClient().chat.completions.create({
      model: 'gpt-4o',
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
