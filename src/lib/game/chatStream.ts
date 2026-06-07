const CHAT_TIMEOUT_MS = 45_000;

export async function streamChat(
  body: unknown,
  onContent: (content: string) => void,
  attempt = 1,
): Promise<string> {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), CHAT_TIMEOUT_MS);
  const startedAt = performance.now();
  let firstTokenAt = 0;
  let fullContent = '';
  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`Chat request failed: ${res.status}`);
    const reader = res.body?.getReader();
    if (!reader) throw new Error('No reader');
    const decoder = new TextDecoder();
    let pending = '';

    const consumeLine = (line: string) => {
      if (!line.startsWith('data: ')) return;
      const data = line.slice(6);
      if (data === '[DONE]') return;
      const parsed = JSON.parse(data);
      if (parsed.error) throw new Error(String(parsed.error));
      if (!parsed.content) return;
      if (!firstTokenAt) firstTokenAt = performance.now();
      fullContent += parsed.content;
      onContent(fullContent);
    };

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      pending += decoder.decode(value, { stream: true });
      const lines = pending.split('\n');
      pending = lines.pop() || '';
      for (const line of lines) consumeLine(line);
    }
    if (pending.trim()) consumeLine(pending);
    if (!fullContent.trim()) throw new Error('Empty chat response');
    console.info('[chat-timing]', {
      attempt,
      firstTokenMs: firstTokenAt ? Math.round(firstTokenAt - startedAt) : null,
      totalMs: Math.round(performance.now() - startedAt),
    });
    return fullContent;
  } catch (error) {
    console.warn('[chat-request]', {
      attempt,
      elapsedMs: Math.round(performance.now() - startedAt),
      error: error instanceof Error ? error.message : String(error),
    });
    if (attempt < 2 && !fullContent.trim()) {
      return streamChat(body, onContent, attempt + 1);
    }
    throw error;
  } finally {
    window.clearTimeout(timeoutId);
  }
}
