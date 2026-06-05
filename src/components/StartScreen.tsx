'use client';

import Image from 'next/image';
import { ChangeEvent, useRef, useState } from 'react';
import { ROLES } from '@/lib/prompts';
import { SaveSummary, exportSaves, importSaves } from '@/lib/gameState';

interface Props {
  onStart: (role: string) => void;
  saves: SaveSummary[];
  onContinue: (saveId: string) => void;
  onSavesChanged: () => void;
}

function formatSaveTime(timestamp: number): string {
  const date = new Date(timestamp);
  return `${date.getMonth() + 1}月${date.getDate()}日 ${date.getHours()}:${String(date.getMinutes()).padStart(2, '0')}`;
}

export default function StartScreen({ onStart, saves, onContinue, onSavesChanged }: Props) {
  const hasSaves = saves.length > 0;
  const [showSavePicker, setShowSavePicker] = useState(false);
  const [saveNotice, setSaveNotice] = useState('');
  const importInputRef = useRef<HTMLInputElement>(null);

  function handleExportSaves() {
    const blob = new Blob([exportSaves()], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `letters-from-changan-saves-${Date.now()}.json`;
    link.click();
    URL.revokeObjectURL(url);
    setSaveNotice('旅程已导出');
    window.setTimeout(() => setSaveNotice(''), 1800);
  }

  async function handleImportSaves(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const count = importSaves(await file.text());
      onSavesChanged();
      setSaveNotice(count > 0 ? `已导入${count}段旅程` : '没有可导入的旅程');
    } catch {
      setSaveNotice('导入失败');
    } finally {
      event.target.value = '';
      window.setTimeout(() => setSaveNotice(''), 2200);
    }
  }

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

        <div className="animate-fade-in-up" style={{ animationDelay: '1.55s', animationFillMode: 'both' }}>
          {hasSaves && (
            <button
              onClick={() => setShowSavePicker(true)}
              className="w-full mb-5 py-3.5 rounded-lg bg-amber-700/30 border border-amber-600/40 text-amber-200 hover:bg-amber-700/50 transition-all animate-pulse-glow backdrop-blur-sm"
            >
              继续旅程
            </button>
          )}

          {/* Role selection */}
          <div className="text-amber-400/50 text-xs mb-3 tracking-widest">
            {hasSaves ? '— 或开始新的旅程 —' : '— 选择你的身份 —'}
          </div>
          <div className="grid grid-cols-2 gap-3">
            {Object.entries(ROLES).map(([key, role]) => (
              <button
                key={key}
                onClick={() => onStart(key)}
                className="group p-4 rounded-xl border border-amber-700/25 bg-stone-900/60 backdrop-blur-sm hover:bg-amber-900/40 hover:border-amber-500/40 transition-all text-left"
              >
                <div className="text-2xl mb-1">{role.emoji}</div>
                <div className="text-amber-200 font-medium text-sm">{role.name}</div>
                <div className="text-amber-500/40 text-xs mt-0.5">{role.desc}</div>
              </button>
            ))}
          </div>

          <p className="text-amber-800/30 text-xs mt-6">
            AI 驱动 · 每次游戏都是独一无二的故事
          </p>
        </div>
      </div>

      {showSavePicker && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setShowSavePicker(false)} />
          <div className="relative z-10 w-full max-w-lg mx-4 mb-4 sm:mb-0 rounded-xl border border-amber-700/25 bg-stone-950/90 shadow-2xl overflow-hidden animate-letter-slide">
            <div className="px-5 pt-5 pb-3 flex items-center justify-between border-b border-amber-800/15">
              <div>
                <h2 className="font-handwriting text-2xl text-amber-200/90">选择一段旅程</h2>
                <p className="text-amber-500/35 text-xs mt-1">由近及远，翻开你留下的长安</p>
              </div>
              <button onClick={() => setShowSavePicker(false)} className="text-amber-500/45 hover:text-amber-300 text-sm">
                关闭
              </button>
            </div>

            <div className="max-h-[62vh] overflow-y-auto chat-scroll px-4 py-4 space-y-3">
              {saves.map((save) => {
                const role = ROLES[save.role] || ROLES.scholar;
                return (
                  <button
                    key={save.id}
                    onClick={() => onContinue(save.id)}
                    className="w-full rounded-lg border border-amber-800/20 bg-stone-900/70 px-4 py-3 text-left hover:bg-amber-950/40 hover:border-amber-600/35 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-xl">{role.emoji}</span>
                      <span className="text-amber-200/90 text-sm font-medium truncate">{role.name} · {save.location}</span>
                    </div>
                    <div className="mt-1 text-amber-500/40 text-xs truncate">
                      {formatSaveTime(save.updatedAt)} · {save.letterCount}封信 · {save.messageCount}段叙事
                    </div>
                  </button>
                );
              })}
            </div>
            <div className="border-t border-amber-800/15 px-4 py-3">
              {saveNotice && <div className="mb-2 text-center text-xs text-amber-400/45">{saveNotice}</div>}
              <div className="grid grid-cols-2 gap-2">
                <button onClick={handleExportSaves} className="rounded-lg border border-amber-800/20 bg-stone-900/60 px-3 py-2 text-xs text-amber-400/60 hover:text-amber-300/80">
                  导出旅程
                </button>
                <button onClick={() => importInputRef.current?.click()} className="rounded-lg border border-amber-800/20 bg-stone-900/60 px-3 py-2 text-xs text-amber-400/60 hover:text-amber-300/80">
                  导入旅程
                </button>
              </div>
              <input ref={importInputRef} type="file" accept="application/json" className="hidden" onChange={handleImportSaves} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
