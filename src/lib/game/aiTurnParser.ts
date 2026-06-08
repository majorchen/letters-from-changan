import type { NarrativeStateUpdate } from '@/lib/gameState';
import { cleanNarrative, extractOptions, parseNarrativeState } from './narrativeParsing';
import { extractScenePrompt } from './sceneHelpers';

export interface ParsedAiTurn {
  narrative: string;
  options: string[];
  scenePrompt: string | null;
  state: NarrativeStateUpdate | undefined;
  mailboxTriggered: boolean;
  inputMode: 'options' | 'free';
  warnings: string[];
}

interface ParseAiTurnOptions {
  partial?: boolean;
}

const STRUCTURED_LINE_PATTERN = /(?:^|\n)\s*(?:\[OPTIONS_JSON\]|\[SCENE\b|\[STATE\]|\[MAILBOX\]|LOCATION\s*[:：]|NPCS\s*[:：]|EVENTS\s*[:：]|SUMMARY\s*[:：]|NPC_MEMORY\s*[:：]|VISUAL_PROFILE\s*[:：]|EVENT_VERSION\s*[:：]|SECOND_CORRESPONDENT\s*[:：]|VISUAL\s*[:：]|INPUT\s*[:：]|MAILBOX\s*[:：])/i;
const RAW_OPTIONS_ARRAY_PATTERN = /(?:^|\n)\s*\[\s*"[^"\n]{1,80}"(?:\s*,\s*"[^"\n]{1,80}"){0,3}\s*\]\s*(?=\n|$)/;

function narrativeSource(raw: string): string {
  const markers = [
    raw.match(STRUCTURED_LINE_PATTERN),
    raw.match(RAW_OPTIONS_ARRAY_PATTERN),
  ].filter((match): match is RegExpMatchArray => Boolean(match));

  const firstMarker = markers.reduce<number | null>((earliest, match) => {
    if (match.index === undefined) return earliest;
    return earliest === null ? match.index : Math.min(earliest, match.index);
  }, null);

  return firstMarker === null ? raw : raw.slice(0, firstMarker);
}

function hasUnclosedStructure(raw: string): boolean {
  return /\[(?:OPTIONS_JSON|SCENE|STATE|MAILBOX)[^\]]*$/i.test(raw);
}

export function parseAiTurn(raw: string, options: ParseAiTurnOptions = {}): ParsedAiTurn {
  const warnings: string[] = [];
  const narrative = cleanNarrative(narrativeSource(raw));
  const parsedOptions = options.partial ? [] : extractOptions(raw);
  const state = options.partial ? undefined : parseNarrativeState(raw);
  const scenePrompt = extractScenePrompt(raw);
  const mailboxTriggered = raw.includes('[MAILBOX]');
  const inputMode = state?.inputMode === 'free' ? 'free' : 'options';

  if (!options.partial && parsedOptions.length === 0 && inputMode !== 'free') {
    warnings.push('missing_options');
  }
  if (!options.partial && raw.includes('[STATE]') && !state) {
    warnings.push('invalid_state');
  }
  if (options.partial && hasUnclosedStructure(raw)) {
    warnings.push('partial_structure');
  }

  return {
    narrative,
    options: parsedOptions,
    scenePrompt,
    state,
    mailboxTriggered,
    inputMode,
    warnings,
  };
}
