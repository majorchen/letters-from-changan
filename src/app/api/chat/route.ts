import { NextRequest } from 'next/server';
import OpenAI from 'openai';
import { buildSystemPrompt } from '@/lib/prompts';
import { normalizePlayerStateForApi } from '@/lib/normalize';
import { checkRateLimit } from '@/lib/rateLimit';
import { stripScenePromptLeak } from '@/lib/game/responseSanitizers';
import { parseAiTurn } from '@/lib/game/aiTurnParser';
import { fallbackOptions } from '@/lib/game/optionLogic';

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

function parseRepairOptions(content: string): string[] {
  try {
    const match = content.match(/\[[\s\S]*\]/);
    if (!match) return [];
    const parsed = JSON.parse(match[0]);
    if (!Array.isArray(parsed)) return [];
    return Array.from(new Set(
      parsed
        .filter((item): item is string => typeof item === 'string')
        .map((item) => item.trim().slice(0, 28))
        .filter(Boolean),
    )).slice(0, 3);
  } catch {
    return [];
  }
}

async function repairMissingOptions(
  allMessages: { role: 'system' | 'user' | 'assistant'; content: string }[],
  fullContent: string,
  normalizedState: NonNullable<ReturnType<typeof normalizePlayerStateForApi>>,
  cleanClientMessages: { role: 'user' | 'assistant'; content: string }[],
): Promise<string[]> {
  try {
    const response = await client.chat.completions.create({
      model: 'agnes-2.0-flash',
      messages: [
        ...allMessages,
        { role: 'assistant' as const, content: fullContent },
        {
          role: 'user' as const,
          content: '上一轮回复缺少 [OPTIONS_JSON]。只根据上一轮正文生成 2-3 个中文行动选项，必须具体引用本轮人物、物件或冲突。只输出合法 JSON 字符串数组，不要解释，不要 Markdown。',
        },
      ],
      temperature: 0.35,
      max_tokens: 160,
    });
    const repaired = parseRepairOptions(response.choices[0]?.message?.content || '');
    if (repaired.length > 0) return repaired;
  } catch (error) {
    console.warn('[chat-options-repair]', error);
  }
  return fallbackOptions(
    normalizedState,
    fullContent,
    cleanClientMessages.map((message) => ({ ...message, timestamp: 0 })),
  );
}

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
          let mailboxSent = false;

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

              if (!mailboxSent && (parsed.mailboxTriggered || /MAILBOX\s*[:：]\s*pending_first_open/i.test(fullContent))) {
                mailboxSent = true;
                sendEvent({ type: 'mailbox' });
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
          if (!mailboxSent && (finalParsed.mailboxTriggered || /MAILBOX\s*[:：]\s*pending_first_open/i.test(fullContent))) {
            sendEvent({ type: 'mailbox' });
          }
          if (finalParsed.options.length === 0 && finalParsed.inputMode !== 'free') {
            const repairedOptions = await repairMissingOptions(allMessages, fullContent, normalizedState, cleanClientMessages);
            if (repairedOptions.length > 0) {
              fullContent = `${fullContent.trim()}\n\n[OPTIONS_JSON]${JSON.stringify(repairedOptions)}[/OPTIONS_JSON]`;
              const repairedOptionsKey = repairedOptions.join('\u0001');
              if (repairedOptionsKey !== lastOptionsKey) {
                sendEvent({ type: 'options', options: repairedOptions });
              }
            }
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
