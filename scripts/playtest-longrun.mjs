const baseUrl = process.env.SMOKE_BASE_URL || 'https://letterstang.aifisher.cn';
const roles = (process.env.PLAYTEST_ROLES || 'scholar').split(',').map((role) => role.trim()).filter(Boolean);
const turns = Number(process.env.PLAYTEST_TURNS || 12);

const roleStarts = {
  merchant: '我牵着瘦马进了长安，先去找能落脚的客栈。',
  musician: '我抱紧琵琶，想先听听城门附近的人声和曲调。',
  wanderer: '我压低刀鞘，沿着朱雀大街慢慢观察有没有人跟着我。',
  scholar: '我收好策论，向王掌柜打听最近长安城里的异闻。',
};

const probes = [
  '继续观察刚才提到的细节，不要急着换场景。',
  '我追问这个人刚才那句话是什么意思。',
  '我把刚才发生的事记在心里，看看周围有没有呼应。',
  '我选择暂时不碰信件，先看看长安本身有什么变化。',
  '我想确认这里是不是和之前说过的不一样。',
  '我停下来，问身边人是否记得我刚才做过的事。',
];

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
    crossLineEchoes: [],
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

function parseSse(text) {
  let content = '';
  for (const line of text.split('\n')) {
    if (!line.startsWith('data: ')) continue;
    const data = line.slice(6);
    if (data === '[DONE]') continue;
    try {
      content += JSON.parse(data).content || '';
    } catch {
      // Ignore partial or malformed chunks in a smoke harness.
    }
  }
  return content;
}

function parseStateBlock(text) {
  const match = text.match(/\[STATE\]([\s\S]*?)\[\/STATE\]/i);
  if (!match) return {};
  const update = {};
  for (const rawLine of match[1].split('\n')) {
    const line = rawLine.trim();
    const separatorIndex = line.indexOf(':');
    if (separatorIndex < 0) continue;
    const key = line.slice(0, separatorIndex).trim().toUpperCase();
    const value = line.slice(separatorIndex + 1).trim();
    if (!value || value.toLowerCase() === 'none') continue;
    update[key] = value;
  }
  return update;
}

function applyStateUpdate(state, raw) {
  const update = parseStateBlock(raw);
  const next = { ...state, turnCount: state.turnCount + 1 };
  if (update.LOCATION) next.location = update.LOCATION.slice(0, 80);
  if (update.SUMMARY) next.narrativeSummary = update.SUMMARY.slice(0, 500);
  if (update.NPCS) {
    const npcs = update.NPCS.split(/[、,，]/).map((item) => item.trim()).filter(Boolean);
    next.knownNPCs = Array.from(new Set([...next.knownNPCs, ...npcs])).slice(-20);
  }
  if (update.EVENTS) {
    const events = update.EVENTS.split(/[、,，]/).map((item) => item.trim()).filter(Boolean);
    next.events = Array.from(new Set([...next.events, ...events])).slice(-40);
  }
  if (update.MAILBOX === 'pending_first_open' || raw.includes('[MAILBOX]')) {
    next.chapter = 'mailbox_found';
    next.mailbox = {
      ...next.mailbox,
      discovered: true,
      pendingFirstOpen: true,
      unread: next.mailbox.unread.length > 0 ? next.mailbox.unread : [{ id: `letter-${Date.now()}`, from: 'linShen', createdAt: Date.now() }],
    };
  }
  if (next.turnCount >= 60 && next.turnCount < 180) next.storyPhase = 'act2';
  if (next.turnCount >= 180) next.storyPhase = 'act3';
  return next;
}

function clean(text) {
  return text
    .replace(/\[SCENE:[^\]]*\]/gi, '')
    .replace(/\[STATE\][\s\S]*?\[\/STATE\]/gi, '')
    .replace(/\[MAILBOX\]/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function repeatedTemplateRisk(history) {
  const recent = history.slice(-6).map((item) => clean(item.content).slice(0, 80));
  return recent.some((item, index) => item && recent.indexOf(item) !== index);
}

async function requestChat(messages, state) {
  const startedAt = Date.now();
  const response = await fetch(`${baseUrl}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages: messages.slice(-20), playerState: state }),
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`chat status=${response.status}, body=${text.slice(0, 400)}`);
  }
  return { content: parseSse(text), elapsedMs: Date.now() - startedAt };
}

for (const role of roles) {
  let state = makeState(role);
  const messages = [];
  const timings = [];

  for (let turn = 0; turn < turns; turn += 1) {
    const userText = turn === 0 ? roleStarts[role] || roleStarts.scholar : probes[(turn - 1) % probes.length];
    messages.push({ role: 'user', content: userText });
    const result = await requestChat(messages, state);
    timings.push(result.elapsedMs);
    messages.push({ role: 'assistant', content: result.content });
    state = applyStateUpdate(state, result.content);
    console.log(`${role} turn ${turn + 1}/${turns}: ${result.elapsedMs}ms, location=${state.location}, events=${state.events.length}`);
  }

  const avg = Math.round(timings.reduce((sum, value) => sum + value, 0) / timings.length);
  const risk = repeatedTemplateRisk(messages.filter((message) => message.role === 'assistant'));
  console.log(`${role}: done, avg=${avg}ms, summary=${state.narrativeSummary ? 'yes' : 'no'}, repeatedTemplateRisk=${risk ? 'yes' : 'no'}`);
  if (!state.narrativeSummary) {
    throw new Error(`${role}: narrativeSummary was not updated during ${turns} turns`);
  }
  if (risk) {
    throw new Error(`${role}: repeated assistant opening detected in recent turns`);
  }
}
