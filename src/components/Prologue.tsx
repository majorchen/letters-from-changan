'use client';

import Image from 'next/image';
import { useState, useEffect, useRef } from 'react';

interface Props {
  role: string;
  onComplete: (bgUrl: string) => void;
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

const ROLE_SCENES: Record<string, string> = {
  merchant: '/scene-merchant.webp',
  musician: '/scene-musician.webp',
  wanderer: '/scene-wanderer.webp',
  scholar: '/scene-scholar.webp',
};

export default function Prologue({ role, onComplete }: Props) {
  const [phase, setPhase] = useState<'dark' | 'text' | 'atmosphere' | 'fade'>('dark');
  const bgUrl = ROLE_SCENES[role] || ROLE_SCENES.scholar;
  const [imgLoaded, setImgLoaded] = useState(false);
  const completed = useRef(false);

  // Preload image
  useEffect(() => {
    const img = new window.Image();
    img.decoding = 'async';
    img.onload = () => {
      if ('decode' in img) {
        img.decode().then(() => setImgLoaded(true)).catch(() => setImgLoaded(true));
        return;
      }
      setImgLoaded(true);
    };
    img.src = bgUrl;
  }, [bgUrl]);

  // Fixed 5.7-second sequence
  useEffect(() => {
    const t1 = setTimeout(() => setPhase('text'), 800);
    const t2 = setTimeout(() => setPhase('atmosphere'), 2500);
    const t3 = setTimeout(() => setPhase('fade'), 5000);
    const t4 = setTimeout(() => {
      if (!completed.current) {
        completed.current = true;
        onComplete(bgUrl);
      }
    }, 5700);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); clearTimeout(t4); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const season = ROLE_SEASON[role] || '天宝元年';
  const atmosphere = ROLE_ATMOSPHERE[role] || '长安城在远处，像一头沉睡的巨兽。';

  return (
    <div className="h-full relative overflow-hidden bg-stone-950 flex items-center justify-center">
      {imgLoaded && (
        <div
          className="absolute inset-0 transition-opacity duration-[2000ms]"
          style={{ opacity: phase === 'atmosphere' || phase === 'fade' ? 0.4 : 0 }}
        >
          <Image
            src={bgUrl}
            alt=""
            fill
            sizes="100vw"
            priority
            className="object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-stone-950 via-stone-950/60 to-stone-950/30" />
        </div>
      )}

      <div className="relative z-10 text-center px-8 max-w-lg">
        <div
          className="font-handwriting text-3xl md:text-4xl text-amber-400/80 mb-8 transition-all duration-1000"
          style={{
            opacity: phase === 'dark' ? 0 : 1,
            transform: phase === 'dark' ? 'translateY(10px)' : 'translateY(0)',
          }}
        >
          {season}
        </div>

        <div
          className="text-amber-300/50 text-sm md:text-base leading-relaxed transition-all duration-1000"
          style={{
            opacity: phase === 'atmosphere' || phase === 'fade' ? 1 : 0,
            transform: phase === 'dark' || phase === 'text' ? 'translateY(10px)' : 'translateY(0)',
          }}
        >
          {atmosphere}
        </div>

        <div
          className="mx-auto mt-8 h-px bg-gradient-to-r from-transparent via-amber-600/30 to-transparent transition-all duration-1000"
          style={{
            width: phase === 'dark' ? '0px' : '120px',
            opacity: phase === 'fade' ? 0 : 0.6,
          }}
        />
      </div>

      <div
        className="absolute inset-0 bg-stone-950 pointer-events-none transition-opacity duration-700"
        style={{ opacity: phase === 'fade' ? 1 : 0 }}
      />
    </div>
  );
}
