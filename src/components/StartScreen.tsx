'use client';

import { ROLES } from '@/lib/prompts';

interface Props {
  onStart: (role: string) => void;
  hasSave: boolean;
  onContinue: () => void;
}

export default function StartScreen({ onStart, hasSave, onContinue }: Props) {
  return (
    <div className="h-full flex flex-col items-end justify-end px-6 pb-8 relative overflow-hidden">
      {/* Background image with slow zoom animation */}
      <div className="absolute inset-0 animate-slow-zoom">
        <img
          src="/bg-changan.webp"
          alt=""
          className="w-full h-full object-cover"
        />
      </div>

      {/* Gradient overlays */}
      <div className="absolute inset-0 bg-gradient-to-t from-stone-950 via-stone-950/70 to-stone-950/20" />
      <div className="absolute inset-0 bg-gradient-to-b from-stone-950/40 via-transparent to-transparent" />

      {/* Floating particles */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {[...Array(12)].map((_, i) => (
          <div
            key={i}
            className="absolute w-1 h-1 rounded-full bg-amber-400/20 animate-float"
            style={{
              left: `${10 + (i * 7.5) % 85}%`,
              top: `${15 + (i * 13) % 60}%`,
              animationDelay: `${i * 0.7}s`,
              animationDuration: `${4 + (i % 3) * 2}s`,
            }}
          />
        ))}
      </div>

      {/* Content - bottom aligned */}
      <div className="relative z-10 text-center max-w-md w-full mx-auto">
        {/* Title group with staggered fade-in */}
        <div className="mb-2 text-amber-500/60 text-sm tracking-[0.3em] animate-fade-in-up" style={{ animationDelay: '0.2s', animationFillMode: 'both' }}>
          天宝元年 · 公元742年
        </div>
        <h1 className="font-handwriting text-6xl md:text-7xl text-amber-200 mb-3 tracking-wider animate-fade-in-up drop-shadow-[0_2px_12px_rgba(212,165,116,0.3)]" style={{ animationDelay: '0.5s', animationFillMode: 'both' }}>
          来信长安
        </h1>
        <p className="text-amber-400/70 text-sm mb-1 italic animate-fade-in-up" style={{ animationDelay: '0.8s', animationFillMode: 'both' }}>
          Letters from Chang&apos;an
        </p>
        <p className="text-amber-400/40 text-xs mb-8 animate-fade-in-up" style={{ animationDelay: '1s', animationFillMode: 'both' }}>
          你有一封跨越千年的信
        </p>

        {hasSave && (
          <button
            onClick={onContinue}
            className="w-full mb-5 py-3.5 rounded-lg bg-amber-700/30 border border-amber-600/40 text-amber-200 hover:bg-amber-700/50 transition-all animate-pulse-glow backdrop-blur-sm animate-fade-in-up"
            style={{ animationDelay: '1.2s', animationFillMode: 'both' }}
          >
            继续旅程
          </button>
        )}

        {/* Role selection */}
        <div className="text-amber-400/50 text-xs mb-3 tracking-widest animate-fade-in-up" style={{ animationDelay: hasSave ? '1.4s' : '1.2s', animationFillMode: 'both' }}>
          {hasSave ? '— 或开始新的旅程 —' : '— 选择你的身份 —'}
        </div>
        <div className="grid grid-cols-2 gap-3">
          {Object.entries(ROLES).map(([key, role], idx) => (
            <button
              key={key}
              onClick={() => onStart(key)}
              className="group p-4 rounded-xl border border-amber-700/25 bg-stone-900/60 backdrop-blur-sm hover:bg-amber-900/40 hover:border-amber-500/40 transition-all text-left animate-fade-in-up"
              style={{ animationDelay: `${(hasSave ? 1.5 : 1.3) + idx * 0.1}s`, animationFillMode: 'both' }}
            >
              <div className="text-2xl mb-1">{role.emoji}</div>
              <div className="text-amber-200 font-medium text-sm">{role.name}</div>
              <div className="text-amber-500/40 text-xs mt-0.5">{role.desc}</div>
            </button>
          ))}
        </div>

        <p className="text-amber-800/30 text-xs mt-6 animate-fade-in-up" style={{ animationDelay: '2s', animationFillMode: 'both' }}>
          AI 驱动 · 每次游戏都是独一无二的故事
        </p>
      </div>
    </div>
  );
}
