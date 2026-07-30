/**
 * The protocol between `api/generate` and the browser.
 *
 * Newline-delimited JSON rather than raw text, because once a streaming response
 * has begun the HTTP status is already committed — an error that happens
 * mid-stream needs a way to reach the client, and a bare text stream has none.
 *
 * Isomorphic — shared by the serverless function and the client.
 */

export type StreamEvent =
  /** A chunk of the model's JSON output, to be appended to the buffer. */
  | { type: 'delta'; text: string }
  /** Generation failed. Terminal, and safe to show the user. */
  | { type: 'error'; message: string }
  /** Generation finished normally. Terminal. */
  | { type: 'done' };

export const STREAM_CONTENT_TYPE = 'application/x-ndjson';

export function encodeEvent(event: StreamEvent): string {
  return `${JSON.stringify(event)}\n`;
}

/**
 * Split a decoded chunk into whole events, returning any trailing partial line
 * for the caller to prepend to the next chunk.
 */
export function decodeEvents(buffer: string): { events: StreamEvent[]; rest: string } {
  const lines = buffer.split('\n');
  const rest = lines.pop() ?? '';
  const events: StreamEvent[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.length === 0) continue;
    try {
      events.push(JSON.parse(trimmed) as StreamEvent);
    } catch {
      // A line we cannot parse is not worth aborting the whole stream over.
    }
  }

  return { events, rest };
}
