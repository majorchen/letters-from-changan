'use client';

import { useEffect, useRef, useState } from 'react';

const PRELOAD_ASSETS = [
  '/bg-changan.webp',
  '/scene-merchant.webp',
  '/scene-musician.webp',
  '/scene-wanderer.webp',
  '/scene-scholar.webp',
  '/icon-192.png',
];

const LOADING_DOTS = ['.', '..', '...'];

interface Props {
  onComplete: () => void;
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function preloadImage(src: string): Promise<void> {
  return new Promise((resolve) => {
    const image = new Image();
    image.decoding = 'async';
    image.onload = () => {
      if ('decode' in image) {
        image.decode().then(() => resolve()).catch(() => resolve());
        return;
      }
      resolve();
    };
    image.onerror = () => resolve();
    image.src = src;
  });
}

export default function IntroSplash({ onComplete }: Props) {
  const completedRef = useRef(false);
  const [dotIndex, setDotIndex] = useState(0);

  useEffect(() => {
    let cancelled = false;

    const finish = async () => {
      const minimumDuration = wait(2400);
      const preloadDone = Promise.allSettled(PRELOAD_ASSETS.map(preloadImage));
      const preloadBudget = wait(3600);
      await minimumDuration;
      await Promise.race([preloadDone, preloadBudget]);
      if (cancelled || completedRef.current) return;
      completedRef.current = true;
      onComplete();
    };

    void finish();

    return () => {
      cancelled = true;
    };
  }, [onComplete]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setDotIndex((current) => (current + 1) % LOADING_DOTS.length);
    }, 420);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <div className="relative h-full overflow-hidden bg-stone-950 text-amber-100">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_38%,rgba(146,64,14,0.18),transparent_36%),linear-gradient(180deg,rgba(12,10,9,0.92),rgba(12,10,9,1))]" />
      <div className="absolute inset-x-10 top-1/3 h-px bg-gradient-to-r from-transparent via-amber-700/30 to-transparent" />
      <div className="relative z-10 flex h-full flex-col items-center justify-center px-8 text-center">
        <div className="mb-8 animate-fade-in-up text-xs tracking-[0.45em] text-amber-700/55" style={{ animationDelay: '0.15s', animationFillMode: 'both' }}>
          LETTERS FROM CHANG&apos;AN
        </div>

        <div className="space-y-3 font-handwriting text-[clamp(1.2rem,5.4vw,1.65rem)] leading-relaxed text-amber-200/90">
          <div className="animate-fade-in-up whitespace-nowrap" style={{ animationDelay: '0.45s', animationFillMode: 'both' }}>
            你还不知道，今日进城，
          </div>
          <div className="animate-fade-in-up whitespace-nowrap" style={{ animationDelay: '0.75s', animationFillMode: 'both' }}>
            会牵动千年后一个人的命运。
          </div>
        </div>

        <div className="mt-9 flex animate-fade-in-up items-center justify-center gap-2 text-sm tracking-[0.22em] text-amber-300/80" style={{ animationDelay: '1.05s', animationFillMode: 'both' }}>
          <span className="text-amber-400/55">🐎</span>
          <span>
            正在抵达长安
            <span className="inline-block w-6 text-left">{LOADING_DOTS[dotIndex]}</span>
          </span>
        </div>
      </div>
    </div>
  );
}
