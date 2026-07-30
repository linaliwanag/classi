/**
 * Browser-side client for `/api/generate`.
 *
 * No API key here, and none in the bundle — the key lives on the server. See
 * `api/generate.ts`.
 */

import {
  ABILITY_KEYS,
  type AbilityScores,
  type Build,
  type BuildLevel,
  parseBuild,
  parseBuildLevel,
} from './build';
import type { LimitKind } from './rateLimit';
import { scanPartialJson, sliceJsonObject, tryParseJson } from './streamJson';
import { decodeEvents } from './wire';

/** A build as it looks mid-stream: identity first, then levels, then prose. */
export type BuildDraft = {
  title?: string;
  race?: string;
  background?: string;
  abilityScores?: AbilityScores;
  summary?: string;
  roleplayNotes?: string;
  levels: BuildLevel[];
};

export type GenerateErrorKind = LimitKind | 'generic';

/** An error with a message that is safe and useful to show the user. */
export class GenerateError extends Error {
  /** Lets the UI phrase a limit differently from an outright failure. */
  readonly kind: GenerateErrorKind;
  /** Seconds until a retry is worth attempting, when the server said. */
  readonly retryAfterSeconds: number | null;
  /** The raw upstream text, shown as secondary detail so nothing is hidden. */
  readonly detail: string | null;

  constructor(
    message: string,
    options: {
      kind?: GenerateErrorKind;
      retryAfterSeconds?: number | null;
      detail?: string | null;
    } = {},
  ) {
    super(message);
    this.name = 'GenerateError';
    this.kind = options.kind ?? 'generic';
    this.retryAfterSeconds = options.retryAfterSeconds ?? null;
    this.detail = options.detail ?? null;
  }
}

function asAbilityScores(value: unknown): AbilityScores | undefined {
  if (typeof value !== 'object' || value === null) return undefined;
  const record = value as Record<string, unknown>;
  const scores: Partial<AbilityScores> = {};
  for (const key of ABILITY_KEYS) {
    const score = record[key];
    if (typeof score !== 'number' || !Number.isFinite(score)) return undefined;
    scores[key] = Math.round(score);
  }
  return scores as AbilityScores;
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

/** Read whatever has fully arrived in the buffer into a renderable draft. */
function readDraft(buffer: string): BuildDraft {
  const { values, arrayItems } = scanPartialJson(buffer);
  const read = (key: string): unknown =>
    key in values ? tryParseJson(values[key]) : undefined;

  const levels: BuildLevel[] = [];
  for (const raw of arrayItems.levels ?? []) {
    const level = parseBuildLevel(tryParseJson(raw));
    if (level !== null) levels.push(level);
  }

  return {
    title: asString(read('title')),
    race: asString(read('race')),
    background: asString(read('background')),
    abilityScores: asAbilityScores(read('abilityScores')),
    summary: asString(read('summary')),
    roleplayNotes: asString(read('roleplayNotes')),
    levels,
  };
}

/**
 * Cheap fingerprint of how much of a draft is renderable, so progress is only
 * pushed to React when a whole new field or level has appeared.
 */
function draftSignature(draft: BuildDraft): string {
  return [
    draft.levels.length,
    draft.title === undefined ? 0 : 1,
    draft.race === undefined ? 0 : 1,
    draft.background === undefined ? 0 : 1,
    draft.abilityScores === undefined ? 0 : 1,
    draft.summary === undefined ? 0 : 1,
    draft.roleplayNotes === undefined ? 0 : 1,
  ].join('|');
}

/**
 * Turn the accumulated buffer into a validated build.
 *
 * A complete response parses directly. A truncated one (the model hit the token
 * ceiling, or the connection dropped late) is salvaged from whatever finished
 * arriving, so a build cut short at level 9 still renders instead of throwing
 * away nine good levels.
 */
export function finalizeBuild(buffer: string): Build {
  // Callers only need to handle GenerateError, so validation failures are
  // re-thrown with their message preserved.
  const validate = (value: unknown): Build => {
    try {
      return parseBuild(value);
    } catch (error) {
      throw new GenerateError(
        error instanceof Error
          ? error.message
          : 'The model returned a build that could not be read.',
      );
    }
  };

  const whole = tryParseJson(buffer);
  if (whole !== null) return validate(whole);

  // Not clean JSON. Before falling back to salvage, try the buffer with any
  // code fence or commentary trimmed off — that usually recovers it intact.
  const sliced = sliceJsonObject(buffer);
  if (sliced !== null) {
    const fenced = tryParseJson(sliced);
    if (fenced !== null) return validate(fenced);
  }

  const draft = readDraft(buffer);
  if (draft.levels.length === 0) {
    throw new GenerateError(
      'The model returned a response that could not be read as a build. Try generating again.',
    );
  }

  return validate({
    title: draft.title ?? 'Untitled build',
    race: draft.race ?? 'Unspecified',
    background: draft.background ?? 'Unspecified',
    abilityScores:
      draft.abilityScores ?? Object.fromEntries(ABILITY_KEYS.map((key) => [key, 10])),
    summary: draft.summary ?? '',
    roleplayNotes: draft.roleplayNotes ?? '',
    levels: draft.levels,
  });
}

async function readError(response: Response): Promise<GenerateError> {
  let message = `The server returned an error (HTTP ${response.status}).`;
  let kind: GenerateErrorKind = 'generic';
  let retryAfterSeconds: number | null = null;
  let detail: string | null = null;

  try {
    const body = (await response.json()) as unknown;
    if (typeof body === 'object' && body !== null) {
      const record = body as Record<string, unknown>;
      if (typeof record.error === 'string' && record.error.length > 0) message = record.error;
      if (record.kind === 'rate_limited' || record.kind === 'daily_quota') kind = record.kind;
      if (typeof record.retryAfterSeconds === 'number' && Number.isFinite(record.retryAfterSeconds)) {
        retryAfterSeconds = record.retryAfterSeconds;
      }
      if (typeof record.detail === 'string' && record.detail.length > 0) detail = record.detail;
    }
  } catch {
    // Keep the generic message.
  }

  return new GenerateError(message, { kind, retryAfterSeconds, detail });
}

export type GenerateOptions = {
  /** Called each time more of the build has definitively arrived. */
  onProgress?: (draft: BuildDraft) => void;
  signal?: AbortSignal;
};

/**
 * Generate a build, streaming progress as it arrives.
 * Throws {@link GenerateError} with a user-facing message on failure.
 */
export async function generateBuild(
  concept: string,
  { onProgress, signal }: GenerateOptions = {},
): Promise<Build> {
  let response: Response;
  try {
    response = await fetch('/api/generate', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ concept }),
      signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error;
    throw new GenerateError('Could not reach the server. Check your connection and try again.');
  }

  if (!response.ok) throw await readError(response);
  if (!response.body) throw new GenerateError('The server sent an empty response.');

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let events = '';
  let buffer = '';
  let signature = '';
  let sawDone = false;

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;

      const decoded = decodeEvents(events + decoder.decode(value, { stream: true }));
      events = decoded.rest;

      let grew = false;
      for (const event of decoded.events) {
        if (event.type === 'error') throw new GenerateError(event.message);
        if (event.type === 'done') {
          sawDone = true;
          continue;
        }
        buffer += event.text;
        grew = true;
      }

      // Rescanning is O(buffer), so only do it when a chunk actually landed and
      // only re-render when a whole new field or level has appeared.
      if (grew && onProgress) {
        const draft = readDraft(buffer);
        const next = draftSignature(draft);
        if (next !== signature) {
          signature = next;
          onProgress(draft);
        }
      }
    }
  } finally {
    reader.releaseLock();
  }

  if (!sawDone && buffer.length === 0) {
    throw new GenerateError('The server closed the connection before sending anything.');
  }

  return finalizeBuild(buffer);
}
