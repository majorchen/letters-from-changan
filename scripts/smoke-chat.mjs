const roles = ['merchant', 'musician', 'wanderer', 'scholar'];
const baseUrl = process.env.SMOKE_BASE_URL || 'http://localhost:3001';

function makeState(role) {
  return {
    role,
    location: '长安城门外',
    chapter: 'arrival',
    knownNPCs: [],
    events: [],
    narrativeSummary: '',
    npcMemories: {},
    eventVersions: {},
    secondCorrespondentHints: [],
    storyTime: { day: 1, period: '清晨' },
    storyPhase: 'act1',
    awaitingFreeInput: false,
    freeInputCount: 0,
    lastFreeInputTurn: 0,
    mailbox: {
      discovered: false,
      pendingFirstOpen: false,
      unread: [],
      lastGeneratedAtTurn: 0,
    },
    letterHistory: [],
    turnCount: 0,
    actionsToday: 0,
    lastPlayDate: new Date().toISOString().slice(0, 10),
  };
}

async function smokeRole(role) {
  const response = await fetch(`${baseUrl}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messages: [{ role: 'user', content: '我走进长安城门，先停下看看四周。' }],
      playerState: makeState(role),
    }),
  });

  const text = await response.text();
  const hasContent = text.includes('"content"');
  if (!response.ok || !hasContent) {
    throw new Error(`${role}: status=${response.status}, hasContent=${hasContent}, body=${text.slice(0, 240)}`);
  }
  console.log(`${role}: ok (${response.status})`);
}

for (const role of roles) {
  await smokeRole(role);
}
