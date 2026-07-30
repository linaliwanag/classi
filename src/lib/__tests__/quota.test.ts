import { describe, expect, it } from 'vitest';
import {
  DAILY_BUILD_LIMIT,
  QUOTA_KEY,
  dayKey,
  isExhausted,
  loadQuota,
  nextResetAt,
  recordBuild,
  remainingBuilds,
  saveQuota,
} from '../quota';
import type { StorageLike } from '../storage';

function fakeStorage(initial?: string) {
  const map = new Map<string, string>();
  if (initial !== undefined) map.set(QUOTA_KEY, initial);
  const storage: StorageLike = {
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => void map.set(key, value),
    removeItem: (key) => void map.delete(key),
  };
  return { storage, map };
}

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

const NOW = 1_700_000_000_000;
const TWO_DAYS = 2 * 24 * 60 * 60 * 1000;

describe('dayKey', () => {
  it('formats the local calendar day', () => {
    const date = new Date(NOW);
    const expected = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
      date.getDate(),
    ).padStart(2, '0')}`;
    expect(dayKey(NOW)).toBe(expected);
  });

  it('changes across a two-day gap in any timezone', () => {
    expect(dayKey(NOW)).not.toBe(dayKey(NOW + TWO_DAYS));
  });
});

describe('nextResetAt', () => {
  it('is the upcoming local midnight', () => {
    const reset = nextResetAt(NOW);
    expect(reset).toBeGreaterThan(NOW);
    expect(reset - NOW).toBeLessThanOrEqual(24 * 60 * 60 * 1000);

    const date = new Date(reset);
    expect([date.getHours(), date.getMinutes(), date.getSeconds()]).toEqual([0, 0, 0]);
  });
});

describe('loadQuota', () => {
  it('starts empty when nothing is stored', () => {
    expect(loadQuota(fakeStorage().storage, NOW)).toEqual({ day: dayKey(NOW), used: 0 });
  });

  it('round-trips a same-day count', () => {
    const { storage } = fakeStorage();
    saveQuota({ day: dayKey(NOW), used: 3 }, storage);
    expect(loadQuota(storage, NOW).used).toBe(3);
  });

  it('rolls over when the stored day has passed', () => {
    const { storage } = fakeStorage();
    saveQuota({ day: dayKey(NOW), used: DAILY_BUILD_LIMIT }, storage);
    expect(loadQuota(storage, NOW + TWO_DAYS).used).toBe(0);
  });

  it('ignores corrupt or malformed records', () => {
    expect(loadQuota(fakeStorage('{{{').storage, NOW).used).toBe(0);
    expect(loadQuota(fakeStorage('[]').storage, NOW).used).toBe(0);
    expect(loadQuota(fakeStorage('{"day":"2024-01-01"}').storage, NOW).used).toBe(0);
    expect(loadQuota(fakeStorage('{"used":3}').storage, NOW).used).toBe(0);
  });

  it('rejects a negative count rather than granting extra builds', () => {
    const stored = JSON.stringify({ day: dayKey(NOW), used: -99 });
    expect(loadQuota(fakeStorage(stored).storage, NOW).used).toBe(0);
  });

  it('degrades quietly when storage is unavailable or throws', () => {
    expect(loadQuota(null, NOW).used).toBe(0);
    expect(loadQuota(hostileStorage, NOW).used).toBe(0);
    expect(saveQuota({ day: dayKey(NOW), used: 1 }, hostileStorage)).toBe(false);
    expect(saveQuota({ day: dayKey(NOW), used: 1 }, null)).toBe(false);
  });
});

describe('recordBuild', () => {
  it('increments within the same day', () => {
    const quota = recordBuild({ day: dayKey(NOW), used: 2 }, NOW);
    expect(quota.used).toBe(3);
  });

  it('restarts the count on a new day', () => {
    const quota = recordBuild({ day: dayKey(NOW), used: DAILY_BUILD_LIMIT }, NOW + TWO_DAYS);
    expect(quota).toEqual({ day: dayKey(NOW + TWO_DAYS), used: 1 });
  });

  it('does not mutate the input', () => {
    const before = { day: dayKey(NOW), used: 1 };
    recordBuild(before, NOW);
    expect(before.used).toBe(1);
  });
});

describe('remainingBuilds and isExhausted', () => {
  it('counts down to the limit', () => {
    expect(remainingBuilds({ day: dayKey(NOW), used: 0 })).toBe(DAILY_BUILD_LIMIT);
    expect(remainingBuilds({ day: dayKey(NOW), used: 4 })).toBe(DAILY_BUILD_LIMIT - 4);
  });

  it('never goes negative, even past the limit', () => {
    expect(remainingBuilds({ day: dayKey(NOW), used: DAILY_BUILD_LIMIT + 5 })).toBe(0);
  });

  it('reports exhaustion only at zero', () => {
    expect(isExhausted({ day: dayKey(NOW), used: DAILY_BUILD_LIMIT - 1 })).toBe(false);
    expect(isExhausted({ day: dayKey(NOW), used: DAILY_BUILD_LIMIT })).toBe(true);
  });
});
