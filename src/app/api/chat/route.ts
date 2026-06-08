import { NextRequest } from 'next/server';
import OpenAI from 'openai';
import { buildSystemPrompt } from '@/lib/prompts';
import { normalizePlayerStateForApi } from '@/lib/normalize';
import { checkRateLimit } from '@/lib/rateLimit';
import { stripScenePromptLeak } from '@/lib/game/responseSanitizers';
import { parseAiTurn } from '@/lib/game/aiTurnParser';

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
      content: stripScenePromptLeak(message.content).slice(0, 2000),
    }));
}

const client = new OpenAI({
  apiKey: process.env.AGNES_API_KEY || '',
  baseURL: process.env.AGNES_API_URL || 'https://apihub.agnes-ai.com/v1',
});

export async function POST(req: NextRequest) {
  const rateLimited = checkRateLimit(req);
  if (rateLimited) return rateLimited;

  if (!process.env.AGNES_API_KEY) {
    return Response.json({ error: 'Missing AGNES_API_KEY' }, { status: 500 });
  }

  const { messages, playerState } = await req.json();
  const normalizedState = normalizePlayerStateForApi(playerState);
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
    const stream = await client.chat.completions.create({
      model: 'agnes-2.0-flash',
      messages: allMessages,
      stream: true,
      temperature: 0.78,
      max_tokens: 1000,
    });

    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        const sendEvent = (payload: unknown) => {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
        };

        try {
          let fullContent = '';
          let lastNarrative = '';
          let lastOptionsKey = '';
          let sceneSent = false;

          for await (const chunk of stream) {
            let content = chunk.choices[0]?.delta?.content || '';
            // 简单过滤泄露的 LETTER_SCENE 标签
            content = content.replace(/\[LETTER_SCENE:[^\]]*\]/gi, '');
            if (content) {
              fullContent += content;
              const parsed = parseAiTurn(fullContent, { partial: true });

              if (parsed.narrative !== lastNarrative) {
                lastNarrative = parsed.narrative;
                sendEvent({ type: 'narrative', content: parsed.narrative });
              }

              const optionsKey = parsed.options.join('\u0001');
              if (parsed.options.length > 0 && optionsKey !== lastOptionsKey) {
                lastOptionsKey = optionsKey;
                sendEvent({ type: 'options', options: parsed.options });
              }

              if (!sceneSent && parsed.scenePrompt) {
                sceneSent = true;
                sendEvent({ type: 'scene', scene: parsed.scenePrompt });
              }
            }
          }
          const finalParsed = parseAiTurn(fullContent);
          const finalOptionsKey = finalParsed.options.join('\u0001');
          if (finalParsed.options.length > 0 && finalOptionsKey !== lastOptionsKey) {
            sendEvent({ type: 'options', options: finalParsed.options });
          }
          if (!sceneSent && finalParsed.scenePrompt) {
            sendEvent({ type: 'scene', scene: finalParsed.scenePrompt });
          }
          sendEvent({ type: 'done', content: fullContent });
          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          controller.close();
        } catch (err) {
          sendEvent({ error: String(err) });
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
