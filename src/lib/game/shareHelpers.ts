import type { ChatMessage } from '@/lib/gameState';

export function getShareExcerpt(messages: ChatMessage[], activeLetter = ''): string {
  const letter = activeLetter.replace(/\s+/g, ' ').trim();
  if (letter.length >= 40) return letter;
  const candidates = [...messages]
    .reverse()
    .filter((message) => message.role === 'assistant')
    .map((message) => message.content.replace(/\s+/g, ' ').trim())
    .filter((content) => content.length >= 40)
    .filter((content) => !content.includes('眼前是宽阔的朱雀大街，人群熙攘。你需要先找个落脚的地方。'));
  return candidates[0] || '';
}
