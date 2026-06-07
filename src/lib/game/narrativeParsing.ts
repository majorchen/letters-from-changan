import type { NarrativeStateUpdate } from '@/lib/gameState';
import type { VisualProfile } from '@/lib/prompts';

export function cleanNarrative(text: string): string {
  return text
    .replace(/\[OPTIONS_JSON\][\s\S]*?\[\/OPTIONS_JSON\]/gi, '')
    // Remove closed [SCENE:...] / [MAILBOX] tags anywhere
    .replace(/\[SCENE:[^\]]*\]/gi, '')
    .replace(/【\s*SCENE\s*[：:][\s\S]*?】/gi, '')
    .replace(/\[\s*SCENE\s*\][\s\S]*?\[\s*\/\s*SCENE\s*\]/gi, '')
    .replace(/【\s*SCENE\s*】[\s\S]*?【\s*\/\s*SCENE\s*】/gi, '')
    .replace(/[【\[]\s*\/?\s*scene\s*\/?\s*[】\]]/gi, '')
    .replace(/\[STATE\][\s\S]*?\[\/STATE\]/gi, '')
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

// Extract option texts from raw AI content
export function extractOptions(text: string): string[] {
  // Support both strict and loose spacing in tags
  const structured = text.match(/\[\s*OPTIONS_JSON\s*\]([\s\S]*?)\[\s*\/OPTIONS_JSON\s*\]/i);
  if (structured) {
    try {
      const content = structured[1].trim();
      let parsed: string[] = [];
      // Robust JSON parsing: handle array or raw lines
      if (content.startsWith('[') && content.endsWith(']')) {
        parsed = JSON.parse(content);
      } else {
        // Fallback for AI occasionally outputting raw strings instead of JSON array
        parsed = content.split(/[,\n]/).map(s => s.trim().replace(/^["']|["']$/g, '')).filter(Boolean);
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
