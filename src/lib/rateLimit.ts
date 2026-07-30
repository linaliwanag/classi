/**
 * Reading rate-limit signals out of an upstream 429, and describing them in
 * language a person can act on.
 *
 * "Rate limit exceeded" tells someone nothing. Whether they should wait ninety
 * seconds or come back tomorrow — and whether it is their doing at all — are
 * completely different messages.
 *
 * Isomorphic: the header parsing runs in the serverless function, the phrasing
 * helpers run in the browser.
 */

/** Which limit was hit. Drives entirely different copy in the UI. */
export type LimitKind =
  /** This visitor is going too fast. Their doing, clears shortly. */
  | 'rate_limited'
  /** The whole app has spent its daily free allowance. Not their doing. */
  | 'daily_quota';

/**
 * Phrases OpenRouter uses when the free-tier *daily* allowance is gone, as
 * opposed to a short-term burst limit.
 *
 * Matched loosely on purpose. A misclassification only changes the wording, and
 * the upstream text is always surfaced alongside, so nothing is hidden.
 */
const DAILY_MARKERS = [
  'per day',
  'per-day',
  'daily limit',
  'daily rate limit',
  'free-models-per-day',
  'requests per day',
  'added credits',
];

export function isDailyQuotaMessage(message: string | null): boolean {
  if (message === null) return false;
  const text = message.toLowerCase();
  return DAILY_MARKERS.some((marker) => text.includes(marker));
}

/**
 * Seconds until the caller may retry, from whichever header the upstream sent.
 * Returns null when nothing usable was provided.
 */
export function parseRetryAfterSeconds(headers: Headers, now: number = Date.now()): number | null {
  const retryAfter = headers.get('retry-after');
  if (retryAfter !== null && retryAfter.trim().length > 0) {
    // Either a delta in seconds, or an HTTP date.
    const seconds = Number(retryAfter);
    if (Number.isFinite(seconds) && seconds >= 0) return Math.ceil(seconds);

    const timestamp = Date.parse(retryAfter);
    if (!Number.isNaN(timestamp)) return Math.max(0, Math.ceil((timestamp - now) / 1000));
  }

  const reset = headers.get('x-ratelimit-reset');
  if (reset !== null && reset.trim().length > 0) {
    const value = Number(reset);
    if (Number.isFinite(value) && value >= 0) {
      // The header is variously epoch milliseconds, epoch seconds, or a delta.
      // Magnitude is the only thing that distinguishes them.
      if (value > 1e11) return Math.max(0, Math.ceil((value - now) / 1000));
      if (value > 1e9) return Math.max(0, Math.ceil((value * 1000 - now) / 1000));
      return Math.ceil(value);
    }
  }

  return null;
}

/**
 * "in 45 seconds" / "in 12 minutes" / "at 3:04 PM" — chosen so the phrase stays
 * useful whether the wait is short enough to sit through or long enough to
 * leave and come back.
 */
export function describeWait(seconds: number | null, now: number = Date.now()): string {
  if (seconds === null || seconds <= 0) return 'in a moment';
  if (seconds < 90) return `in ${Math.max(1, Math.round(seconds))} seconds`;

  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `in ${minutes} minutes`;

  const at = new Date(now + seconds * 1000);
  return `at ${at.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`;
}

/** "midnight" as a clock time the reader can check against their own. */
export function describeResetTime(resetAt: number): string {
  return new Date(resetAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}
