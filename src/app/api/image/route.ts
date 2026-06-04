import { NextRequest } from 'next/server';
import OpenAI from 'openai';
import { IMAGE_PROMPT_SUFFIX } from '@/lib/prompts';

export const maxDuration = 60;

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

  const { scene } = await req.json();
  const cleanedScene = typeof scene === 'string' ? scene.slice(0, 1200).trim() : '';
  if (!cleanedScene) {
    return Response.json({ error: 'Missing scene' }, { status: 400 });
  }

  // Avoid double-applying the style suffix if caller already included it
  const prompt = cleanedScene.includes('aged silk') ? cleanedScene : `${cleanedScene}. ${IMAGE_PROMPT_SUFFIX}`;

  try {
    // Agnes image API supports 1024x768 / 1024x1024 / 768x1024 only (NOT 1792x1024).
    // 2.0-flash verified stable; 2.1 was unstable (520 errors).
    const response = await getClient().images.generate({
      model: 'agnes-image-2.0-flash',
      prompt,
      size: '1024x768',
    });

    const url = response.data?.[0]?.url || '';
    return Response.json({ url });
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 });
  }
}
