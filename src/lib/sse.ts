/**
 * Minimal reader for the server-sent-event stream OpenRouter returns.
 *
 * Only what this app needs: `data:` payloads, the `[DONE]` sentinel, and the
 * comment lines OpenRouter sends as keep-alives while a model warms up.
 *
 * Isomorphic — no DOM or Node APIs.
 */

export type SseLine =
  | { type: 'data'; payload: string }
  | { type: 'done' };

/**
 * Split a decoded chunk of an SSE stream into events, returning any trailing
 * partial line for the caller to prepend to the next chunk.
 */
export function decodeSse(buffer: string): { lines: SseLine[]; rest: string } {
  const rawLines = buffer.split('\n');
  const rest = rawLines.pop() ?? '';
  const lines: SseLine[] = [];

  for (const rawLine of rawLines) {
    const line = rawLine.trim();
    if (line.length === 0) continue;
    // ": OPENROUTER PROCESSING" and friends are keep-alive comments.
    if (line.startsWith(':')) continue;
    if (!line.startsWith('data:')) continue;

    const payload = line.slice('data:'.length).trim();
    if (payload === '[DONE]') {
      lines.push({ type: 'done' });
      continue;
    }
    lines.push({ type: 'data', payload });
  }

  return { lines, rest };
}

/**
 * Pull the incremental text out of one OpenAI-shaped streaming chunk.
 * Returns an empty string for chunks that carry no content (role-only openers,
 * usage-only trailers), and null if the payload is not usable JSON.
 */
export function contentDelta(payload: string): string | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(payload);
  } catch {
    return null;
  }

  if (typeof parsed !== 'object' || parsed === null) return null;
  const choices = (parsed as { choices?: unknown }).choices;
  if (!Array.isArray(choices) || choices.length === 0) return '';

  const first = choices[0];
  if (typeof first !== 'object' || first === null) return '';

  const delta = (first as { delta?: unknown }).delta;
  if (typeof delta !== 'object' || delta === null) return '';

  const content = (delta as { content?: unknown }).content;
  return typeof content === 'string' ? content : '';
}

/** Extract a human-readable message from an OpenRouter error response body. */
export function errorMessage(body: string): string | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    return null;
  }
  if (typeof parsed !== 'object' || parsed === null) return null;

  const error = (parsed as { error?: unknown }).error;
  if (typeof error === 'string') return error;
  if (typeof error === 'object' && error !== null) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string') return message;
  }
  return null;
}
