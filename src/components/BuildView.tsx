import type { BuildDraft } from '../lib/api';
import { ABILITY_KEYS, ABILITY_LABELS, type AbilityScores, type Build, MAX_LEVEL } from '../lib/build';
import BuildActions from './BuildActions';
import BuildTable from './BuildTable';

type BuildViewProps = {
  /** What has arrived so far. A finished build is also a complete draft. */
  draft: BuildDraft;
  concept: string;
  streaming: boolean;
  /** Non-null once generation finished, which is what enables the actions. */
  complete: Build | null;
  onRegenerate: () => void;
};

function AbilityScoreGrid({ scores }: { scores: AbilityScores }) {
  return (
    <dl className="flex flex-wrap gap-2">
      {ABILITY_KEYS.map((key) => (
        <div
          key={key}
          className="flex min-w-[3.5rem] flex-col items-center rounded border border-brown-400 bg-brown-100 px-2 py-1"
        >
          <dt className="text-xs font-semibold uppercase tracking-wide text-brown-600">
            {ABILITY_LABELS[key]}
          </dt>
          <dd className="text-lg font-bold tabular-nums text-brown-700">{scores[key]}</dd>
        </div>
      ))}
    </dl>
  );
}

function Facts({ race, background }: { race?: string; background?: string }) {
  if (race === undefined && background === undefined) return null;
  return (
    <dl className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
      {race !== undefined && (
        <div>
          <dt className="inline font-semibold text-brown-600">Race: </dt>
          <dd className="inline">{race}</dd>
        </div>
      )}
      {background !== undefined && (
        <div>
          <dt className="inline font-semibold text-brown-600">Background: </dt>
          <dd className="inline">{background}</dd>
        </div>
      )}
    </dl>
  );
}

export default function BuildView({
  draft,
  concept,
  streaming,
  complete,
  onRegenerate,
}: BuildViewProps) {
  const truncated = complete !== null && complete.levels.length < MAX_LEVEL;

  return (
    <article className="overflow-hidden rounded border border-brown-500 bg-parchment">
      <header className="space-y-3 border-b border-brown-400 bg-brown-200 p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-serif text-2xl font-bold text-brown-700">
            {draft.title ?? <span className="text-brown-600">Rolling up your character…</span>}
          </h2>
          {streaming && (
            <p className="text-sm text-brown-600" role="status" aria-live="polite">
              Generated level {draft.levels.length} of {MAX_LEVEL}…
            </p>
          )}
        </div>
        <Facts race={draft.race} background={draft.background} />
        {draft.abilityScores !== undefined && <AbilityScoreGrid scores={draft.abilityScores} />}
      </header>

      {draft.summary !== undefined && draft.summary.trim().length > 0 && (
        <section className="border-b border-brown-400 p-4">
          <h3 className="mb-1 font-serif font-bold text-brown-700">How it plays</h3>
          <p>{draft.summary}</p>
        </section>
      )}

      <BuildTable levels={draft.levels} streaming={streaming} />

      {draft.roleplayNotes !== undefined && draft.roleplayNotes.trim().length > 0 && (
        <section className="border-t border-brown-400 p-4">
          <h3 className="mb-1 font-serif font-bold text-brown-700">Playing the part</h3>
          <p>{draft.roleplayNotes}</p>
        </section>
      )}

      {truncated && (
        <p className="border-t border-brown-400 bg-brown-200 p-4 text-sm text-brown-700">
          This build stops at level {complete.levels.length} of {MAX_LEVEL} — the model’s response
          was cut short. Regenerating usually gets the full progression.
        </p>
      )}

      {complete !== null && (
        <div className="border-t border-brown-400 p-4">
          <BuildActions
            build={complete}
            concept={concept}
            onRegenerate={onRegenerate}
            busy={streaming}
          />
        </div>
      )}
    </article>
  );
}
