'use client';

import Image from 'next/image';
import { LetterImage } from '@/lib/prompts';

interface Props {
  image?: LetterImage;
  /** @deprecated Use image instead */
  video?: LetterImage;
}

export default function LetterVideo({ image, video }: Props) {
  const data = image || video;
  if (!data?.url) return null;

  return (
    <div className="relative mt-6 aspect-video overflow-hidden rounded-md border border-amber-900/20 bg-stone-950 shadow-inner">
      <Image
        src={data.url}
        alt="林深随信寄来的影像"
        fill
        className="object-cover"
        unoptimized
      />
    </div>
  );
}
