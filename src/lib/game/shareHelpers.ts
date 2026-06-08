import type { ChatMessage } from '@/lib/gameState';

export function getShareExcerpt(messages: ChatMessage[], activeLetter = ''): string {
  const letter = activeLetter.replace(/\s+/g, ' ').trim();
  if (letter.length >= 40) return letter;
  const candidates = [...messages]
    .reverse()
    .filter((message) => message.role === 'assistant')
    .map((message) => message.content.replace(/\s+/g, ' ').trim())
    .filter((content) => content.length >= 40);
  return candidates[0] || '';
}
