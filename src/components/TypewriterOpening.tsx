'use client';

import Image from 'next/image';

interface Props {
  sceneImage: string | null;
  typewriterText: string;
}

export default function TypewriterOpening({ sceneImage, typewriterText }: Props) {
  return (
    <div className="h-full relative overflow-hidden bg-stone-950">
      {sceneImage && (
        <div className="absolute inset-x-0 top-0 h-[35vh]">
          <Image
            src={sceneImage}
            alt=""
            fill
            sizes="100vw"
            priority
            unoptimized
            className="object-cover opacity-40"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-stone-950/20 via-transparent to-stone-950" />
        </div>
      )}
      <div className="absolute inset-0 flex items-end pb-24 px-6">
        <div className="max-w-lg mx-auto w-full">
          <div className="text-amber-100/80 text-lg leading-8 whitespace-pre-wrap">
            {typewriterText}
            <span className="inline-block w-0.5 h-6 bg-amber-400/60 ml-0.5 animate-pulse align-text-bottom" />
          </div>
        </div>
      </div>
    </div>
  );
}
