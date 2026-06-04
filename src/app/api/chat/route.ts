import { NextRequest } from 'next/server';
import OpenAI from 'openai';

function getClient() {
  return new OpenAI({
    apiKey: process.env.AGNES_API_KEY || '',
    baseURL: process.env.AGNES_API_URL || 'https://apihub.agnes-ai.com/v1',
  });
}

export async function POST(req: NextRequest) {
  const { messages, systemPrompt } = await req.json();

  const allMessages = [
    { role: 'system' as const, content: systemPrompt },
    ...messages.map((m: { role: string; content: string }) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    })),
  ];

  try {
    const stream = await getClient().chat.completions.create({
      model: 'agnes-2.0-flash',
      messages: allMessages,
      stream: true,
      temperature: 0.85,
      max_tokens: 500,
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
