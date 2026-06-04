'use client';

import { ROLES } from '@/lib/prompts';

interface Props {
  onStart: (role: string) => void;
  hasSave: boolean;
  onContinue: () => void;
}

export default function StartScreen({ onStart, hasSave, onContinue }: Props) {
  return (
    <div className="h-full flex flex-col items-center justify-center px-6 relative overflow-hidden">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-amber-950/80 via-stone-950 to-stone-950" />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-96 h-96 bg-amber-700/10 rounded-full blur-3xl" />

      <div className="relative z-10 text-center max-w-md w-full">
        {/* Title */}
        <div className="mb-2 text-amber-600/60 text-sm tracking-[0.3em]">天宝元年 · 公元742年</div>
        <h1 className="font-handwriting text-5xl md:text-6xl text-amber-200 mb-3 tracking-wider">
          来信长安
        </h1>
        <p className="text-amber-500/70 text-sm mb-1 italic">Letters from Chang&apos;an</p>
        <p className="text-amber-400/50 text-xs mb-10">你有一封跨越千年的信</p>

        {hasSave && (
          <button
            onClick={onContinue}
            className="w-full mb-6 py-3.5 rounded-lg bg-amber-700/30 border border-amber-600/40 text-amber-200 hover:bg-amber-700/50 transition-all animate-pulse-glow"
          >
            继续旅程
          </button>
        )}

        {/* Role selection */}
        <div className="text-amber-400/60 text-xs mb-4 tracking-widest uppercase">
          {hasSave ? '— 或开始新的旅程 —' : '— 选择你的身份 —'}
        </div>
        <div className="grid grid-cols-2 gap-3">
          {Object.entries(ROLES).map(([key, role]) => (
            <button
              key={key}
              onClick={() => onStart(key)}
              className="group p-4 rounded-xl border border-amber-800/30 bg-amber-900/10 hover:bg-amber-800/20 hover:border-amber-600/50 transition-all text-left"
            >
              <div className="text-2xl mb-1">{role.emoji}</div>
              <div className="text-amber-200 font-medium text-sm">{role.name}</div>
              <div className="text-amber-500/50 text-xs mt-0.5">{role.desc}</div>
            </button>
          ))}
        </div>

        <p className="text-amber-800/40 text-xs mt-8">AI 驱动 · 每次游戏都是独一无二的故事</p>
      </div>
    </div>
  );
}
