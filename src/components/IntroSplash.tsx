'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

const PRELOAD_ASSETS = [
  '/bg-changan.webp',
  '/scene-merchant.webp',
  '/scene-musician.webp',
  '/scene-wanderer.webp',
  '/scene-scholar.webp',
  '/icon-192.png',
];

interface Props {
  onComplete: () => void;
}

function preloadImage(src: string): Promise<void> {
  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => resolve();
    image.onerror = () => resolve();
    image.src = src;
  });
}

export default function IntroSplash({ onComplete }: Props) {
  const lines = useMemo(() => [
    '你还不知道，今日进城，',
    '会牵动千年后一个人的命运。',
  ], []);
  const fullText = lines.join('\n');
  const [visibleLength, setVisibleLength] = useState(0);
  const completedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    const startedAt = Date.now();
    const minimumDuration = 2600;
    const preloadDone = Promise.allSettled(PRELOAD_ASSETS.map(preloadImage));

    const finish = async () => {
      await preloadDone;
      const remaining = Math.max(0, minimumDuration - (Date.now() - startedAt));
      window.setTimeout(() => {
        if (cancelled || completedRef.current) return;
        completedRef.current = true;
        onComplete();
      }, remaining);
    };

    const timer = window.setInterval(() => {
      setVisibleLength((current) => {
        if (current >= fullText.length) {
          window.clearInterval(timer);
          void finish();
          return current;
        }
        return current + 1;
      });
    }, 55);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [fullText, onComplete]);

  const visibleText = fullText.slice(0, visibleLength);
  const renderedLines = visibleText.split('\n');

  return (
    <div className="relative h-full overflow-hidden bg-stone-950 text-amber-100">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_38%,rgba(146,64,14,0.18),transparent_36%),linear-gradient(180deg,rgba(12,10,9,0.92),rgba(12,10,9,1))]" />
      <div className="absolute inset-x-10 top-1/3 h-px bg-gradient-to-r from-transparent via-amber-700/30 to-transparent" />
      <div className="relative z-10 flex h-full flex-col items-center justify-center px-8 text-center">
        <div className="mb-6 text-xs tracking-[0.45em] text-amber-700/55">LETTERS FROM CHANG&apos;AN</div>
        <div className="min-h-[5rem] space-y-2 font-handwriting text-2xl leading-relaxed text-amber-200/90">
          {renderedLines.map((line, index) => (
            <div key={index}>
              {line}
              {index === renderedLines.length - 1 && visibleLength < fullText.length ? (
                <span className="ml-1 inline-block h-5 w-px translate-y-1 animate-pulse bg-amber-300/70" />
              ) : null}
            </div>
          ))}
        </div>
        <div className="mt-8 text-xs tracking-[0.25em] text-amber-700/45">一封信，正在抵达长安</div>
      </div>
    </div>
  );
}
