'use client';

interface Props {
  location: string;
  roleName: string;
  shouldGlowLetterBox: boolean;
  isWaitingForLetter: boolean;
  onExit: () => void;
  onShare: () => void;
  onOpenLetterBox: () => void;
}

export default function GameHeader({
  location,
  roleName,
  shouldGlowLetterBox,
  isWaitingForLetter,
  onExit,
  onShare,
  onOpenLetterBox,
}: Props) {
  return (
    <div className="relative z-20 grid h-12 flex-none grid-cols-[1fr_minmax(0,auto)_1fr] items-center border-b border-amber-900/10 bg-stone-950/90 px-4 py-1.5 shadow-[0_8px_24px_rgba(12,10,9,0.35)] backdrop-blur-md">
      <button onClick={onExit} aria-label="离开当前旅程" className="justify-self-start text-amber-500/50 text-xs hover:text-amber-400 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-400/70">
        ← 离开
      </button>
      <div className="min-w-0 max-w-[52vw] justify-self-center text-center">
        <div className="truncate text-xs font-medium text-amber-300/75">{location}</div>
        <div className="truncate text-[10px] text-amber-500/35">天宝元年 · {roleName}</div>
      </div>
      <div className="justify-self-end flex min-w-10 items-center justify-end">
        <button onClick={onShare} aria-label="生成分享卡片" className="flex h-7 w-7 items-center justify-center text-amber-400/40 hover:text-amber-400 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-400/70" title="生成分享卡片">
          🕊️
        </button>
        <button
          onClick={onOpenLetterBox}
          aria-label={shouldGlowLetterBox ? '打开新信' : isWaitingForLetter ? '查看信匣，等待回信' : '打开信匣'}
          className={`flex h-7 w-7 items-center justify-center text-sm hover:text-amber-400 ${
            shouldGlowLetterBox
              ? 'text-amber-300/90 mailbox-soft-glow'
              : isWaitingForLetter
                ? 'text-amber-400/55 animate-pulse'
                : 'text-amber-400/40'
          } focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-400/70`}
          title={shouldGlowLetterBox ? '新信到了' : isWaitingForLetter ? '等待林深回信' : '信匣'}
        >
          📜
        </button>
      </div>
    </div>
  );
}
