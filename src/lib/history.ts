/**
 * Local build history.
 *
 * Deliberately localStorage and nothing more: remembering builds in this browser
 * needs no backend, no accounts, and no schema migration story. Cross-device
 * history is a separate feature that needs a database and auth, and this does not
 * paint us into a corner on either.
 *
 * Every read revalidates through `parseBuild`, so a stored entry written by an
 * older version of the schema is dropped rather than crashing a render.
 */

import { type Build, parseBuild } from './build';

export const HISTORY_KEY = 'classi:history:v1';

/** Older entries are dropped past this, to stay well clear of quota limits. */
export const MAX_HISTORY = 20;

export type HistoryEntry = {
  id: string;
  concept: string;
  /** Epoch milliseconds. */
  createdAt: number;
  build: Build;
};

/** The slice of the Storage interface this module needs. */
export type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

/**
 * localStorage access can throw outright — Safari private browsing, disabled
 * cookies, exhausted quota — so every touch is guarded and history degrades to
 * "not saved" instead of taking the page down.
 */
function defaultStorage(): StorageLike | null {
  try {
    if (typeof localStorage === 'undefined') return null;
    return localStorage;
  } catch {
    return null;
  }
}

function parseEntry(value: unknown): HistoryEntry | null {
  if (typeof value !== 'object' || value === null) return null;
  const record = value as Record<string, unknown>;

  const { id, concept, createdAt } = record;
  if (typeof id !== 'string' || id.length === 0) return null;
  if (typeof concept !== 'string') return null;
  if (typeof createdAt !== 'number' || !Number.isFinite(createdAt)) return null;

  try {
    return { id, concept, createdAt, build: parseBuild(record.build) };
  } catch {
    return null; // written by an incompatible schema version
  }
}

export function loadHistory(storage: StorageLike | null = defaultStorage()): HistoryEntry[] {
  if (storage === null) return [];

  let raw: string | null;
  try {
    raw = storage.getItem(HISTORY_KEY);
  } catch {
    return [];
  }
  if (raw === null) return [];

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];

  const entries: HistoryEntry[] = [];
  for (const value of parsed) {
    const entry = parseEntry(value);
    if (entry !== null) entries.push(entry);
  }
  return entries.sort((a, b) => b.createdAt - a.createdAt).slice(0, MAX_HISTORY);
}

/** Persist history. Returns false if storage was unavailable or full. */
export function saveHistory(
  entries: HistoryEntry[],
  storage: StorageLike | null = defaultStorage(),
): boolean {
  if (storage === null) return false;
  try {
    storage.setItem(HISTORY_KEY, JSON.stringify(entries.slice(0, MAX_HISTORY)));
    return true;
  } catch {
    return false;
  }
}

function newId(): string {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
  } catch {
    // fall through
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Mint a history entry. Separate from {@link addEntry} so the caller holds the
 * id — the UI needs it to highlight the row it just created.
 */
export function createEntry(
  concept: string,
  build: Build,
  now: number = Date.now(),
  id: string = newId(),
): HistoryEntry {
  return { id, concept, createdAt: now, build };
}

/** Prepend an entry, newest first, capped at {@link MAX_HISTORY}. Pure. */
export function addEntry(entries: HistoryEntry[], entry: HistoryEntry): HistoryEntry[] {
  return [entry, ...entries].slice(0, MAX_HISTORY);
}

export function removeEntry(entries: HistoryEntry[], id: string): HistoryEntry[] {
  return entries.filter((entry) => entry.id !== id);
}

/** Short relative time for history rows, e.g. "3h ago". */
export function relativeTime(createdAt: number, now: number = Date.now()): string {
  const seconds = Math.max(0, Math.round((now - createdAt) / 1000));
  if (seconds < 60) return 'just now';

  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;

  return new Date(createdAt).toLocaleDateString();
}
