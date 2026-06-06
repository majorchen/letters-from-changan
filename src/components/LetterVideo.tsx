'use client';

import { useState } from 'react';
import { LetterVideo as LetterVideoData } from '@/lib/prompts';

interface Props {
  video?: LetterVideoData;
}

export default function LetterVideo({ video }: Props) {
  const [playing, setPlaying] = useState(false);
  if (!video?.url) return null;

  return (
    <div className="relative mt-6 aspect-video overflow-hidden rounded-md border border-amber-900/20 bg-stone-950 shadow-inner">
      <video
        src={video.url}
        controls={playing}
        playsInline
        preload="metadata"
        className="h-full w-full object-cover"
        onPlay={() => setPlaying(true)}
        onEnded={() => setPlaying(false)}
      />
      {!playing && (
        <button
          type="button"
          onClick={(event) => {
            const videoElement = event.currentTarget.parentElement?.querySelector('video');
            setPlaying(true);
            void videoElement?.play();
          }}
          className="absolute inset-0 flex items-center justify-center bg-stone-950/30"
          aria-label="播放林深随信寄来的影像"
        >
          <span className="flex h-14 w-14 items-center justify-center rounded-full border border-amber-100/50 bg-stone-950/60 text-2xl text-amber-100 shadow-lg">
            ▶
          </span>
        </button>
      )}
    </div>
  );
}
