import { NextRequest } from 'next/server';

export const maxDuration = 60;

type AgnesVideoCreateResponse = {
  id?: string;
  task_id?: string;
  status?: string;
  url?: string;
  video_url?: string;
  remixed_from_video_id?: string;
  progress?: number;
  data?: {
    id?: string;
    task_id?: string;
    status?: string;
    url?: string;
    video_url?: string;
    remixed_from_video_id?: string;
    progress?: number;
  };
};

type AgnesVideoStatusResponse = AgnesVideoCreateResponse & {
  output?: string | { url?: string; video_url?: string };
};

type VideoRequestBody = {
  prompt?: unknown;
  width?: unknown;
  height?: unknown;
  num_frames?: unknown;
  frame_rate?: unknown;
  numFrames?: unknown;
  frameRate?: unknown;
  referenceImage?: unknown;
  image?: unknown;
};

const DEFAULT_VIDEO_MODEL = 'agnes-video-v2.0';
const DEFAULT_WIDTH = 1152;
const DEFAULT_HEIGHT = 768;
const DEFAULT_NUM_FRAMES = 121;
const DEFAULT_FRAME_RATE = 24;

function getBaseUrl(): string {
  return (process.env.AGNES_API_URL || 'https://apihub.agnes-ai.com/v1').replace(/\/$/, '');
}

function getVideoModel(): string {
  return process.env.AGNES_VIDEO_MODEL || DEFAULT_VIDEO_MODEL;
}

function getHeaders(): HeadersInit {
  return {
    Authorization: `Bearer ${process.env.AGNES_API_KEY || ''}`,
    'Content-Type': 'application/json',
  };
}

function extractTaskId(data: AgnesVideoCreateResponse): string {
  return data.task_id || data.id || data.data?.task_id || data.data?.id || '';
}

function extractVideoUrl(data: AgnesVideoStatusResponse): string {
  if (typeof data.output === 'string') return data.output;
  return data.remixed_from_video_id
    || data.video_url
    || data.url
    || data.data?.remixed_from_video_id
    || data.data?.video_url
    || data.data?.url
    || data.output?.video_url
    || data.output?.url
    || '';
}

export async function POST(req: NextRequest) {
  if (!process.env.AGNES_API_KEY) {
    return Response.json({ error: 'Missing AGNES_API_KEY' }, { status: 500 });
  }

  const payload = await req.json() as VideoRequestBody;
  const { prompt } = payload;
  const cleanedPrompt = typeof prompt === 'string' ? prompt.slice(0, 1600).trim() : '';
  if (!cleanedPrompt) {
    return Response.json({ error: 'Missing prompt' }, { status: 400 });
  }

  const body: Record<string, unknown> = {
    model: getVideoModel(),
    prompt: cleanedPrompt,
    width: DEFAULT_WIDTH,
    height: DEFAULT_HEIGHT,
    num_frames: DEFAULT_NUM_FRAMES,
    frame_rate: DEFAULT_FRAME_RATE,
  };

  const width = Number(payload.width);
  const height = Number(payload.height);
  const numFrames = Number(payload.num_frames ?? payload.numFrames);
  const frameRate = Number(payload.frame_rate ?? payload.frameRate);
  const image = payload.image ?? payload.referenceImage;

  if (Number.isFinite(width)) {
    body.width = Math.max(64, Math.floor(width / 64) * 64);
  }
  if (Number.isFinite(height)) {
    body.height = Math.max(64, Math.floor(height / 64) * 64);
  }
  if (Number.isFinite(numFrames)) {
    body.num_frames = Math.max(9, Math.floor(numFrames));
  }
  if (Number.isFinite(frameRate)) {
    body.frame_rate = Math.min(Math.max(Math.floor(frameRate), 8), 30);
  }
  if (typeof image === 'string' && image.startsWith('http')) {
    body.image = image.slice(0, 2000);
  }

  try {
    const response = await fetch(`${getBaseUrl()}/videos`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(body),
    });
    const data = await response.json().catch(async () => ({ error: await response.text() })) as AgnesVideoCreateResponse;
    if (!response.ok) {
      return Response.json({ error: data }, { status: response.status });
    }
    return Response.json({
      taskId: extractTaskId(data),
      status: data.status || data.data?.status || 'queued',
      progress: data.progress ?? data.data?.progress ?? 0,
      url: extractVideoUrl(data),
      raw: data,
    });
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  if (!process.env.AGNES_API_KEY) {
    return Response.json({ error: 'Missing AGNES_API_KEY' }, { status: 500 });
  }

  const taskId = req.nextUrl.searchParams.get('taskId') || req.nextUrl.searchParams.get('id');
  if (!taskId) {
    return Response.json({ error: 'Missing taskId' }, { status: 400 });
  }

  try {
    const response = await fetch(`${getBaseUrl()}/videos/${encodeURIComponent(taskId)}`, {
      method: 'GET',
      headers: getHeaders(),
    });
    const data = await response.json().catch(async () => ({ error: await response.text() })) as AgnesVideoStatusResponse;
    if (!response.ok) {
      return Response.json({ error: data }, { status: response.status });
    }
    return Response.json({
      taskId,
      status: data.status || data.data?.status || 'unknown',
      progress: data.progress ?? data.data?.progress ?? 0,
      url: extractVideoUrl(data),
      raw: data,
    });
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 });
  }
}
