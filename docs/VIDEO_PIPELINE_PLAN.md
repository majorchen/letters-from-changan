# Video Pipeline Plan

Video remains a narrative event, not a decorative background. The current code supports `VISUAL: glitch` and `VISUAL: memory` as an in-interface placeholder.

Agnes video v2.0 docs: https://agnes-ai.com/doc/agnes-video-v20

## Agnes API Details

- Create: `POST /v1/videos`
- Preferred poll: `GET /agnesapi?video_id={video_id}&model_name=agnes-video-v2.0`
- Legacy fallback only: `GET /v1/videos/{task_id}`
- Model: `agnes-video-v2.0`
- Default size: `1152x768`
- Letter video frames: `241` (about 10 seconds at 24fps)
- Default frame rate: `24`
- Auth: same `AGNES_API_KEY` bearer token and `AGNES_API_URL` base URL used by chat/image.

Current implementation:

- Server route: `POST /api/video`
- Status route: `GET /api/video?taskId=...`
- Config override: `AGNES_VIDEO_MODEL`, defaulting to `agnes-video-v2.0`
- The route returns normalized `{ taskId, status, progress, url, raw }`.
- Durable storage: when `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are configured, completed video files are copied into Supabase Storage bucket `story-videos`.

## Runtime Principle

Do not make the player wait for real-time video generation during a story beat.

Preferred flow:

1. Do not pre-generate large video sets.
2. When `[STATE] VISUAL` requests a video event, create a task with a stable event key.
3. If cached media is ready, play it immediately.
4. If video is not ready, fall back to the current CSS `glitch` or `memory` effect and keep the generated asset cached for later.

## Event Types

### Memory Flash

- Trigger: Lin Shen key letters.
- Duration: 5-8 seconds.
- Placement: inside the letter modal, under translucent letter text.
- Current state: CSS memory overlay exists; real media pending.

### Time Rift

- Trigger: accumulated contradictions or direct contradiction follow-up.
- Duration: 2-3 seconds.
- Placement: current scene image glitches between Chang'an and 2077.
- Current state: CSS glitch overlay exists; real media pending.

### Ending Moment

- Trigger: act 3 closure.
- Duration: 20-30 seconds.
- Placement: UI fades away; scene expands to full-screen video; fade to black and final line.
- Current state: implemented as four ~5 second clips played back-to-back in the UI. No ffmpeg stitching.

## Cache Shape

```ts
type VideoAsset = {
  key: string;
  type: 'memory' | 'rift' | 'ending';
  status: 'queued' | 'ready' | 'failed';
  prompt: string;
  url?: string;
  createdAt: number;
  sourceState: {
    role: string;
    chapter: string;
    eventCode?: string;
  };
};
```

## Decisions Needed From Major

- Storage decision: use Supabase Storage free tier for durable generated clips during weekend testing.
- ffmpeg decision: do not stitch clips. Play multiple generated segments continuously in the UI.
