import type { BuildLevel } from '../lib/build';
import { MAX_LEVEL } from '../lib/build';

type BuildTableProps = {
  levels: BuildLevel[];
  /** Show a placeholder row for the level still being generated. */
  streaming?: boolean;
};

function PendingRow({ level }: { level: number }) {
  return (
    <tr className="border-b border-brown-400 last:border-b-0">
      <th scope="row" className="p-3 align-top font-bold tabular-nums text-brown-600">
        {level <= MAX_LEVEL ? level : ''}
      </th>
      <td className="p-3 align-top" colSpan={2}>
        <span className="sr-only">Generating…</span>
        <span className="flex animate-pulse flex-col gap-2" aria-hidden="true">
          <span className="h-3 w-1/3 rounded bg-brown-300" />
          <span className="h-3 w-3/4 rounded bg-brown-300" />
        </span>
      </td>
    </tr>
  );
}

/**
 * The level-by-level progression.
 *
 * Takes already-validated data. There is no text parsing here by design: the
 * model returns JSON and every field lands in its own cell, which is what
 * removed the old bug where hyphenated words like "Half-Orc" were split into
 * spurious bullet points.
 */
export default function BuildTable({ levels, streaming = false }: BuildTableProps) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-left">
        <caption className="sr-only">
          Build progression from level 1 to {MAX_LEVEL}, listing the choices made at each level.
        </caption>
        <thead>
          <tr className="border-b-2 border-brown-500 bg-brown-200">
            <th scope="col" className="w-14 p-3 font-semibold text-brown-700">
              Lvl
            </th>
            <th scope="col" className="w-1/4 p-3 font-semibold text-brown-700">
              Progression
            </th>
            <th scope="col" className="p-3 font-semibold text-brown-700">
              Choices
            </th>
          </tr>
        </thead>
        <tbody>
          {levels.map((level) => (
            <tr key={level.level} className="border-b border-brown-400 last:border-b-0">
              <th
                scope="row"
                className="p-3 align-top font-bold tabular-nums text-brown-600"
              >
                {level.level}
              </th>
              <td className="p-3 align-top font-semibold">{level.progression}</td>
              <td className="p-3 align-top">
                <dl className="space-y-2">
                  {level.entries.map((entry, index) => (
                    <div key={`${entry.label}-${index}`}>
                      <dt className="inline font-semibold text-brown-600">{entry.label}: </dt>
                      <dd className="inline">{entry.detail}</dd>
                    </div>
                  ))}
                </dl>
              </td>
            </tr>
          ))}
          {streaming && <PendingRow level={levels.length + 1} />}
        </tbody>
      </table>
    </div>
  );
}
