import { parseAiTurn } from './aiTurnParser';

type FixtureExpectation = {
  narrativeIncludes: string;
  narrativeExcludes: string[];
  options?: string[];
  scenePromptIncludes?: string;
  location?: string;
};

type Fixture = {
  name: string;
  raw: string;
  expected: FixtureExpectation;
};

export const AI_TURN_PARSER_FIXTURES: Fixture[] = [
  {
    name: 'strict tagged response',
    raw: `你推开酒肆厚重的木门，热气扑面而来。

[OPTIONS_JSON]["询问掌柜那首曲子的来处","坐到角落听完一曲"][/OPTIONS_JSON]

[SCENE:A pipa musician pauses beside a wine table, patrons turn toward the sound, warm amber atmosphere]
[STATE]
LOCATION: 朱雀大街酒肆
NPCS: 阿依
EVENTS: none
SUMMARY: 玩家进入酒肆，注意到一段异样旋律。
NPC_MEMORY: 阿依|好奇|注意到玩家听懂旋律
VISUAL_PROFILE: 阿依|A young Persian woman with teal silk scarf
EVENT_VERSION: none
SECOND_CORRESPONDENT: none
VISUAL: none
INPUT: options
MAILBOX: none
[/STATE]`,
    expected: {
      narrativeIncludes: '你推开酒肆',
      narrativeExcludes: ['OPTIONS_JSON', 'SCENE', 'LOCATION:', 'VISUAL_PROFILE'],
      options: ['询问掌柜那首曲子的来处', '坐到角落听完一曲'],
      scenePromptIncludes: 'pipa musician',
      location: '朱雀大街酒肆',
    },
  },
  {
    name: 'raw json options array',
    raw: `阿依抬起头，那双深邃的大眼睛里闪过一丝惊讶。

["追问父亲是谁","展示琵琶演奏同样的旋律","询问李无名的看法"]`,
    expected: {
      narrativeIncludes: '阿依抬起头',
      narrativeExcludes: ['追问父亲是谁', '['],
      options: ['追问父亲是谁', '展示琵琶演奏同样的旋律', '询问李无名的看法'],
    },
  },
  {
    name: 'streaming state prefix leak',
    raw: `说完，他像是耗尽了力气，瘫软在地。

LOCATION: 崇仁坊街角/朱雀门附近
NPCS: 驿卒, 守门兵`,
    expected: {
      narrativeIncludes: '说完',
      narrativeExcludes: ['LOCATION:', 'NPCS:'],
    },
  },
];

export function runAiTurnParserFixtureAssertions() {
  const partialOptions = parseAiTurn('正文\n\n[OPTIONS_JSON]["追问来意","暂且观察"][/OPTIONS_JSON]\n\n[STATE]\nLOCATION:', { partial: true });
  if (partialOptions.options.join('|') !== '追问来意|暂且观察') {
    throw new Error('partial options: options mismatch');
  }
  if (partialOptions.narrative.includes('OPTIONS_JSON') || partialOptions.narrative.includes('LOCATION:')) {
    throw new Error('partial options: narrative leaked structured fields');
  }

  for (const fixture of AI_TURN_PARSER_FIXTURES) {
    const parsed = parseAiTurn(fixture.raw);
    if (!parsed.narrative.includes(fixture.expected.narrativeIncludes)) {
      throw new Error(`${fixture.name}: narrative missing expected text`);
    }
    for (const excluded of fixture.expected.narrativeExcludes) {
      if (parsed.narrative.includes(excluded)) {
        throw new Error(`${fixture.name}: narrative leaked ${excluded}`);
      }
    }
    if (fixture.expected.options) {
      const actual = parsed.options.join('|');
      const expected = fixture.expected.options.join('|');
      if (actual !== expected) {
        throw new Error(`${fixture.name}: options mismatch: ${actual}`);
      }
    }
    if (fixture.expected.scenePromptIncludes && !parsed.scenePrompt?.includes(fixture.expected.scenePromptIncludes)) {
      throw new Error(`${fixture.name}: scene prompt mismatch`);
    }
    if (fixture.expected.location && parsed.state?.location !== fixture.expected.location) {
      throw new Error(`${fixture.name}: state location mismatch`);
    }
  }
}
