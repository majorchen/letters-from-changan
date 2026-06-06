import { NextRequest } from 'next/server';
import { IMAGE_PROMPT_SUFFIX } from '@/lib/prompts';

export const maxDuration = 60;

type AgnesImageResponse = {
  data?: Array<{ url?: string }>;
  error?: unknown;
};

async function generateImage(model: string, prompt: string): Promise<AgnesImageResponse> {
  const baseUrl = (process.env.AGNES_API_URL || 'https://apihub.agnes-ai.com/v1').replace(/\/$/, '');
  const response = await fetch(`${baseUrl}/images/generations`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.AGNES_API_KEY || ''}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      prompt,
      size: '1024x768',
      extra_body: {
        response_format: 'url',
      },
    }),
  });
  const data = await response.json() as AgnesImageResponse;
  if (!response.ok) throw new Error(`${model}: ${JSON.stringify(data.error || data)}`);
  if (!data.data?.[0]?.url) throw new Error(`${model}: response did not contain data[0].url`);
  return data;
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
    let response;
    try {
      response = await generateImage('agnes-image-2.0-flash', prompt);
    } catch (error) {
      console.warn('[image-generation] Agnes Image 2.0 failed, retrying', error);
      response = await generateImage('agnes-image-2.0-flash', prompt);
    }

    const url = response.data?.[0]?.url || '';
    return Response.json({ url });
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 });
  }
}
