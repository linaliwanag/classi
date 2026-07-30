import { useEffect, useState } from 'react';
import type { Build } from '../lib/build';
import { buildFilename, buildToMarkdown } from '../lib/markdown';

type BuildActionsProps = {
  build: Build;
  concept: string;
  onRegenerate: () => void;
  busy: boolean;
};

type CopyState = 'idle' | 'copied' | 'failed';

const BUTTON_CLASS =
  'rounded border border-brown-500 bg-parchment px-3 py-2 text-sm font-semibold text-brown-700 transition-colors hover:bg-brown-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brown-600 focus-visible:ring-offset-1 focus-visible:ring-offset-parchment disabled:cursor-not-allowed disabled:opacity-50';

export default function BuildActions({ build, concept, onRegenerate, busy }: BuildActionsProps) {
  const [copyState, setCopyState] = useState<CopyState>('idle');

  // Let the confirmation fade rather than sticking around permanently.
  useEffect(() => {
    if (copyState === 'idle') return;
    const timer = setTimeout(() => setCopyState('idle'), 2500);
    return () => clearTimeout(timer);
  }, [copyState]);

  const markdown = () => buildToMarkdown(build, concept);

  const handleCopy = async () => {
    try {
      // Absent over plain HTTP on a non-localhost host, and blocked in some
      // embedded browsers, so failure needs to be visible rather than silent.
      if (!navigator.clipboard) throw new Error('Clipboard unavailable');
      await navigator.clipboard.writeText(markdown());
      setCopyState('copied');
    } catch {
      setCopyState('failed');
    }
  };

  const handleDownload = () => {
    const blob = new Blob([markdown()], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = buildFilename(build);
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button type="button" className={BUTTON_CLASS} onClick={() => void handleCopy()}>
        Copy as Markdown
      </button>
      <button type="button" className={BUTTON_CLASS} onClick={handleDownload}>
        Download .md
      </button>
      <button type="button" className={BUTTON_CLASS} onClick={onRegenerate} disabled={busy}>
        Regenerate
      </button>
      <p role="status" aria-live="polite" className="text-sm text-brown-600">
        {copyState === 'copied' && 'Copied to clipboard.'}
        {copyState === 'failed' && 'Could not copy — use Download instead.'}
      </p>
    </div>
  );
}
