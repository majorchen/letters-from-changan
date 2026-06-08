import type { ChatMessage } from '@/lib/gameState';
import type { PlayerState } from '@/lib/prompts';
import { IMAGE_CONSTRAINT_SUFFIX, IMAGE_STYLE_PREFIX } from '@/lib/prompts';

export const LOCATION_KEYWORDS = [
  { keyword: '西市', scene: 'Tang Dynasty West Market bazaar, crowded stalls with silk fabrics spices and pottery, merchants trading, warm amber atmosphere, bustling energy' },
  { keyword: '东市', scene: 'Tang Dynasty East Market, elegant shops with jade calligraphy and luxury goods, scholars and nobles browsing, soft morning tones, wooden eaves' },
  { keyword: '客栈', scene: 'Interior of a Tang Dynasty inn room, wooden furniture, silk curtains, a mysterious ceramic mailbox in the corner, warm muted tones, quiet solitude' },
  { keyword: '酒肆', scene: 'Tang Dynasty wine house interior, patrons at wooden tables, steam from food and wine jars, warm amber atmosphere, lively mood' },
  { keyword: '城门', scene: 'Tang Dynasty Chang an Zhuque Gate, massive city walls, guards in armor, stream of travelers entering, warm golden atmosphere' },
  { keyword: '朱雀大街', scene: 'Tang Dynasty Zhuque Avenue, wide grand boulevard, crowds of people in colorful Tang robes, horse carriages, willow trees lining the road' },
  { keyword: '道观', scene: 'A quiet Taoist temple in Tang Dynasty Chang an, ancient cypress trees, a priest sweeping stone steps, serene atmosphere, muted green and amber tones' },
  { keyword: '坊', scene: 'A residential ward in Tang Dynasty Chang an, narrow alleys between courtyard houses, children playing, warm evening atmosphere, domestic tranquility' },
];

export function extractScenePrompt(content: string): string | null {
  const patterns = [
    /\[\s*SCENE\s*:\s*([\s\S]*?)\]/i,
    /【\s*SCENE\s*[：:]\s*([\s\S]*?)】/i,
    /\[\s*SCENE\s*\]([\s\S]*?)\[\s*\/\s*SCENE\s*\]/i,
    /【\s*SCENE\s*】([\s\S]*?)【\s*\/\s*SCENE\s*】/i,
  ];

  for (const pattern of patterns) {
    const match = content.match(pattern);
    const scene = match?.[1]?.trim();
    if (scene) return scene.replace(/\s+/g, ' ').slice(0, 500);
  }

  return null;
}

export function fallbackSceneFromNarrative(location: string, narrative: string): string {
  const summary = narrative
    .replace(/\s+/g, ' ')
    .replace(/[【\[]\s*\/?\s*scene\s*\/?\s*[】\]]/gi, '')
    .trim()
    .slice(-220);
  return `Tang Dynasty Chang'an scene at ${location || 'Chang an'}, based on this narrative moment: ${summary || 'the traveler pauses amid the city atmosphere'}, warm historical atmosphere`;
}

function mentionsPlayerRole(state: PlayerState, content: string): boolean {
  const roleNames: Record<string, string[]> = {
    merchant: ['商人', '行商', '货样', '账本', '包裹'],
    musician: ['乐师', '琵琶', '琴弦', '拨弦', '弹奏'],
    wanderer: ['游侠', '短刀', '刀鞘', '刀'],
    scholar: ['书生', '策论', '书卷', '赶考'],
  };
  return (roleNames[state.role] || []).some((keyword) => content.includes(keyword));
}

function selectedVisualProfiles(state: PlayerState, content: string) {
  const entries = Object.entries(state.visualProfiles || {});
  return entries
    .filter(([key, profile]) => {
      if (key === state.role) return mentionsPlayerRole(state, content);
      return content.includes(profile.name) || content.includes(key);
    })
    .slice(0, 3);
}

export function visualProfilesForScene(state: PlayerState, content: string): string {
  const profiles = selectedVisualProfiles(state, content)
    .map(([, profile], index) => {
      const label = String.fromCharCode(65 + index);
      return `Character ${label} (${profile.name}): ${profile.description}`;
    });

  if (profiles.length === 0) return '';
  return [
    ' Named character binding:',
    profiles.join('; '),
    'Keep each named character visually distinct. Do not transfer clothing, props, hairstyle, age, or ethnicity between characters. Do not duplicate any named character. Background people must be generic, visually distinct, and must not copy named character outfits or props.',
  ].join(' ');
}

export function buildImagePrompt(scene: string, state: PlayerState, content: string): string {
  const characterProfiles = visualProfilesForScene(state, content);
  return `${IMAGE_STYLE_PREFIX} ${scene}${characterProfiles} ${IMAGE_CONSTRAINT_SUFFIX}`;
}

export function latestSceneFromMessages(messages: ChatMessage[]): string | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].sceneImage) return messages[i].sceneImage || null;
  }
  return null;
}
