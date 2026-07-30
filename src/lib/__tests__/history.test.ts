import { describe, expect, it } from 'vitest';
import {
  HISTORY_KEY,
  MAX_HISTORY,
  type StorageLike,
  addEntry,
  createEntry,
  loadHistory,
  relativeTime,
  removeEntry,
  saveHistory,
} from '../history';
import { sampleBuild } from './fixtures';

function fakeStorage(initial?: string) {
  const map = new Map<string, string>();
  if (initial !== undefined) map.set(HISTORY_KEY, initial);
  const storage: StorageLike = {
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => void map.set(key, value),
    removeItem: (key) => void map.delete(key),
  };
  return { storage, map };
}

/** Stands in for Safari private browsing and an exhausted quota. */
const hostileStorage: StorageLike = {
  getItem: () => {
    throw new Error('denied');
  },
  setItem: () => {
    throw new Error('quota exceeded');
  },
  removeItem: () => {
    throw new Error('denied');
  },
};

describe('history persistence', () => {
  it('round-trips entries', () => {
    const { storage } = fakeStorage();
    const entry = createEntry('a drow rogue', sampleBuild, 1_000, 'id-1');

    expect(saveHistory([entry], storage)).toBe(true);
    expect(loadHistory(storage)).toEqual([entry]);
  });

  it('returns an empty history when nothing is stored', () => {
    expect(loadHistory(fakeStorage().storage)).toEqual([]);
  });

  it('degrades quietly when storage throws', () => {
    expect(loadHistory(hostileStorage)).toEqual([]);
    expect(saveHistory([createEntry('x', sampleBuild)], hostileStorage)).toBe(false);
  });

  it('returns an empty history when storage is unavailable entirely', () => {
    expect(loadHistory(null)).toEqual([]);
    expect(saveHistory([], null)).toBe(false);
  });

  it('ignores corrupt JSON and non-array payloads', () => {
    expect(loadHistory(fakeStorage('{{{').storage)).toEqual([]);
    expect(loadHistory(fakeStorage('{"nope":1}').storage)).toEqual([]);
  });

  it('drops entries whose build no longer matches the schema', () => {
    const good = createEntry('good', sampleBuild, 2_000, 'good');
    const stored = JSON.stringify([
      good,
      { id: 'stale', concept: 'x', createdAt: 1_000, build: { title: 'only a title' } },
      { id: 'no-date', concept: 'x', build: sampleBuild },
    ]);
    expect(loadHistory(fakeStorage(stored).storage)).toEqual([good]);
  });

  it('returns newest first regardless of stored order', () => {
    const older = createEntry('older', sampleBuild, 1_000, 'a');
    const newer = createEntry('newer', sampleBuild, 5_000, 'b');
    const loaded = loadHistory(fakeStorage(JSON.stringify([older, newer])).storage);
    expect(loaded.map((entry) => entry.id)).toEqual(['b', 'a']);
  });

  it('caps what it writes and what it reads', () => {
    const many = Array.from({ length: MAX_HISTORY + 5 }, (_, index) =>
      createEntry(`concept ${index}`, sampleBuild, index, `id-${index}`),
    );
    const { storage } = fakeStorage();
    saveHistory(many, storage);
    expect(loadHistory(storage)).toHaveLength(MAX_HISTORY);
  });
});

describe('addEntry and removeEntry', () => {
  const first = createEntry('first', sampleBuild, 1, 'a');
  const second = createEntry('second', sampleBuild, 2, 'b');

  it('prepends newest first without mutating the input', () => {
    const entries = [first];
    expect(addEntry(entries, second).map((entry) => entry.id)).toEqual(['b', 'a']);
    expect(entries).toEqual([first]);
  });

  it('caps the list at MAX_HISTORY', () => {
    const full = Array.from({ length: MAX_HISTORY }, (_, index) =>
      createEntry('x', sampleBuild, index, `id-${index}`),
    );
    const result = addEntry(full, second);
    expect(result).toHaveLength(MAX_HISTORY);
    expect(result[0].id).toBe('b');
  });

  it('removes by id and ignores unknown ids', () => {
    expect(removeEntry([first, second], 'a')).toEqual([second]);
    expect(removeEntry([first, second], 'nope')).toEqual([first, second]);
  });

  it('gives each entry a distinct id by default', () => {
    const a = createEntry('x', sampleBuild);
    const b = createEntry('x', sampleBuild);
    expect(a.id).not.toBe(b.id);
  });
});

describe('relativeTime', () => {
  const now = 1_000_000_000_000;
  const ago = (ms: number) => relativeTime(now - ms, now);

  it('describes recent times in the largest sensible unit', () => {
    expect(ago(5_000)).toBe('just now');
    expect(ago(5 * 60_000)).toBe('5m ago');
    expect(ago(3 * 3_600_000)).toBe('3h ago');
    expect(ago(4 * 86_400_000)).toBe('4d ago');
  });

  it('falls back to a date for anything over a month', () => {
    expect(ago(90 * 86_400_000)).toBe(new Date(now - 90 * 86_400_000).toLocaleDateString());
  });

  it('does not report negative times for clock skew', () => {
    expect(relativeTime(now + 60_000, now)).toBe('just now');
  });
});
