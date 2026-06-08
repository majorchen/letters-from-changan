import type { NarrativeStateUpdate } from '@/lib/gameState';
import type { VisualProfile } from '@/lib/prompts';

export function cleanNarrative(text: string): string {
  return text
    .replace(/\[OPTIONS_JSON\][\s\S]*?\[\/OPTIONS_JSON\]/gi, '')
    .replace(/(?:^|\n)\s*\[\s*"[^"\n]{1,80}"(?:\s*,\s*"[^"\n]{1,80}"){0,3}\s*\]\s*(?=\n|$)/g, '')
    // Remove closed [SCENE:...] / [MAILBOX] tags anywhere
    .replace(/\[SCENE:[^\]]*\]/gi, '')
    .replace(/【\s*SCENE\s*[：:][\s\S]*?】/gi, '')
    .replace(/\[\s*SCENE\s*\][\s\S]*?\[\s*\/\s*SCENE\s*\]/gi, '')
    .replace(/【\s*SCENE\s*】[\s\S]*?【\s*\/\s*SCENE\s*】/gi, '')
    .replace(/[【\[]\s*\/?\s*scene\s*\/?\s*[】\]]/gi, '')
    .replace(/\[STATE\][\s\S]*?\[\/STATE\]/gi, '')
    .replace(/\[\s*\/?\s*(STATE|SCENE|OPTIONS_JSON|MAILBOX)\s*\/?\s*\]/gi, '')
    .replace(/【\s*\/?\s*(STATE|SCENE|OPTIONS_JSON|MAILBOX)\s*\/?\s*】/gi, '')
    .replace(/\[MAILBOX\]/gi, '')
    // Truncate from the FIRST option marker to the end (handles mid-stream)
    .replace(/(?:【\s*选项\s*[a-cA-C]?\s*】|(?:^|\n)\s*选项\s*[a-cA-C]\s*[：:]|(?:^|\n)\s*[a-cA-C]\s*[\.、:：)]|(?:^|\n)\s*[1-3]\s*[\.、:：)）])[\s\S]*$/i, '')
    // Truncate unclosed tags appearing at the end during streaming
    .replace(/\[SCENE:[\s\S]*$/i, '')
    .replace(/【\s*SCENE[\s\S]*$/i, '')
    .replace(/\[STATE[\s\S]*$/i, '')
    .replace(/\[MAILBOX[\s\S]*$/i, '')
    .replace(/\[OPTIONS_JSON[\s\S]*$/i, '')
    .replace(/\[\s*$/, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function recoverNarrativeText(text: string): string {
  const beforeOptions = text.split(/\[OPTIONS_JSON\]|(?:^|\n)\s*\[\s*"[^"\n]{1,80}"(?:\s*,\s*"[^"\n]{1,80}"){0,3}\s*\]|【\s*选项|(?:^|\n)\s*(?:选项\s*)?[A-C1-3][\.、:：)）]/i)[0] || text;
  return cleanNarrative(beforeOptions);
}

export function cleanStreamingNarrative(text: string): string {
  const structuredStart = text.match(
    /(?:^|\n)\s*(?:\[STATE\]|LOCATION\s*[:：]|NPCS\s*[:：]|EVENTS\s*[:：]|SUMMARY\s*[:：]|NPC_MEMORY\s*[:：]|VISUAL_PROFILE\s*[:：]|EVENT_VERSION\s*[:：]|SECOND_CORRESPONDENT\s*[:：]|VISUAL\s*[:：]|INPUT\s*[:：]|MAILBOX\s*[:：])/i,
  );
  const visibleText = structuredStart?.index !== undefined
    ? text.slice(0, structuredStart.index)
    : text;
  return cleanNarrative(visibleText);
}

// Extract option texts from raw AI content
function parseOptionsJsonContent(content: string): string[] {
  try {
    const trimmed = content.trim();
    let parsed: string[] = [];
    // Robust JSON parsing: handle array or raw lines
    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
      parsed = JSON.parse(trimmed);
    } else {
      // Fallback for AI occasionally outputting raw strings instead of JSON array
      parsed = trimmed.split(/[,\n]/).map(s => s.trim().replace(/^["']|["']$/g, '')).filter(Boolean);
    }

    if (Array.isArray(parsed)) {
      return Array.from(new Set(
        parsed
          .filter((item): item is string => typeof item === 'string')
          .map((item) => item.trim().slice(0, 60))
          .filter(Boolean),
      )).slice(0, 4);
    }
  } catch {
    // Fall through to other formats.
  }
  return [];
}

function extractTaggedOptionsContent(text: string): string | null {
  const closed = text.match(/\[\s*OPTIONS_JSON\s*\]([\s\S]*?)\[\s*\/OPTIONS_JSON\s*\]/i);
  if (closed) return closed[1];

  const open = text.match(/\[\s*OPTIONS_JSON\s*\]([\s\S]*)/i);
  if (!open) return null;
  const untilNextStructuredBlock = open[1].split(/\n\s*(?:\[\s*SCENE\b|\[\s*STATE\s*\]|\[\s*MAILBOX\s*\]|LOCATION\s*:|NPCS\s*:|EVENTS\s*:|SUMMARY\s*:)/i)[0];
  return untilNextStructuredBlock.trim() || null;
}

export function extractOptions(text: string): string[] {
  // Support both strict and unclosed OPTIONS_JSON tags.
  const taggedContent = extractTaggedOptionsContent(text);
  if (taggedContent) {
    const taggedOptions = parseOptionsJsonContent(taggedContent);
    if (taggedOptions.length > 0) return taggedOptions;
  }

  const rawJsonArray = text.match(/(?:^|\n)\s*(\[\s*"[^"\n]{1,80}"(?:\s*,\s*"[^"\n]{1,80}"){0,3}\s*\])\s*(?:\n|$)/);
  if (rawJsonArray) {
    try {
      const parsed = JSON.parse(rawJsonArray[1]);
      if (Array.isArray(parsed)) {
        return Array.from(new Set(
          parsed
            .filter((item): item is string => typeof item === 'string')
            .map((item) => item.trim().slice(0, 60))
            .filter(Boolean),
        )).slice(0, 4);
      }
    } catch {
      // Fall through to legacy option formats.
    }
  }

  const options: string[] = [];
  const patterns = [
    /【\s*选项\s*[A-C]?\s*】\s*([^\n【\[]+)/gi,
    /(?:^|\n)\s*选项\s*[A-C]\s*[：:]\s*([^\n【\[]+)/gi,
    /(?:^|\n)\s*[A-C]\s*[\.、:：)]\s*([^\n【\[]+)/gi,
    /(?:^|\n)\s*[1-3]\s*[\.、:：)）]\s*([^\n【\[]+)/g,
  ];

  for (const pattern of patterns) {
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(text)) !== null) {
      const option = match[1].replace(/\[SCENE:[\s\S]*$/i, '').trim();
      if (option) options.push(option.slice(0, 60));
    }
  }

  return Array.from(new Set(options)).slice(0, 4);
}

export function parseNarrativeState(text: string): NarrativeStateUpdate | undefined {
  const match = text.match(/\[STATE\]([\s\S]*?)\[\/STATE\]/i);
  if (!match) return undefined;
  const update: NarrativeStateUpdate = {};
  for (const rawLine of match[1].split('\n')) {
    const line = rawLine.trim();
    const separatorIndex = line.indexOf(':');
    if (separatorIndex < 0) continue;
    const key = line.slice(0, separatorIndex).trim().toUpperCase();
    const value = line.slice(separatorIndex + 1).trim();
    if (!value) continue;
    if (key === 'LOCATION' && value.toLowerCase() !== 'none') {
      update.location = value;
    }
    if (key === 'NPCS') {
      update.npcs = value.split(/[、,，]/).map(item => item.trim()).filter(Boolean);
    }
    if (key === 'EVENTS') {
      update.events = value.split(/[、,，]/).map(item => item.trim()).filter(Boolean);
    }
    if (key === 'SUMMARY' && value.toLowerCase() !== 'none') {
      update.summary = value;
    }
    if (key === 'NPC_MEMORY' && value.toLowerCase() !== 'none') {
      update.npcMemories = {};
      for (const rawEntry of value.split(/[;；]/)) {
        const [name, attitude, fact] = rawEntry.split('|').map(item => item.trim());
        if (!name || name.toLowerCase() === 'none') continue;
        update.npcMemories[name] = {
          attitude: attitude || '中立',
          lastInteraction: fact || '',
          knownFacts: fact ? [fact] : [],
        };
      }
    }
    if (key === 'VISUAL_PROFILE' && value.toLowerCase() !== 'none') {
      update.visualProfiles = {};
      for (const rawEntry of value.split(/[;；]/)) {
        const separator = rawEntry.indexOf('|');
        if (separator < 1) continue;
        const name = rawEntry.slice(0, separator).trim();
        const description = rawEntry.slice(separator + 1).trim();
        if (!name || !description) continue;
        update.visualProfiles[name] = {
          name,
          description: description.slice(0, 500),
          createdAt: Date.now(),
        } satisfies VisualProfile;
      }
    }
    if (key === 'EVENT_VERSION' && value.toLowerCase() !== 'none') {
      update.eventVersions = {};
      for (const rawEntry of value.split(/[;；]/)) {
        const [event, source, version] = rawEntry.split('|').map(item => item.trim());
        if (!event || !source || !version) continue;
        update.eventVersions[event] = {
          ...(update.eventVersions[event] || {}),
          [source]: version,
        };
      }
    }
    if (key === 'SECOND_CORRESPONDENT' && value.toLowerCase() !== 'none') {
      update.secondCorrespondentHint = value;
    }
    if (key === 'VISUAL') {
      const visual = value.toLowerCase();
      if (visual === 'none' || visual === 'glitch' || visual === 'memory' || visual === 'ending') {
        update.visualCue = visual;
      }
    }
    if (key === 'INPUT') {
      const inputMode = value.toLowerCase();
      if (inputMode === 'options' || inputMode === 'free') {
        update.inputMode = inputMode;
      }
    }
    if (key === 'MAILBOX') {
      const mailbox = value.toLowerCase();
      if (mailbox === 'none' || mailbox === 'pending_first_open' || mailbox === 'unread' || mailbox === 'quiet') {
        update.mailbox = mailbox;
      }
    }
  }
  return update;
}
