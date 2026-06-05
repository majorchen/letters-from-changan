# Weekend Launch Checklist

Goal: make the public build playable for testers with login, cloud saves, narrative play, and triggered story videos.

## Video Event Types

The game currently supports three video event classes from `[STATE] VISUAL`.

| Type | Trigger | Runtime behavior |
| --- | --- | --- |
| `memory` | Key Lin Shen letters or memory flashes | One ~5 second generated clip. If not ready, CSS memory overlay plays immediately. |
| `glitch` | Contradiction follow-up, time rift, impossible detail | One short generated clip. If not ready, CSS glitch overlay plays immediately. |
| `ending` | Act 3 closure after the final role-specific question | Four ~5 second generated clips, played back-to-back in the UI. No ffmpeg stitching. |

Videos are generated only after the story triggers them. The app does not pre-generate large content. If Supabase Storage is configured, `/api/video` copies completed Agnes video files into the public `story-videos` bucket and returns the durable Supabase URL. If Storage is not configured, it falls back to the Agnes URL.

## What Codex Has Prepared

- Supabase CLI installed as a dev dependency. Use `npx supabase --version`.
- Supabase project config in `supabase/config.toml`.
- Migration file:
  - `public.journeys` for cloud saves.
  - `public.video_assets` for generated video metadata.
  - public Storage bucket `story-videos`.
  - RLS policies for saves and public video reads.
- `/api/video` can persist completed video files into Supabase Storage when `SUPABASE_SERVICE_ROLE_KEY` is present.
- Frontend video UI supports queued generation status and multi-segment ending playback.

## Launch Setup Status

- [x] Supabase project created: `izgjxgtqsizzhqtvbzhu`.
- [x] Supabase CLI installed, logged in, and linked.
- [x] Remote migration pushed with `journeys`, `video_assets`, `story-videos`, RLS, and Storage policies.
- [x] Supabase Auth URL config pushed:
  - Site URL: `https://letterstang.aifisher.cn`
  - Redirect URLs: `https://letterstang.aifisher.cn`, `https://letters-from-changan.vercel.app`, `http://localhost:3000`, `http://localhost:3001`
- [x] Vercel Production env vars configured:
  - `AGNES_API_KEY`
  - `AGNES_API_URL`
  - `AGNES_VIDEO_MODEL`
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY`
- [x] Production redeployed and aliased to `https://letterstang.aifisher.cn`.
- [x] Technical checks passed: homepage 200, `/api/video` task creation, remote migration parity, `journeys` table access, `video_assets` table access, `story-videos` bucket exists.

## Manual Playtest Still Needed

1. Open `https://letterstang.aifisher.cn`.
2. Try email login and confirm the magic link returns to the game.
3. Start a journey, play several turns, return to the home journey modal, and run cloud sync.
4. Confirm Supabase `journeys` receives a row.
5. Play until a `memory`, `glitch`, or `ending` visual event triggers.
6. After Agnes finishes a task, confirm `story-videos` receives a file and `video_assets` receives a ready row.
7. Confirm `ending` plays multiple clips back-to-back in the same interface.

## Acceptance Checks

- Homepage shows email cloud-save login instead of "cloud save not configured".
- Login email arrives and returns to the game URL.
- `journeys` table receives one row after cloud sync.
- `story-videos` bucket receives files after Agnes video tasks complete.
- `video_assets` table records ready videos with public URLs.
- Ending video plays multiple clips back-to-back without page navigation.
