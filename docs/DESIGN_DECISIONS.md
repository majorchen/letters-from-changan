# Letters from Chang'an - Design Decisions

## Core Decisions

1. **Text-first narrative loop**
   The core game loop is chat, choices, letters, and state updates. Images support atmosphere, but should not block the story.

2. **Letters are text-only**
   The letter system no longer depends on video or image attachments. `/api/letter` returns content and the frontend delivers it directly.

3. **No video pipeline**
   The game currently does not use video. The unused `/api/video` route and local video cache were removed.

4. **Prompt modules stay small**
   `src/lib/prompts.ts` is a compatibility barrel. Prompt data, formatters, and game data live in focused modules.

5. **GameScreen coordinates, hooks own flows**
   `GameScreen.tsx` should remain a coordinator. Chat, letters, sharing, and opening flow are owned by hooks/components.

6. **saves-v2 is the source of truth**
   Local game state and chat history are persisted through the saves array. Legacy single-key writes are removed.

7. **Cloud saves merge by latest update**
   Local and cloud journeys are merged by `updatedAt`. Sync uses an in-tab lock and one retry to avoid duplicate concurrent syncs.

8. **Rate limit is anti-abuse, not usage policy**
   API rate limiting protects the public Next.js routes from loops and scraping. It is intentionally loose by default.

9. **No service worker**
   The game requires online AI calls, so offline support would create misleading behavior. The manifest remains for mobile install/fullscreen.

10. **Storage should degrade gracefully**
    Old messages and oversized content may be compacted before localStorage hits browser quota.
