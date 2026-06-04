import { NextRequest } from 'next/server';
import OpenAI from 'openai';
import { IMAGE_PROMPT_SUFFIX } from '@/lib/prompts';

function getClient() {
  return new OpenAI({
    apiKey: process.env.AGNES_API_KEY || '',
    baseURL: process.env.AGNES_API_URL || 'https://apihub.agnes-ai.com/v1',
  });
}

export async function POST(req: NextRequest) {
  const { scene } = await req.json();

  const prompt = `${scene}. ${IMAGE_PROMPT_SUFFIX}`;

  try {
    const response = await getClient().images.generate({
      model: 'agnes-image-2.1-flash',
      prompt,
      n: 1,
      size: '1792x1024',
    });

    const url = response.data?.[0]?.url || '';
    return Response.json({ url });
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 });
  }
}
