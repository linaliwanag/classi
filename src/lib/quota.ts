/**
 * A per-browser courtesy limit on generations.
 *
 * Classi's free OpenRouter tier allows 50 requests a day for the whole app, so
 * one enthusiastic visitor can drain the pool before anyone else gets a build.
 * This spreads it out.
 *
 * It is explicitly a *courtesy* limit, not a security control: it lives in
 * localStorage and anyone who opens devtools can reset it. It exists to stop
 * ordinary over-use and, more usefully, to tell people where they stand before
 * they hit a wall. Actual enforcement belongs at the edge — see the README.
 */

import { type StorageLike, defaultStorage, readJson, writeJson } from './storage';

/** Generous for one person; 50/day still covers at least five people. */
export const DAILY_BUILD_LIMIT = 10;

export const QUOTA_KEY = 'classi:quota:v1';

export type Quota = {
  /** Local calendar day the count belongs to, as YYYY-MM-DD. */
  day: string;
  used: number;
};

/**
 * Local rather than UTC calendar day, so "resets at midnight" means the
 * midnight the reader is actually going to experience.
 */
export function dayKey(now: number = Date.now()): string {
  const date = new Date(now);
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

/** Epoch milliseconds of the next local midnight. */
export function nextResetAt(now: number = Date.now()): number {
  const date = new Date(now);
  date.setHours(24, 0, 0, 0);
  return date.getTime();
}

function emptyQuota(now: number): Quota {
  return { day: dayKey(now), used: 0 };
}

/** Read today's quota, rolling over automatically when the day has changed. */
export function loadQuota(
  storage: StorageLike | null = defaultStorage(),
  now: number = Date.now(),
): Quota {
  const parsed = readJson(QUOTA_KEY, storage);
  if (typeof parsed !== 'object' || parsed === null) return emptyQuota(now);

  const record = parsed as Record<string, unknown>;
  if (typeof record.day !== 'string' || typeof record.used !== 'number') {
    return emptyQuota(now);
  }
  if (!Number.isFinite(record.used) || record.used < 0) return emptyQuota(now);

  // A stored count from a previous day is simply spent.
  if (record.day !== dayKey(now)) return emptyQuota(now);

  return { day: record.day, used: Math.floor(record.used) };
}

export function saveQuota(
  quota: Quota,
  storage: StorageLike | null = defaultStorage(),
): boolean {
  return writeJson(QUOTA_KEY, quota, storage);
}

/**
 * Count one generation. Called only on success — someone whose build failed
 * should not lose an allowance for it.
 */
export function recordBuild(quota: Quota, now: number = Date.now()): Quota {
  const today = dayKey(now);
  if (quota.day !== today) return { day: today, used: 1 };
  return { day: today, used: quota.used + 1 };
}

export function remainingBuilds(quota: Quota): number {
  return Math.max(0, DAILY_BUILD_LIMIT - quota.used);
}

export function isExhausted(quota: Quota): boolean {
  return remainingBuilds(quota) === 0;
}
