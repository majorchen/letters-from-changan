'use client';

import { useState, useEffect, useRef } from 'react';

interface Props {
  role: string;
  onComplete: (bgUrl: string | null) => void;
}

const ROLE_SEASON: Record<string, string> = {
  merchant: '天宝元年，秋',
  musician: '天宝元年，暮春',
  wanderer: '天宝元年，初冬',
  scholar: '天宝元年，仲夏',
};

const ROLE_ATMOSPHERE: Record<string, string> = {
  merchant: '西域的驼铃声，从远处传来。',
  musician: '风里隐约有胡琴声，不知从哪个酒肆飘出。',
  wanderer: '城墙的影子，像一道黑色的潮水。',
  scholar: '有人在城门口念诗，声音被人群淹没了。',
};

const SCENE_PROMPTS: Record<string, string> = {
  merchant: 'Tang Dynasty Chang an Zhuque Gate at golden autumn sunset, a lone merchant with thin horse approaching the massive gate, Silk Road caravans with camels in background, warm amber light, painted on aged silk',
  musician: 'Tang Dynasty Chang an city gate in late spring twilight, a young musician carrying a pipa lute walking toward the gate, cherry blossoms floating in warm breeze, golden hour light, Dunhuang fresco style',
  wanderer: 'Tang Dynasty Chang an Zhuque Gate in early winter dusk, a wandering swordsman in worn clothes standing before the massive gate, cold blue-gold light, long shadows, painted on aged silk texture',
  scholar: 'Tang Dynasty Chang an gate in summer morning, a young scholar in white robes clutching scrolls approaching the grand city gate, bright warm sunlight, bustling crowd, Dunhuang fresco colors',
};

export default function Prologue({ role, onComplete }: Props) {
  const [phase, setPhase] = useState<'dark' | 'text' | 'atmosphere' | 'fade'>('dark');
  const [bgUrl, setBgUrl] = useState<string | null>(null);
  const bgRef = useRef<string | null>(null);

  // Start loading background image immediately
  useEffect(() => {
    const prompt = SCENE_PROMPTS[role] || SCENE_PROMPTS.scholar;
    fetch('/api/image', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        scene: prompt + '. Warm amber-gold palette, soft diffused side lighting, textured painterly digital art with visible brushwork and grain. 16:9 wide cinematic composition.',
      }),
    })
      .then(res => res.json())
      .then(data => {
        if (data.url) {
          bgRef.current = data.url;
          setBgUrl(data.url);
        }
      })
      .catch(() => {});
  }, [role]);

  // Sequence the phases
  useEffect(() => {
    const t1 = setTimeout(() => setPhase('text'), 800);
    const t2 = setTimeout(() => setPhase('atmosphere'), 2500);
    const t3 = setTimeout(() => setPhase('fade'), 5000);
    const t4 = setTimeout(() => onComplete(bgRef.current), 6000);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); clearTimeout(t4); };
  }, [onComplete]);

  const season = ROLE_SEASON[role] || '天宝元年';
  const atmosphere = ROLE_ATMOSPHERE[role] || '长安城在远处，像一头沉睡的巨兽。';

  return (
    <div className="h-full relative overflow-hidden bg-stone-950 flex items-center justify-center">
      {/* Background image fading in */}
      {bgUrl && (
        <div
          className="absolute inset-0 transition-opacity duration-[3000ms]"
          style={{ opacity: phase === 'atmosphere' || phase === 'fade' ? 0.4 : 0 }}
        >
          <img src={bgUrl} alt="" className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-stone-950 via-stone-950/60 to-stone-950/30" />
        </div>
      )}

      {/* Content */}
      <div className="relative z-10 text-center px-8 max-w-lg">
        {/* Season text */}
        <div
          className="font-handwriting text-3xl md:text-4xl text-amber-400/80 mb-8 transition-all duration-1000"
          style={{
            opacity: phase === 'dark' ? 0 : 1,
            transform: phase === 'dark' ? 'translateY(10px)' : 'translateY(0)',
          }}
        >
          {season}
        </div>

        {/* Atmosphere line */}
        <div
          className="text-amber-300/50 text-sm md:text-base leading-relaxed transition-all duration-1000"
          style={{
            opacity: phase === 'atmosphere' || phase === 'fade' ? 1 : 0,
            transform: phase === 'dark' || phase === 'text' ? 'translateY(10px)' : 'translateY(0)',
          }}
        >
          {atmosphere}
        </div>

        {/* Subtle decorative line */}
        <div
          className="mx-auto mt-8 h-px bg-gradient-to-r from-transparent via-amber-600/30 to-transparent transition-all duration-1000"
          style={{
            width: phase === 'dark' ? '0px' : '120px',
            opacity: phase === 'fade' ? 0 : 0.6,
          }}
        />
      </div>

      {/* Overall fade out */}
      <div
        className="absolute inset-0 bg-stone-950 pointer-events-none transition-opacity duration-700"
        style={{ opacity: phase === 'fade' ? 1 : 0 }}
      />
    </div>
  );
}
