'use client';

import Image from 'next/image';
import { ROLES } from '@/lib/prompts';
import { SaveSummary } from '@/lib/gameState';

interface Props {
  onStart: (role: string) => void;
  saves: SaveSummary[];
  onContinue: (saveId: string) => void;
  onDeleteSave: (saveId: string) => void;
}

function formatSaveTime(timestamp: number): string {
  const date = new Date(timestamp);
  return `${date.getMonth() + 1}月${date.getDate()}日 ${date.getHours()}:${String(date.getMinutes()).padStart(2, '0')}`;
}

export default function StartScreen({ onStart, saves, onContinue, onDeleteSave }: Props) {
  const hasSaves = saves.length > 0;

  return (
    <div className="h-full flex flex-col items-end justify-end px-6 pb-8 relative overflow-hidden">
      {/* Background image with slow zoom animation */}
      <div className="absolute inset-0 animate-slow-zoom">
        <Image
          src="/bg-changan.webp"
          alt=""
          fill
          sizes="100vw"
          priority
          className="object-cover"
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

        {hasSaves && (
          <div className="mb-5 space-y-2 animate-fade-in-up" style={{ animationDelay: '1.2s', animationFillMode: 'both' }}>
            <div className="text-amber-400/50 text-xs tracking-widest">— 继续一段旅程 —</div>
            <div className="space-y-2 max-h-44 overflow-y-auto chat-scroll pr-1">
              {saves.map((save) => {
                const role = ROLES[save.role] || ROLES.scholar;
                return (
                  <div
                    key={save.id}
                    className="group flex items-center gap-3 rounded-lg border border-amber-700/25 bg-stone-900/55 backdrop-blur-sm px-3 py-2 text-left"
                  >
                    <button onClick={() => onContinue(save.id)} className="min-w-0 flex-1 text-left">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{role.emoji}</span>
                        <span className="text-amber-200 text-sm font-medium truncate">{role.name} · {save.location}</span>
                      </div>
                      <div className="mt-0.5 text-amber-500/40 text-[11px] truncate">
                        {formatSaveTime(save.updatedAt)} · {save.letterCount}封信 · {save.messageCount}段叙事
                      </div>
                    </button>
                    <button
                      onClick={() => {
                        if (window.confirm('删除这段旅程？')) onDeleteSave(save.id);
                      }}
                      className="text-amber-700/35 hover:text-amber-400 text-xs px-2 py-1"
                      title="删除存档"
                    >
                      删除
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Role selection */}
        <div className="text-amber-400/50 text-xs mb-3 tracking-widest animate-fade-in-up" style={{ animationDelay: hasSaves ? '1.4s' : '1.2s', animationFillMode: 'both' }}>
          {hasSaves ? '— 或开始新的旅程 —' : '— 选择你的身份 —'}
        </div>
        <div className="grid grid-cols-2 gap-3">
          {Object.entries(ROLES).map(([key, role], idx) => (
            <button
              key={key}
              onClick={() => onStart(key)}
              className="group p-4 rounded-xl border border-amber-700/25 bg-stone-900/60 backdrop-blur-sm hover:bg-amber-900/40 hover:border-amber-500/40 transition-all text-left animate-fade-in-up"
              style={{ animationDelay: `${(hasSaves ? 1.5 : 1.3) + idx * 0.1}s`, animationFillMode: 'both' }}
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
