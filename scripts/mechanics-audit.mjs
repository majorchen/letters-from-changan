import { readFile } from 'node:fs/promises';

const files = {
  game: await readFile(new URL('../src/components/GameScreen.tsx', import.meta.url), 'utf8'),
  state: await readFile(new URL('../src/lib/gameState.ts', import.meta.url), 'utf8'),
  prompts: await readFile(new URL('../src/lib/prompts.ts', import.meta.url), 'utf8'),
  layout: await readFile(new URL('../src/app/layout.tsx', import.meta.url), 'utf8'),
  globals: await readFile(new URL('../src/app/globals.css', import.meta.url), 'utf8'),
  video: await readFile(new URL('../src/app/api/video/route.ts', import.meta.url), 'utf8'),
};

const checks = [
  {
    name: 'followup letter cooldown is 25-30 turns',
    pass: /REPLY_LETTER_COOLDOWN_TURNS\s*=\s*(2[5-9]|30)\b/.test(files.game),
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
    name: 'video remains placeholder-gated',
    pass: files.prompts.includes('VISUAL: none / glitch / memory') && files.game.includes("setVisualCue(narrativeState.visualCue)"),
  },
  {
    name: 'Agnes video v2 route is configured',
    pass: files.video.includes("DEFAULT_VIDEO_MODEL = 'agnes-video-v2.0'")
      && files.video.includes('/videos')
      && files.video.includes('num_frames')
      && files.video.includes('frame_rate'),
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
