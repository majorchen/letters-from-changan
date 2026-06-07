import type { PlayerState } from '@/lib/prompts';

function excerpt(text: string, maxLength = 140): string {
  return text.replace(/\s+/g, ' ').trim().slice(0, maxLength);
}

function latestLetterFrom(state: PlayerState, from: 'linShen' | 'player'): string {
  for (let i = (state.letterHistory || []).length - 1; i >= 0; i--) {
    const letter = state.letterHistory[i];
    if (letter.from === from) return excerpt(letter.content);
  }
  return '';
}

export function buildLetterContinuationPrompt(state: PlayerState, mode: 'read' | 'reply'): string {
  const location = state.location || '长安';
  const latestLinLetter = latestLetterFrom(state, 'linShen');
  const latestPlayerReply = latestLetterFrom(state, 'player');

  if (mode === 'reply') {
    return `（我已经把回信投入邮箱。请从当前位置"${location}"继续长安中的当下场景，让我刚才的回信影响我的情绪或接下来遇到的人。我的回信大意是："${latestPlayerReply || '我写下了自己的回应'}"。不要重置回客栈，不要凭空反复引入黑衣人。）`;
  }

  return `（我收好林深的来信。请从当前位置"${location}"继续，不要重置剧情；让信里的一个具体细节自然影响我接下来观察长安的方式。最近这封信的大意是："${latestLinLetter || '林深写来了一封来自远方的信'}"。不要默认回客栈，不要凭空反复引入黑衣人。）`;
}
