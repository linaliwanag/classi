import { describe, expect, it } from 'vitest';
import { contentDelta, decodeSse, errorMessage } from '../sse';
import { decodeEvents, encodeEvent } from '../wire';

describe('decodeSse', () => {
  it('extracts data payloads and the done sentinel', () => {
    const { lines, rest } = decodeSse('data: {"a":1}\n\ndata: [DONE]\n\n');
    expect(lines).toEqual([{ type: 'data', payload: '{"a":1}' }, { type: 'done' }]);
    expect(rest).toBe('');
  });

  it('skips OpenRouter keep-alive comments', () => {
    const { lines } = decodeSse(': OPENROUTER PROCESSING\n\ndata: {"a":1}\n');
    expect(lines).toEqual([{ type: 'data', payload: '{"a":1}' }]);
  });

  it('hands back a trailing partial line for the next chunk', () => {
    const first = decodeSse('data: {"a":1}\ndata: {"b":');
    expect(first.lines).toEqual([{ type: 'data', payload: '{"a":1}' }]);
    expect(first.rest).toBe('data: {"b":');

    const second = decodeSse(`${first.rest}2}\n`);
    expect(second.lines).toEqual([{ type: 'data', payload: '{"b":2}' }]);
  });

  it('survives a payload split across three chunks', () => {
    const chunks = ['data: {"cho', 'ices":[{"delta":{"content":"Half-', 'Orc"}}]}\n'];
    let rest = '';
    const payloads: string[] = [];
    for (const chunk of chunks) {
      const decoded = decodeSse(rest + chunk);
      rest = decoded.rest;
      for (const line of decoded.lines) {
        if (line.type === 'data') payloads.push(line.payload);
      }
    }
    expect(payloads).toHaveLength(1);
    expect(contentDelta(payloads[0])).toBe('Half-Orc');
  });
});

describe('contentDelta', () => {
  it('reads the incremental content', () => {
    expect(contentDelta('{"choices":[{"delta":{"content":"abc"}}]}')).toBe('abc');
  });

  it('returns an empty string for chunks that carry no content', () => {
    expect(contentDelta('{"choices":[{"delta":{"role":"assistant"}}]}')).toBe('');
    expect(contentDelta('{"choices":[]}')).toBe('');
    expect(contentDelta('{"usage":{"total_tokens":5}}')).toBe('');
  });

  it('returns null for unparseable payloads, so callers can look for an error', () => {
    expect(contentDelta('not json')).toBeNull();
  });
});

describe('errorMessage', () => {
  it('reads both shapes OpenRouter uses', () => {
    expect(errorMessage('{"error":{"message":"No endpoints found"}}')).toBe('No endpoints found');
    expect(errorMessage('{"error":"rate limited"}')).toBe('rate limited');
  });

  it('returns null when there is no error to report', () => {
    expect(errorMessage('{"choices":[]}')).toBeNull();
    expect(errorMessage('garbage')).toBeNull();
  });
});

describe('wire protocol', () => {
  it('round-trips events', () => {
    const encoded = [
      encodeEvent({ type: 'delta', text: 'a\nb' }),
      encodeEvent({ type: 'done' }),
    ].join('');
    const { events, rest } = decodeEvents(encoded);
    expect(events).toEqual([{ type: 'delta', text: 'a\nb' }, { type: 'done' }]);
    expect(rest).toBe('');
  });

  it('holds back a partial event until the newline arrives', () => {
    const full = encodeEvent({ type: 'delta', text: 'hello' });
    const split = full.length - 3;

    const first = decodeEvents(full.slice(0, split));
    expect(first.events).toEqual([]);

    const second = decodeEvents(first.rest + full.slice(split));
    expect(second.events).toEqual([{ type: 'delta', text: 'hello' }]);
  });

  it('drops an unparseable line rather than aborting the stream', () => {
    const { events } = decodeEvents(`{oops\n${encodeEvent({ type: 'done' })}`);
    expect(events).toEqual([{ type: 'done' }]);
  });
});
