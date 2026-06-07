'use client';

interface Props {
  imageUrl: string;
  onClose: () => void;
}

export default function ShareModal({ imageUrl, onClose }: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div
        className="relative z-10 mx-4 mb-4 flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-xl border border-amber-700/25 bg-stone-950/90 shadow-2xl sm:mb-0"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex-none border-b border-amber-900/15 px-5 pb-4 pt-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="font-handwriting text-2xl text-amber-200/90">分享这段旅程</div>
              <div className="text-xs text-amber-500/40">长按图片保存，发给朋友</div>
            </div>
            <button onClick={onClose} aria-label="关闭分享卡片" className="text-sm text-amber-500/45 hover:text-amber-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-400/70">
              关闭
            </button>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={imageUrl} alt="分享卡片" className="mx-auto w-full rounded-xl border border-amber-900/20 shadow-2xl" />
        </div>
      </div>
    </div>
  );
}
