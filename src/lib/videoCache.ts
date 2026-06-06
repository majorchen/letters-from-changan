const VIDEO_CACHE_KEY = 'letters-from-changan-video-cache-v1';

export type VideoEventType = 'letter' | 'memory' | 'glitch' | 'ending';

export interface VideoAsset {
  key: string;
  type: VideoEventType;
  status: 'queued' | 'ready' | 'failed';
  prompt: string;
  taskId?: string;
  videoId?: string;
  url?: string;
  urls?: string[];
  createdAt: number;
  updatedAt: number;
}

export function makeVideoKey(type: VideoEventType, role: string, location: string, turnCount: number): string {
  const bucket = Math.max(1, Math.floor((turnCount || 1) / 8));
  return `${type}:${role}:${location}:${bucket}`.slice(0, 180);
}

export function loadVideoCache(): Record<string, VideoAsset> {
  if (typeof window === 'undefined') return {};
  try {
    return JSON.parse(localStorage.getItem(VIDEO_CACHE_KEY) || '{}');
  } catch {
    return {};
  }
}

export function saveVideoAsset(asset: VideoAsset): void {
  if (typeof window === 'undefined') return;
  const cache = loadVideoCache();
  cache[asset.key] = asset;
  localStorage.setItem(VIDEO_CACHE_KEY, JSON.stringify(cache));
}

export function getVideoAsset(key: string): VideoAsset | null {
  return loadVideoCache()[key] || null;
}
