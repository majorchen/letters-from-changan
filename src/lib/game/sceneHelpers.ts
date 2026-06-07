import type { ChatMessage } from '@/lib/gameState';
import type { PlayerState } from '@/lib/prompts';

export const LOCATION_KEYWORDS = [
  { keyword: '西市', scene: 'Tang Dynasty West Market bazaar, crowded stalls with silk fabrics spices and pottery, Persian and Chinese merchants trading, warm amber atmosphere, bustling energy' },
  { keyword: '东市', scene: 'Tang Dynasty East Market, elegant shops with jade calligraphy and luxury goods, scholars and nobles browsing, soft morning tones, wooden eaves' },
  { keyword: '客栈', scene: 'Interior of a Tang Dynasty inn room, wooden furniture, silk curtains, a mysterious ceramic mailbox in the corner, warm muted tones, quiet solitude' },
  { keyword: '酒肆', scene: 'Tang Dynasty wine house interior, patrons drinking and laughing, a musician playing pipa in the corner, warm amber atmosphere, lively mood' },
  { keyword: '城门', scene: 'Tang Dynasty Chang an Zhuque Gate, massive city walls, guards in armor, stream of travelers entering, warm golden atmosphere' },
  { keyword: '朱雀大街', scene: 'Tang Dynasty Zhuque Avenue, wide grand boulevard, crowds of people in colorful Tang robes, horse carriages, willow trees lining the road' },
  { keyword: '道观', scene: 'A quiet Taoist temple in Tang Dynasty Chang an, ancient cypress trees, a priest sweeping stone steps, serene atmosphere, muted green and amber tones' },
  { keyword: '坊', scene: 'A residential ward in Tang Dynasty Chang an, narrow alleys between courtyard houses, children playing, warm evening atmosphere, domestic tranquility' },
];

export function visualProfilesForScene(state: PlayerState, content: string): string {
  // 仅匹配在当前内容中明确提及的人物（通过名字或 ID）
  const profiles = Object.entries(state.visualProfiles || {})
    .filter(([key, profile]) =>
      key === state.role
      || content.includes(profile.name)
      || content.includes(key)
    )
    .slice(0, 4)
    .map(([, profile]) => `${profile.name}: ${profile.description}`);
  
  return profiles.length > 0 ? ` Characters present: ${profiles.join('; ')}` : '';
}

export function latestSceneFromMessages(messages: ChatMessage[]): string | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].sceneImage) return messages[i].sceneImage || null;
  }
  return null;
}
