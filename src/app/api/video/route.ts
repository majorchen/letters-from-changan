import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const maxDuration = 60;

type AgnesVideoCreateResponse = {
  id?: string;
  task_id?: string;
  video_id?: string;
  status?: string;
  url?: string;
  video_url?: string;
  remixed_from_video_id?: string;
  progress?: number;
  data?: {
    id?: string;
    task_id?: string;
    video_id?: string;
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
  key?: unknown;
  type?: unknown;
  segmentIndex?: unknown;
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
const VIDEO_BUCKET = 'story-videos';

function getBaseUrl(): string {
  return (process.env.AGNES_API_URL || 'https://apihub.agnes-ai.com/v1').replace(/\/$/, '');
}

function getGatewayOrigin(): string {
  return getBaseUrl().replace(/\/v1$/, '');
}

function getVideoModel(): string {
  return process.env.AGNES_VIDEO_MODEL || DEFAULT_VIDEO_MODEL;
}

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return null;
  return createClient(url, serviceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
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

function extractVideoId(data: AgnesVideoCreateResponse): string {
  return data.video_id || data.data?.video_id || '';
}

function extractVideoUrl(data: AgnesVideoStatusResponse): string {
  const candidates = [
    typeof data.output === 'string' ? data.output : '',
    data.video_url,
    data.url,
    data.data?.video_url,
    data.data?.url,
    data.remixed_from_video_id,
    data.data?.remixed_from_video_id,
    data.output && typeof data.output === 'object' ? data.output.video_url : '',
    data.output && typeof data.output === 'object' ? data.output.url : '',
  ];
  return candidates.find((item) => typeof item === 'string' && item.startsWith('http')) || '';
}

function normalizeVideoResponse(value: unknown): AgnesVideoStatusResponse {
  if (Array.isArray(value)) {
    return normalizeVideoResponse(value[0]);
  }
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    if (Array.isArray(record.data)) {
      return {
        ...(record as AgnesVideoStatusResponse),
        data: normalizeVideoResponse(record.data[0]),
      };
    }
    return record as AgnesVideoStatusResponse;
  }
  return {};
}

function cleanAssetKey(value: unknown, fallback: string): string {
  const raw = typeof value === 'string' ? value : fallback;
  return raw
    .replace(/[^a-zA-Z0-9:._-]+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 180) || fallback;
}

async function findStoredAsset(key: string) {
  const supabase = getSupabaseAdmin();
  if (!supabase) return null;
  const { data } = await supabase
    .from('video_assets')
    .select('key,type,status,prompt,task_id,video_id,public_url,segment_index,created_at,updated_at')
    .eq('key', key)
    .eq('status', 'ready')
    .maybeSingle();
  return data;
}

async function persistVideoAsset(params: {
  key: string;
  type: string;
  prompt: string;
  taskId?: string;
  videoId?: string;
  sourceUrl: string;
  segmentIndex: number;
}) {
  const supabase = getSupabaseAdmin();
  if (!supabase || !params.sourceUrl) return { publicUrl: params.sourceUrl, persisted: false };

  const existing = await findStoredAsset(params.key);
  if (existing?.public_url) return { publicUrl: existing.public_url as string, persisted: true };

  const videoResponse = await fetch(params.sourceUrl);
  if (!videoResponse.ok) return { publicUrl: params.sourceUrl, persisted: false };
  const contentType = videoResponse.headers.get('content-type') || 'video/mp4';
  const ext = contentType.includes('webm') ? 'webm' : contentType.includes('quicktime') ? 'mov' : 'mp4';
  const bytes = await videoResponse.arrayBuffer();
  const storagePath = `${params.type}/${params.key}.${ext}`;
  const { error: uploadError } = await supabase.storage
    .from(VIDEO_BUCKET)
    .upload(storagePath, bytes, {
      contentType,
      upsert: true,
    });
  if (uploadError) return { publicUrl: params.sourceUrl, persisted: false };

  const { data } = supabase.storage.from(VIDEO_BUCKET).getPublicUrl(storagePath);
  const publicUrl = data.publicUrl;
  const now = Date.now();
  await supabase
    .from('video_assets')
    .upsert({
      key: params.key,
      type: params.type,
      status: 'ready',
      prompt: params.prompt,
      task_id: params.taskId || null,
      video_id: params.videoId || null,
      source_url: params.sourceUrl,
      storage_path: storagePath,
      public_url: publicUrl,
      segment_index: params.segmentIndex,
      created_at: now,
      updated_at: now,
    }, { onConflict: 'key' });

  return { publicUrl, persisted: true };
}

async function persistQueuedAsset(params: {
  key: string;
  type: string;
  prompt: string;
  taskId?: string;
  videoId?: string;
  segmentIndex: number;
}) {
  const supabase = getSupabaseAdmin();
  if (!supabase) return;
  const now = Date.now();
  await supabase.from('video_assets').upsert({
    key: params.key,
    type: params.type,
    status: 'queued',
    prompt: params.prompt,
    task_id: params.taskId || null,
    video_id: params.videoId || null,
    segment_index: params.segmentIndex,
    created_at: now,
    updated_at: now,
  }, { onConflict: 'key' });
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
  const assetKey = cleanAssetKey(payload.key, `video:${Date.now()}`);
  const eventType = payload.type === 'letter' || payload.type === 'glitch' || payload.type === 'memory' || payload.type === 'ending'
    ? payload.type
    : 'letter';
  const segmentIndex = Number.isFinite(Number(payload.segmentIndex)) ? Math.max(0, Math.floor(Number(payload.segmentIndex))) : 0;

  const stored = await findStoredAsset(assetKey);
  if (stored?.public_url) {
    return Response.json({
      taskId: stored.task_id || '',
      videoId: stored.video_id || '',
      status: 'ready',
      progress: 1,
      url: stored.public_url,
      persisted: true,
      raw: stored,
    });
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
    const data = normalizeVideoResponse(await response.json().catch(async () => ({ error: await response.text() })));
    if (!response.ok) {
      return Response.json({ error: data }, { status: response.status });
    }
    const sourceUrl = extractVideoUrl(data);
    const taskId = extractTaskId(data);
    const videoId = extractVideoId(data);
    if (!sourceUrl) {
      await persistQueuedAsset({
        key: assetKey,
        type: eventType,
        prompt: cleanedPrompt,
        taskId,
        videoId,
        segmentIndex,
      });
    }
    const persisted = sourceUrl
      ? await persistVideoAsset({
        key: assetKey,
        type: eventType,
        prompt: cleanedPrompt,
        taskId,
        videoId,
        sourceUrl,
        segmentIndex,
      })
      : { publicUrl: sourceUrl, persisted: false };
    return Response.json({
      taskId,
      videoId,
      status: data.status || data.data?.status || 'queued',
      progress: data.progress ?? data.data?.progress ?? 0,
      url: persisted.publicUrl,
      key: assetKey,
      type: eventType,
      segmentIndex,
      persisted: persisted.persisted,
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
  const videoId = req.nextUrl.searchParams.get('videoId') || '';
  const assetKey = cleanAssetKey(req.nextUrl.searchParams.get('key'), taskId || `video:${Date.now()}`);
  const eventType = req.nextUrl.searchParams.get('type') || 'memory';
  const prompt = req.nextUrl.searchParams.get('prompt') || '';
  const segmentIndex = Number.isFinite(Number(req.nextUrl.searchParams.get('segmentIndex')))
    ? Math.max(0, Math.floor(Number(req.nextUrl.searchParams.get('segmentIndex'))))
    : 0;
  const stored = await findStoredAsset(assetKey);
  if (stored?.public_url) {
    return Response.json({
      taskId: stored.task_id || taskId || '',
      videoId: stored.video_id || videoId || '',
      status: 'ready',
      progress: 1,
      url: stored.public_url,
      persisted: true,
      raw: stored,
    });
  }
  if (!taskId && !videoId) {
    return Response.json({ error: 'Missing videoId or taskId' }, { status: 400 });
  }

  try {
    let response = videoId
      ? await fetch(`${getGatewayOrigin()}/agnesapi?video_id=${encodeURIComponent(videoId)}&model_name=${encodeURIComponent(getVideoModel())}`, {
        method: 'GET',
        headers: getHeaders(),
      })
      : null;
    if ((!response || !response.ok) && taskId) {
      response = await fetch(`${getBaseUrl()}/videos/${encodeURIComponent(taskId)}`, {
        method: 'GET',
        headers: getHeaders(),
      });
    }
    if (!response) {
      return Response.json({ error: 'Unable to query video task' }, { status: 502 });
    }
    const data = normalizeVideoResponse(await response.json().catch(async () => ({ error: await response.text() })));
    if (!response.ok) {
      return Response.json({ error: data }, { status: response.status });
    }
    const status = data.status || data.data?.status || 'unknown';
    const sourceUrl = extractVideoUrl(data);
    const done = sourceUrl && (
      sourceUrl.startsWith('http')
      || ['succeeded', 'completed', 'success', 'ready'].includes(String(status).toLowerCase())
    );
    const persisted = done
      ? await persistVideoAsset({
        key: assetKey,
        type: eventType,
        prompt,
        taskId: taskId || extractTaskId(data),
        videoId: videoId || extractVideoId(data),
        sourceUrl,
        segmentIndex,
      })
      : { publicUrl: sourceUrl, persisted: false };

    return Response.json({
      taskId: taskId || extractTaskId(data),
      videoId: videoId || extractVideoId(data),
      status,
      progress: data.progress ?? data.data?.progress ?? 0,
      url: persisted.publicUrl,
      key: assetKey,
      type: eventType,
      segmentIndex,
      persisted: persisted.persisted,
      raw: data,
    });
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 });
  }
}
