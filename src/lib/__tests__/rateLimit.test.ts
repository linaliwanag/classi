import { describe, expect, it } from 'vitest';
import {
  describeResetTime,
  describeWait,
  isDailyQuotaMessage,
  parseRetryAfterSeconds,
} from '../rateLimit';

describe('isDailyQuotaMessage', () => {
  it('recognises the daily allowance being spent', () => {
    for (const message of [
      'Rate limit exceeded: free-models-per-day',
      'You have hit your daily limit for free models',
      'Limited to 50 requests per day',
      'Add credits to raise your requests per day',
    ]) {
      expect(isDailyQuotaMessage(message), message).toBe(true);
    }
  });

  it('does not mistake a short-term burst limit for the daily one', () => {
    for (const message of [
      'Rate limit exceeded: 20 requests per minute',
      'Too many requests, slow down',
      null,
      '',
    ]) {
      expect(isDailyQuotaMessage(message), String(message)).toBe(false);
    }
  });
});

describe('parseRetryAfterSeconds', () => {
  const now = 1_700_000_000_000;
  const headers = (init: Record<string, string>) => new Headers(init);

  it('reads Retry-After as a plain number of seconds', () => {
    expect(parseRetryAfterSeconds(headers({ 'retry-after': '45' }), now)).toBe(45);
  });

  it('reads Retry-After as an HTTP date', () => {
    const when = new Date(now + 120_000).toUTCString();
    expect(parseRetryAfterSeconds(headers({ 'retry-after': when }), now)).toBe(120);
  });

  it('reads x-ratelimit-reset as epoch milliseconds', () => {
    const reset = String(now + 90_000);
    expect(parseRetryAfterSeconds(headers({ 'x-ratelimit-reset': reset }), now)).toBe(90);
  });

  it('reads x-ratelimit-reset as epoch seconds', () => {
    const reset = String(Math.floor((now + 60_000) / 1000));
    expect(parseRetryAfterSeconds(headers({ 'x-ratelimit-reset': reset }), now)).toBe(60);
  });

  it('reads a small x-ratelimit-reset as a delta', () => {
    expect(parseRetryAfterSeconds(headers({ 'x-ratelimit-reset': '30' }), now)).toBe(30);
  });

  it('never reports a negative wait for a reset already in the past', () => {
    const past = String(now - 60_000);
    expect(parseRetryAfterSeconds(headers({ 'x-ratelimit-reset': past }), now)).toBe(0);
  });

  it('returns null when nothing usable was sent', () => {
    expect(parseRetryAfterSeconds(headers({}), now)).toBeNull();
    expect(parseRetryAfterSeconds(headers({ 'retry-after': '' }), now)).toBeNull();
    expect(parseRetryAfterSeconds(headers({ 'retry-after': 'soon' }), now)).toBeNull();
  });

  it('prefers Retry-After when both headers are present', () => {
    const both = headers({ 'retry-after': '10', 'x-ratelimit-reset': String(now + 900_000) });
    expect(parseRetryAfterSeconds(both, now)).toBe(10);
  });
});

describe('describeWait', () => {
  const now = 1_700_000_000_000;

  it('counts in seconds for a short wait', () => {
    expect(describeWait(45, now)).toBe('in 45 seconds');
  });

  it('counts in minutes once seconds stop being useful', () => {
    expect(describeWait(600, now)).toBe('in 10 minutes');
  });

  it('gives a clock time for a wait over an hour', () => {
    expect(describeWait(7200, now)).toMatch(/^at /);
  });

  it('stays sensible with no information or a stale value', () => {
    expect(describeWait(null, now)).toBe('in a moment');
    expect(describeWait(0, now)).toBe('in a moment');
    expect(describeWait(-30, now)).toBe('in a moment');
  });
});

describe('describeResetTime', () => {
  it('renders a clock time', () => {
    expect(describeResetTime(1_700_000_000_000)).toMatch(/\d/);
  });
});
