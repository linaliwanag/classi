import type React from 'react';
import { EXAMPLE_CONCEPTS, MAX_CONCEPT_LENGTH } from '../lib/prompt';
import { DAILY_BUILD_LIMIT } from '../lib/quota';
import { describeResetTime } from '../lib/rateLimit';

type ConceptFormProps = {
  concept: string;
  onConceptChange: (concept: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
  streaming: boolean;
  /** Builds left in this browser's daily courtesy allowance. */
  buildsLeft: number;
  /** Epoch milliseconds when that allowance refills. */
  resetAt: number;
};

const TEXTAREA_ID = 'concept';

export default function ConceptForm({
  concept,
  onConceptChange,
  onSubmit,
  onCancel,
  streaming,
  buildsLeft,
  resetAt,
}: ConceptFormProps) {
  const charactersLeft = MAX_CONCEPT_LENGTH - concept.length;
  const exhausted = buildsLeft <= 0;
  const canSubmit = concept.trim().length > 0 && !streaming && !exhausted;

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (canSubmit) onSubmit();
  };

  // Cmd/Ctrl+Enter submits, since Enter alone needs to make newlines here.
  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && (event.metaKey || event.ctrlKey) && canSubmit) {
      event.preventDefault();
      onSubmit();
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <label htmlFor={TEXTAREA_ID} className="block font-serif text-lg font-semibold">
          Describe your character
        </label>
        <textarea
          id={TEXTAREA_ID}
          className="w-full resize-y rounded border border-brown-500 bg-parchment p-4 font-serif text-black placeholder:text-brown-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brown-600"
          rows={4}
          value={concept}
          maxLength={MAX_CONCEPT_LENGTH}
          onChange={(event) => onConceptChange(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="A drow rogue who wants to multiclass into something magical…"
          aria-describedby="concept-hint"
        />
        <p id="concept-hint" className="text-sm text-brown-600">
          Be as specific or as vague as you like. {charactersLeft} characters left.
          <span className="hidden sm:inline"> Press ⌘/Ctrl + Enter to generate.</span>
        </p>
      </div>

      <fieldset className="space-y-2">
        <legend className="text-sm font-semibold text-brown-600">Or start from an example</legend>
        <div className="flex flex-wrap gap-2">
          {EXAMPLE_CONCEPTS.map((example) => (
            <button
              key={example}
              type="button"
              onClick={() => onConceptChange(example)}
              disabled={streaming}
              className="rounded-full border border-brown-400 bg-brown-100 px-3 py-1 text-left text-sm text-brown-700 transition-colors hover:border-brown-500 hover:bg-brown-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brown-600 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {example}
            </button>
          ))}
        </div>
      </fieldset>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={!canSubmit}
          className="rounded border border-brown-500 bg-brown-200 px-6 py-3 font-serif font-semibold text-brown-700 transition-colors hover:bg-brown-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brown-600 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {streaming ? 'Generating…' : 'Generate Build'}
        </button>
        {streaming && (
          <button
            type="button"
            onClick={onCancel}
            className="rounded border border-brown-500 bg-parchment px-6 py-3 font-serif font-semibold text-brown-700 transition-colors hover:bg-brown-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brown-600"
          >
            Stop
          </button>
        )}

        {/* Said before the limit is reached, not after, so it never comes as a
            surprise. Polite rather than assertive: it changes often and should
            not interrupt a screen reader mid-task. */}
        <p className="text-sm text-brown-600" role="status" aria-live="polite">
          {exhausted
            ? `That’s all ${DAILY_BUILD_LIMIT} builds for today. More at ${describeResetTime(resetAt)}.`
            : `${buildsLeft} of ${DAILY_BUILD_LIMIT} builds left today.`}
        </p>
      </div>

      {exhausted && (
        <p className="rounded border border-brown-400 bg-brown-100 p-3 text-sm text-brown-700">
          Classi runs on a free model with a small shared daily allowance, so each browser gets{' '}
          {DAILY_BUILD_LIMIT} builds a day. Your saved builds below stay available.
        </p>
      )}
    </form>
  );
}
