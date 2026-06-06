'use client';

import { useState } from 'react';
import { LetterImage } from '@/lib/prompts';
import LetterVideo from './LetterVideo';

interface Props {
  content: string;
  isLoading?: boolean;
  onClose: () => void;
  onReply?: (reply: string) => void;
  canReply?: boolean;
  image?: LetterImage;
}

export default function LetterModal({ content, isLoading, onClose, onReply, canReply, image }: Props) {
  const [reply, setReply] = useState('');
  const [showReply, setShowReply] = useState(false);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

      {/* Letter */}
      <div className="relative w-full max-w-lg mx-4 mb-4 sm:mb-0 animate-letter-slide">
        <div className="letter-paper rounded-lg p-6 sm:p-8 shadow-2xl max-h-[80vh] overflow-y-auto">
          {/* Seal */}
          <div className="absolute top-4 right-6 seal-stamp font-handwriting text-3xl select-none">
            印
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="flex items-center gap-1 text-amber-800/60 font-handwriting text-lg">
                <span>信正在打开</span>
                <span className="typing-dot inline-block w-1 h-1 rounded-full bg-amber-800/50" />
                <span className="typing-dot inline-block w-1 h-1 rounded-full bg-amber-800/50" />
                <span className="typing-dot inline-block w-1 h-1 rounded-full bg-amber-800/50" />
              </div>
            </div>
          ) : (
            <>
              {/* Letter content */}
              <div className="font-handwriting text-xl leading-relaxed text-amber-900/90 whitespace-pre-wrap">
                {content}
              </div>
              <LetterVideo image={image} />

              {/* Actions */}
              <div className="mt-6 flex gap-3 justify-end">
                {canReply && !showReply && (
                  <button
                    onClick={() => setShowReply(true)}
                    className="px-4 py-2 rounded bg-amber-800/20 text-amber-800 text-sm hover:bg-amber-800/30 transition-colors border border-amber-800/20"
                  >
                    回信
                  </button>
                )}
                <button
                  onClick={onClose}
                  className="px-4 py-2 rounded bg-amber-900/10 text-amber-700/70 text-sm hover:bg-amber-900/20 transition-colors"
                >
                  收好
                </button>
              </div>

              {/* Reply area */}
              {showReply && (
                <div className="mt-4 border-t border-amber-800/20 pt-4">
                  <textarea
                    value={reply}
                    onChange={(e) => setReply(e.target.value)}
                    placeholder="写下你的回信..."
                    className="w-full h-32 bg-transparent font-handwriting text-lg text-amber-900/80 placeholder:text-amber-800/30 resize-none focus:outline-none"
                    autoFocus
                  />
                  <div className="flex justify-end gap-2 mt-2">
                    <button
                      onClick={() => setShowReply(false)}
                      className="px-3 py-1.5 text-xs text-amber-700/50 hover:text-amber-700/80"
                    >
                      取消
                    </button>
                    <button
                      onClick={() => {
                        if (reply.trim() && onReply) {
                          onReply(reply.trim());
                          setReply('');
                          setShowReply(false);
                        }
                      }}
                      disabled={!reply.trim()}
                      className="px-4 py-1.5 rounded bg-amber-800/30 text-amber-800 text-sm hover:bg-amber-800/40 transition-colors disabled:opacity-30"
                    >
                      寄出
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
