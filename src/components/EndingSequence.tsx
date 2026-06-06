'use client';

import Image from 'next/image';
import { useEffect, useState } from 'react';

interface Props {
  title: string;
  scenes: string[];
  onRestart: () => void;
  onShare: () => void;
}

export default function EndingSequence({ title, scenes, onRestart, onShare }: Props) {
  const [index, setIndex] = useState(0);
  const creditsIndex = scenes.length;

  useEffect(() => {
    if (index >= creditsIndex) return;
    const timer = window.setTimeout(() => setIndex((current) => current + 1), 5200);
    return () => window.clearTimeout(timer);
  }, [creditsIndex, index]);

  return (
    <div className="fixed inset-0 z-[70] overflow-hidden bg-stone-950">
      <Image src="/bg-changan.webp" alt="" fill priority sizes="100vw" className="object-cover opacity-35" />
      <div className="absolute inset-0 bg-gradient-to-b from-stone-950/65 via-stone-950/80 to-stone-950" />
      {index < creditsIndex ? (
        <button
          type="button"
          onClick={() => setIndex((current) => Math.min(current + 1, creditsIndex))}
          className="relative z-10 flex h-full w-full items-center justify-center px-8 text-center"
        >
          <div key={index} className="max-w-xl animate-fade-in-up">
            {index === 0 && <div className="mb-7 font-handwriting text-3xl text-amber-300/85">{title}</div>}
            <p className="font-handwriting text-xl leading-[2] text-amber-100/80 sm:text-2xl">{scenes[index]}</p>
          </div>
        </button>
      ) : (
        <div className="relative z-10 flex h-full flex-col items-center justify-center px-8 text-center">
          <Image src="/icon-192.png" alt="来信长安" width={88} height={88} className="mb-7 rounded-2xl" />
          <div className="font-handwriting text-3xl text-amber-200/90">来信长安</div>
          <div className="mt-2 text-sm text-amber-400/50">Letters from Chang&apos;an</div>
          <div className="mt-12 text-xs tracking-[0.24em] text-amber-500/40">创作与制作</div>
          <div className="mt-3 text-lg text-amber-100/75">MajorChen | AI Fisher</div>
          <div className="mt-10 text-sm leading-7 text-amber-100/50">
            AI 互动叙事 · 动态场景与跨时空书信
            <br />
            Powered by Agnes AI API
          </div>
          <p className="mt-10 max-w-sm text-sm leading-7 text-amber-100/45">
            想做一个能让人慢下来读一封信，也愿意在故事里留下自己选择的长安。
          </p>
          <div className="mt-14 flex gap-4">
            <button onClick={onRestart} className="border-b border-amber-500/30 px-3 py-2 text-sm text-amber-200/70">重新开始</button>
            <button onClick={onShare} className="border-b border-amber-500/30 px-3 py-2 text-sm text-amber-200/70">分享这段旅程</button>
          </div>
        </div>
      )}
    </div>
  );
}
