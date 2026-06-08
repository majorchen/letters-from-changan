import type { ChatMessage, NarrativeStateUpdate } from '@/lib/gameState';
import type { PlayerState } from '@/lib/prompts';
import { isLetterRelatedOption } from './mailboxLogic';

const SCENE_PROMPT_LINE_PATTERN = /\b(scene prompt|image prompt|visual prompt|prompt:|aged silk|ink wash|watercolor|cinematic|wide composition|no photorealism|photorealistic|tang dynasty|chang'?an|ancient chinese|historical chinese|illustration|brushwork|muted colors|soft lighting|ambient light|composition)\b/i;

function isLikelyScenePromptLeak(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed) return false;
  const asciiLetters = (trimmed.match(/[A-Za-z]/g) || []).length;
  const cjkChars = (trimmed.match(/[\u3400-\u9fff]/g) || []).length;
  return asciiLetters >= 24 && asciiLetters > cjkChars * 2 && SCENE_PROMPT_LINE_PATTERN.test(trimmed);
}

function localizeInlineEnglishTerms(content: string): string {
  return content
    .replace(/\bTang-Persian\b/g, '唐式波斯')
    .replace(/\bPersian\b/g, '波斯')
    .replace(/\bteal\b/g, '青绿色');
}

export function stripScenePromptLeak(raw: string): string {
  let content = raw;
  content = content.replace(/\[SCENE:[\s\S]*?(?:\]|$)/gi, '');
  content = content.replace(/【\s*SCENE\s*[：:][\s\S]*?(?:】|$)/gi, '');
  content = content.replace(/\[\s*SCENE\s*\][\s\S]*?(?:\[\s*\/\s*SCENE\s*\]|$)/gi, '');
  content = content.replace(/【\s*SCENE\s*】[\s\S]*?(?:【\s*\/\s*SCENE\s*】|$)/gi, '');
  content = content.replace(/[【\[]\s*\/?\s*scene\s*\/?\s*[】\]]/gi, '');
  content = content.replace(/^\s*(?:SCENE|Scene|IMAGE PROMPT|Image prompt|Visual prompt)\s*[:：].*$/gim, '');
  content = content
    .split('\n')
    .filter((line) => !isLikelyScenePromptLeak(line))
    .join('\n');
  content = content.replace(/\n{3,}/g, '\n\n');
  return content.trim();
}

export function sanitizeResponse(raw: string, state: PlayerState): string {
  let content = stripScenePromptLeak(raw);
  content = content.replace(/\[\s*\/?\s*(STATE|SCENE|OPTIONS_JSON|MAILBOX)\s*\/?\s*\]/gi, '');
  content = content.replace(/【\s*\/?\s*(STATE|SCENE|OPTIONS_JSON|MAILBOX)\s*\/?\s*】/gi, '');
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
  return localizeInlineEnglishTerms(content);
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
