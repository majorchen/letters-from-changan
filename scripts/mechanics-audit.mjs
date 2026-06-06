import { readFile } from 'node:fs/promises';

const files = {
  game: await readFile(new URL('../src/components/GameScreen.tsx', import.meta.url), 'utf8'),
  state: await readFile(new URL('../src/lib/gameState.ts', import.meta.url), 'utf8'),
  prompts: await readFile(new URL('../src/lib/prompts.ts', import.meta.url), 'utf8'),
  layout: await readFile(new URL('../src/app/layout.tsx', import.meta.url), 'utf8'),
  globals: await readFile(new URL('../src/app/globals.css', import.meta.url), 'utf8'),
  video: await readFile(new URL('../src/app/api/video/route.ts', import.meta.url), 'utf8'),
  letter: await readFile(new URL('../src/app/api/letter/route.ts', import.meta.url), 'utf8'),
  letterVideo: await readFile(new URL('../src/components/LetterVideo.tsx', import.meta.url), 'utf8'),
  ending: await readFile(new URL('../src/components/EndingSequence.tsx', import.meta.url), 'utf8'),
  start: await readFile(new URL('../src/components/StartScreen.tsx', import.meta.url), 'utf8'),
};

const checks = [
  {
    name: 'followup letter preparation starts after player reply',
    pass: files.game.includes('prepareIncomingLetter(reply)')
      && files.game.includes('VIDEO_POLL_MAX_ATTEMPTS = 30')
      && files.game.includes('VIDEO_POLL_INTERVAL_MS = 10_000'),
  },
  {
    name: 'followup letters glow in header mailbox',
    pass: files.game.includes('shouldGlowLetterBox') && files.game.includes("title={shouldGlowLetterBox ? '新信到了' : '信匣'}"),
  },
  {
    name: 'internal continuation prompts can be hidden',
    pass: files.state.includes('hidden?: boolean') && files.game.includes('visibleUser: false') && files.game.includes('!msg.hidden'),
  },
  {
    name: 'system Song-style font stack avoids next/font/google',
    pass: !files.layout.includes('next/font/google') && files.globals.includes("'Songti SC'") && files.globals.includes("'SimSun'"),
  },
  {
    name: 'role convergence guides exist for all roles',
    pass: ['merchant', 'musician', 'wanderer', 'scholar'].every((role) => files.prompts.includes(`${role}: {`))
      && files.prompts.includes('ROLE_CONVERGENCE')
      && files.prompts.includes('本线啊哈时刻'),
  },
  {
    name: 'random narrative videos are removed and endings use text scenes',
    pass: files.prompts.includes('VISUAL: none / ending')
      && !files.game.includes('记忆影像生成中')
      && files.ending.includes('MajorChen | AI Fisher'),
  },
  {
    name: 'Agnes video v2 route is configured',
    pass: files.video.includes("DEFAULT_VIDEO_MODEL = 'agnes-video-v2.0'")
      && files.video.includes('/videos')
      && files.video.includes('/agnesapi?video_id=')
      && files.video.includes('remixed_from_video_id')
      && files.video.includes('num_frames')
      && files.video.includes('frame_rate'),
  },
  {
    name: 'every incoming letter is paired with an inline video',
    pass: files.letter.includes('videoPrompt')
      && files.game.includes("type: 'letter'")
      && files.letterVideo.includes('playsInline'),
  },
  {
    name: 'cloud saves are optional and Supabase-backed',
    pass: files.start.includes('canUseCloudSaves')
      && files.start.includes('syncCloudSaves')
      && files.start.includes('sendCloudLoginOtp')
      && files.start.includes('verifyCloudLoginOtp'),
  },
  {
    name: 'playtest report button is not in game header',
    pass: !files.game.includes('handleExportJourneyReport') && !files.game.includes('导出试玩报告'),
  },
];

let failed = false;
for (const check of checks) {
  const marker = check.pass ? 'ok' : 'fail';
  console.log(`${marker}: ${check.name}`);
  if (!check.pass) failed = true;
}

if (failed) {
  process.exitCode = 1;
}
