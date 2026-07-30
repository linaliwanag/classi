import type { GenerateError } from '../lib/api';
import { describeWait } from '../lib/rateLimit';

type ErrorNoticeProps = {
  error: GenerateError;
};

/**
 * Failures worth distinguishing, because the reader's next move differs:
 * wait a minute, come back tomorrow, or try again now.
 *
 * The daily-quota case matters most — it is not the reader's fault, and saying
 * so stops it reading as "you broke it".
 */
export default function ErrorNotice({ error }: ErrorNoticeProps) {
  const heading =
    error.kind === 'daily_quota'
      ? 'Out of free builds for today'
      : error.kind === 'rate_limited'
        ? 'That was a bit quick'
        : 'That didn’t work';

  const guidance =
    error.kind === 'daily_quota'
      ? 'Classi runs on a free model with an allowance shared by everyone using it, and today’s is spent. Nothing you did — it refills tomorrow.'
      : error.kind === 'rate_limited'
        ? `Requests are arriving faster than the free tier allows. Try again ${describeWait(error.retryAfterSeconds)}.`
        : null;

  // The upstream text is kept visible rather than swallowed, but demoted, so a
  // real diagnostic is never lost behind friendlier copy.
  const showDetail = error.detail !== null && error.detail !== error.message;

  return (
    <div className="rounded border border-brown-500 bg-parchment p-4">
      <h2 className="font-serif font-bold text-brown-700">{heading}</h2>
      <p className="mt-1">{guidance ?? error.message}</p>
      {guidance !== null && (
        <p className="mt-1 text-sm text-brown-600">{error.message}</p>
      )}
      {showDetail && (
        <p className="mt-2 text-sm text-brown-600">
          <span className="font-semibold">Details: </span>
          {error.detail}
        </p>
      )}
    </div>
  );
}
