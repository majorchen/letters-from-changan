const baseUrl = process.env.SMOKE_BASE_URL || 'https://letters-from-changan.vercel.app';

function makeState(role = 'scholar') {
  return {
    role,
    location: '王掌柜客栈',
    chapter: 'first_letter_read',
    knownNPCs: ['王掌柜'],
    events: ['发现邮箱', '在客栈听见军报传闻'],
    narrativeSummary: '玩家住进王掌柜客栈，发现一只会发光的陶瓷邮箱，并开始怀疑它和未来来信有关。',
    npcMemories: {
      王掌柜: {
        attitude: '谨慎',
        lastInteraction: '提醒玩家别在客栈里多问奇怪的邮箱。',
        knownFacts: ['见过邮箱发光'],
      },
    },
    eventVersions: {},
    crossLineEchoes: [],
    secondCorrespondentHints: [],
    storyTime: { day: 1, period: '黄昏' },
    storyPhase: 'act1',
    awaitingFreeInput: false,
    freeInputCount: 0,
    lastFreeInputTurn: 0,
    mailbox: {
      discovered: true,
      pendingFirstOpen: false,
      unread: [],
      lastGeneratedAtTurn: 0,
    },
    letterHistory: [],
    turnCount: 8,
    actionsToday: 0,
    lastPlayDate: new Date().toISOString().slice(0, 10),
  };
}

async function requestLetter(payload) {
  const startedAt = Date.now();
  const response = await fetch(`${baseUrl}/api/letter`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const elapsedMs = Date.now() - startedAt;
  const data = await response.json().catch(async () => ({ error: await response.text() }));
  if (!response.ok || !data.content) {
    throw new Error(`letter status=${response.status}, elapsed=${elapsedMs}ms, body=${JSON.stringify(data).slice(0, 400)}`);
  }
  return { content: String(data.content), elapsedMs, fallback: Boolean(data.fallback) };
}

function normalize(text) {
  return text.replace(/\s+/g, '').replace(/[，。！？、；：“”《》（）]/g, '').slice(0, 260);
}

function similarity(a, b) {
  const left = new Set(normalize(a));
  const right = new Set(normalize(b));
  if (left.size === 0 || right.size === 0) return 0;
  let overlap = 0;
  for (const char of left) {
    if (right.has(char)) overlap += 1;
  }
  return overlap / Math.min(left.size, right.size);
}

const state = makeState(process.env.SMOKE_ROLE || 'scholar');
const first = await requestLetter({
  playerReply: null,
  letterHistory: [],
  playerState: state,
});

const reply = '我收到你的信了。你说客栈多年后还在，可王掌柜却说后院去年才改过。你到底从哪里知道这些？';
const secondHistory = [
  { from: 'linShen', content: first.content, timestamp: Date.now() - 60000 },
  { from: 'player', content: reply, timestamp: Date.now() - 30000 },
];
const second = await requestLetter({
  playerReply: null,
  letterHistory: secondHistory,
  playerState: {
    ...state,
    letterHistory: secondHistory,
    narrativeSummary: `${state.narrativeSummary} 玩家回信质问林深为何知道客栈细节。`,
    turnCount: 12,
  },
});

const score = similarity(first.content, second.content);
if (score > 0.82) {
  throw new Error(`second letter is too similar to first letter; similarity=${score.toFixed(2)}`);
}

console.log(`first letter: ok (${first.elapsedMs}ms${first.fallback ? ', fallback' : ''})`);
console.log(`second letter: ok (${second.elapsedMs}ms, similarity=${score.toFixed(2)})`);
