/**
 * Build generation endpoint.
 *
 * This exists so the OpenRouter key never reaches the browser. The key is read
 * from `OPENROUTER_API_KEY` — deliberately *without* a `VITE_` prefix, because
 * Vite inlines any `VITE_`-prefixed variable into the client bundle at build
 * time, which is exactly the leak this replaces.
 *
 * Runs on the Vercel Edge runtime, so it is plain `Request`/`Response` and Web
 * Streams. `vite.config.ts` mounts this same handler during local development,
 * so there is one code path in both places.
 */

import { BUILD_JSON_SCHEMA } from '../src/lib/build';
import { ConceptError, buildMessages, normalizeConcept } from '../src/lib/prompt';
import { contentDelta, decodeSse, errorMessage } from '../src/lib/sse';
import { STREAM_CONTENT_TYPE, encodeEvent } from '../src/lib/wire';

export const config = { runtime: 'edge' };

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

/**
 * Free, and one of the few `:free` models that both honours a JSON schema and
 * does no chain-of-thought. That second property matters more than it looks:
 * reasoning tokens count against `max_tokens`, and the free reasoning models
 * (gpt-oss-20b, the nemotrons) burn the entire budget thinking and return no
 * build at all. Measured at ~1.6s to first token and ~30s for all 12 levels.
 *
 * Override with OPENROUTER_MODEL for better rules accuracy — see the README.
 */
const DEFAULT_MODEL = 'google/gemma-4-26b-a4b-it:free';

/**
 * Ceiling on a single generation. Twelve levels of prose runs roughly 3-4k
 * tokens, so this leaves headroom while capping what one request can cost.
 */
const MAX_TOKENS = 6000;

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  });
}

export default async function handler(request: Request): Promise<Response> {
  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed.' }, 405);
  }

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    // A configuration problem, not a user problem — say so precisely, since
    // this is the error someone hits on a fresh checkout.
    return jsonResponse(
      { error: 'OPENROUTER_API_KEY is not set on the server. See the README for setup.' },
      500,
    );
  }

  let concept: string;
  try {
    const body = (await request.json()) as unknown;
    const raw = typeof body === 'object' && body !== null ? (body as { concept?: unknown }).concept : undefined;
    concept = normalizeConcept(raw);
  } catch (error) {
    if (error instanceof ConceptError) {
      return jsonResponse({ error: error.message }, 400);
    }
    return jsonResponse({ error: 'Could not read the request body.' }, 400);
  }

  const model = process.env.OPENROUTER_MODEL || DEFAULT_MODEL;
  // OpenRouter attributes traffic with these; derive from the live request
  // rather than hardcoding a localhost URL that is wrong in production.
  const origin = request.headers.get('origin') ?? new URL(request.url).origin;

  let upstream: Response;
  try {
    upstream = await fetch(OPENROUTER_URL, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${apiKey}`,
        'content-type': 'application/json',
        'HTTP-Referer': origin,
        'X-Title': 'Classi',
      },
      body: JSON.stringify({
        model,
        messages: buildMessages(concept),
        // No `temperature`: several current models (claude-sonnet-5 among them)
        // do not accept it, and with `require_parameters` below an unsupported
        // parameter means OpenRouter finds no provider at all. The default
        // sampling is fine for a schema-constrained response.
        max_tokens: MAX_TOKENS,
        stream: true,
        response_format: { type: 'json_schema', json_schema: BUILD_JSON_SCHEMA },
        // Only route to providers that actually honour the schema, rather than
        // silently falling back to a provider that ignores it.
        provider: { require_parameters: true },
      }),
      signal: request.signal,
    });
  } catch {
    return jsonResponse({ error: 'Could not reach OpenRouter. Check your connection.' }, 502);
  }

  if (!upstream.ok || !upstream.body) {
    const detail = errorMessage(await upstream.text().catch(() => ''));
    const status = upstream.status === 429 ? 429 : 502;
    return jsonResponse(
      {
        error:
          upstream.status === 429
            ? 'OpenRouter is rate limiting this key. Wait a moment and try again.'
            : `OpenRouter rejected the request${detail ? `: ${detail}` : ` (HTTP ${upstream.status})`}.`,
      },
      status,
    );
  }

  // Translate OpenRouter's SSE into our newline-delimited event stream, so the
  // client never sees the upstream wire format and mid-stream failures are
  // still reportable.
  const body = upstream.body;
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const encoder = new TextEncoder();
      const decoder = new TextDecoder();
      const reader = body.getReader();
      const send = (text: string) => controller.enqueue(encoder.encode(text));

      let rest = '';
      let sawContent = false;
      /** Set once a terminal event has been emitted, so we close exactly once. */
      let finished = false;

      const finish = (event: Parameters<typeof encodeEvent>[0]) => {
        if (finished) return;
        finished = true;
        send(encodeEvent(event));
      };

      try {
        reading: for (;;) {
          const { done, value } = await reader.read();
          if (done) break;

          const { lines, rest: nextRest } = decodeSse(
            rest + decoder.decode(value, { stream: true }),
          );
          rest = nextRest;

          for (const line of lines) {
            if (line.type === 'done') {
              finish({ type: 'done' });
              break reading;
            }
            const text = contentDelta(line.payload);
            if (text === null) {
              // Not a content chunk — could be an error object mid-stream.
              const detail = errorMessage(line.payload);
              if (detail !== null) {
                finish({ type: 'error', message: detail });
                break reading;
              }
              continue;
            }
            if (text.length > 0) {
              sawContent = true;
              send(encodeEvent({ type: 'delta', text }));
            }
          }
        }

        // Upstream ended without a [DONE] sentinel.
        finish(
          sawContent
            ? { type: 'done' }
            : { type: 'error', message: 'The model returned an empty response.' },
        );
      } catch {
        finish({ type: 'error', message: 'The connection to OpenRouter was interrupted.' });
      } finally {
        reader.releaseLock();
        controller.close();
      }
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      'content-type': STREAM_CONTENT_TYPE,
      'cache-control': 'no-store',
      // Defeats proxy buffering that would otherwise defeat the point of streaming.
      'x-accel-buffering': 'no',
    },
  });
}
