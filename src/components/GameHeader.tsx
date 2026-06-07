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
    <div className="flex-none px-4 py-1.5 bg-stone-950/50 backdrop-blur-sm grid grid-cols-[1fr_auto_1fr] items-center z-20 relative">
      <button onClick={onExit} aria-label="离开当前旅程" className="justify-self-start text-amber-500/50 text-xs hover:text-amber-400 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-400/70">
        ← 离开
      </button>
      <div className="text-center justify-self-center min-w-0">
        <div className="text-amber-300/70 text-xs font-medium">{location}</div>
        <div className="text-amber-500/30 text-[10px]">天宝元年 · {roleName}</div>
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
