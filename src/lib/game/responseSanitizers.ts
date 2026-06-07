import type { ChatMessage, NarrativeStateUpdate } from '@/lib/gameState';
import type { PlayerState } from '@/lib/prompts';
import { isLetterRelatedOption } from './mailboxLogic';

export function sanitizeResponse(raw: string, state: PlayerState): string {
  let content = raw;
  content = content.replace(/信上写着[：:][\s\S]*/g, '');
  content = content.replace(/信中说[：:][\s\S]*/g, '');
  content = content.replace(/林深写道[：:][\s\S]*/g, '');
  content = content.replace(/信里写[：:][\s\S]*/g, '');
  const mailboxOverflow = content.match(/(金色光[芒辉]|金光涌出)[，。]/);
  if (mailboxOverflow && mailboxOverflow.index !== undefined) {
    const cutAt = mailboxOverflow.index + mailboxOverflow[0].length;
    const afterCut = content.slice(cutAt);
    const periodIdx = afterCut.indexOf('。');
    if (periodIdx >= 0) {
      content = content.slice(0, cutAt + periodIdx + 1);
    }
  }
  void state;
  return content;
}

export function sanitizeOptions(options: string[], messages: ChatMessage[]): string[] {
  const GENERIC_BLACKLIST = /^(观察细节|仔细查看|换个角度试探|打听消息|继续观察|四处看看)$/;
  let filtered = options.filter(opt => !GENERIC_BLACKLIST.test(opt));
  filtered = filtered.filter(opt => !isLetterRelatedOption(opt));
  void messages;
  return filtered.length > 0 ? filtered : options.slice(0, 1);
}

export function sanitizeState(parsed: NarrativeStateUpdate, playerState: PlayerState): NarrativeStateUpdate {
  if (parsed.visualCue === 'ending' && (playerState.storyPhase || 'act1') !== 'act3') {
    parsed.visualCue = 'none';
  }
  if (parsed.visualCue === 'glitch' || parsed.visualCue === 'memory') {
    parsed.visualCue = 'none';
  }
  if (parsed.inputMode === 'free' && (playerState.freeInputCount || 0) >= 3) {
    parsed.inputMode = 'options';
  }
  return parsed;
}
