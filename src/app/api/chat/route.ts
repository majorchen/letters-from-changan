import { NextRequest } from 'next/server';
import OpenAI from 'openai';
import { buildSystemPrompt, PlayerState, ROLES, getMailboxState, getStoryPhase, getStoryTime, STORY_PERIODS } from '@/lib/prompts';

type ClientMessage = {
  role: string;
  content: string;
};

function cleanMessages(messages: unknown): { role: 'user' | 'assistant'; content: string }[] {
  if (!Array.isArray(messages)) return [];
  return messages
    .filter((message): message is ClientMessage => {
      if (!message || typeof message !== 'object') return false;
      const item = message as Record<string, unknown>;
      return (item.role === 'user' || item.role === 'assistant') && typeof item.content === 'string';
    })
    .slice(-20)
    .map((message) => ({
      role: message.role as 'user' | 'assistant',
      content: message.content.slice(0, 2000),
    }));
}

function normalizePlayerState(value: unknown): PlayerState | null {
  if (!value || typeof value !== 'object') return null;
  const state = value as Partial<PlayerState>;
  if (!state.role || !(state.role in ROLES)) return null;
  const mailbox = getMailboxState(state);
  const storyTime = getStoryTime(state);
  return {
    role: state.role,
    location: typeof state.location === 'string' ? state.location.slice(0, 80) : '长安城门外',
    chapter: typeof state.chapter === 'string' ? state.chapter.slice(0, 60) : 'arrival',
    knownNPCs: Array.isArray(state.knownNPCs) ? state.knownNPCs.filter((item): item is string => typeof item === 'string').slice(0, 20) : [],
    events: Array.isArray(state.events) ? state.events.filter((item): item is string => typeof item === 'string').slice(0, 40) : [],
    narrativeSummary: typeof state.narrativeSummary === 'string' ? state.narrativeSummary.slice(0, 500) : '',
    npcMemories: state.npcMemories && typeof state.npcMemories === 'object' ? state.npcMemories : {},
    storyTime: {
      day: Number.isFinite(state.storyTime?.day) ? Number(state.storyTime?.day) : storyTime.day,
      period: state.storyTime?.period && STORY_PERIODS.includes(state.storyTime.period) ? state.storyTime.period : storyTime.period,
    },
    storyPhase: state.storyPhase || getStoryPhase(state).phase,
    hasMailbox: mailbox.discovered,
    unreadLetters: mailbox.unread.length,
    mailbox,
    letterHistory: Array.isArray(state.letterHistory) ? state.letterHistory.slice(-12) as PlayerState['letterHistory'] : [],
    turnCount: Number.isFinite(state.turnCount) ? Number(state.turnCount) : 0,
    actionsToday: 0,
    lastPlayDate: typeof state.lastPlayDate === 'string' ? state.lastPlayDate : new Date().toISOString().split('T')[0],
  };
}

function getClient() {
  return new OpenAI({
    apiKey: process.env.AGNES_API_KEY || '',
    baseURL: process.env.AGNES_API_URL || 'https://apihub.agnes-ai.com/v1',
  });
}

export async function POST(req: NextRequest) {
  if (!process.env.AGNES_API_KEY) {
    return Response.json({ error: 'Missing AGNES_API_KEY' }, { status: 500 });
  }

  const { messages, playerState } = await req.json();
  const normalizedState = normalizePlayerState(playerState);
  if (!normalizedState) {
    return Response.json({ error: 'Invalid playerState' }, { status: 400 });
  }

  const systemPrompt = buildSystemPrompt(normalizedState.role, normalizedState);
  const cleanClientMessages = cleanMessages(messages);

  const allMessages = [
    { role: 'system' as const, content: systemPrompt },
    ...cleanClientMessages,
  ];

  try {
    const stream = await getClient().chat.completions.create({
      model: 'agnes-2.0-flash',
      messages: allMessages,
      stream: true,
      temperature: 0.85,
      max_tokens: 1000,
    });

    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of stream) {
            const content = chunk.choices[0]?.delta?.content || '';
            if (content) {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content })}\n\n`));
            }
          }
          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          controller.close();
        } catch (err) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: String(err) })}\n\n`));
          controller.close();
        }
      },
    });

    return new Response(readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    });
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 });
  }
}
