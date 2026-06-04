'use client';

interface Letter {
  from: string;
  content: string;
  timestamp: number;
}

interface Props {
  letters: Letter[];
  onClose: () => void;
}

export default function LetterBox({ letters, onClose }: Props) {
  if (letters.length === 0) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center">
        <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
        <div className="relative letter-paper rounded-lg p-8 max-w-md mx-4 text-center">
          <div className="font-handwriting text-xl text-amber-800/60">信匣空空如也</div>
          <div className="text-amber-700/40 text-sm mt-2">还没有收到过信件</div>
          <button onClick={onClose} className="mt-4 px-4 py-2 text-amber-800/50 text-sm hover:text-amber-800/80">
            关闭
          </button>
        </div>
      </div>
    );
  }

  const sorted = [...letters].reverse();

  return (
    <div className="fixed inset-0 z-50 flex flex-col">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

      <div className="relative z-10 flex flex-col h-full max-w-lg mx-auto w-full">
        {/* Header */}
        <div className="flex-none px-6 pt-6 pb-3 flex items-center justify-between">
          <h2 className="font-handwriting text-2xl text-amber-300/80">信匣</h2>
          <button onClick={onClose} className="text-amber-500/40 hover:text-amber-400 text-sm">
            关闭
          </button>
        </div>

        {/* Letters list */}
        <div className="flex-1 overflow-y-auto px-4 pb-6 space-y-4 chat-scroll">
          {sorted.map((letter, i) => {
            const isFromLinShen = letter.from === 'linShen';
            const date = new Date(letter.timestamp);
            const timeStr = `${date.getMonth() + 1}月${date.getDate()}日 ${date.getHours()}:${String(date.getMinutes()).padStart(2, '0')}`;

            return (
              <div key={i} className="animate-fade-in-up">
                <div className="letter-paper rounded-lg p-5 shadow-lg">
                  {/* Sender info */}
                  <div className="flex items-center justify-between mb-3 border-b border-amber-800/15 pb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-base">{isFromLinShen ? '📨' : '✉️'}</span>
                      <span className="font-handwriting text-base text-amber-800/80">
                        {isFromLinShen ? '林深 · 远方' : '你 · 长安'}
                      </span>
                    </div>
                    <span className="text-amber-700/30 text-xs">{timeStr}</span>
                  </div>

                  {/* Letter content */}
                  <div className="font-handwriting text-lg leading-relaxed text-amber-900/85 whitespace-pre-wrap">
                    {letter.content}
                  </div>

                  {/* Seal for LinShen's letters */}
                  {isFromLinShen && (
                    <div className="text-right mt-3">
                      <span className="seal-stamp font-handwriting text-2xl select-none inline-block">印</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
