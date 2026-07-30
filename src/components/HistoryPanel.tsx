import { type HistoryEntry, MAX_HISTORY, relativeTime } from '../lib/history';

type HistoryPanelProps = {
  entries: HistoryEntry[];
  activeId: string | null;
  onOpen: (entry: HistoryEntry) => void;
  onRemove: (id: string) => void;
  onClear: () => void;
};

export default function HistoryPanel({
  entries,
  activeId,
  onOpen,
  onRemove,
  onClear,
}: HistoryPanelProps) {
  if (entries.length === 0) return null;

  return (
    <section
      aria-labelledby="history-heading"
      className="rounded border border-brown-500 bg-parchment"
    >
      <div className="flex items-baseline justify-between gap-2 border-b border-brown-400 bg-brown-200 p-3">
        <h2 id="history-heading" className="font-serif font-bold text-brown-700">
          Past builds
        </h2>
        <button
          type="button"
          onClick={onClear}
          className="rounded px-2 py-1 text-sm text-brown-600 underline transition-colors hover:text-brown-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brown-600"
        >
          Clear all
        </button>
      </div>

      <ul className="divide-y divide-brown-400">
        {entries.map((entry) => {
          const isActive = entry.id === activeId;
          return (
            <li key={entry.id} className={isActive ? 'bg-brown-100' : undefined}>
              <div className="flex items-start gap-2 p-3">
                <button
                  type="button"
                  onClick={() => onOpen(entry)}
                  aria-current={isActive ? 'true' : undefined}
                  className="min-w-0 flex-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brown-600"
                >
                  <span className="block font-semibold text-brown-700 underline-offset-2 hover:underline">
                    {entry.build.title}
                  </span>
                  <span className="block truncate text-sm text-brown-600">{entry.concept}</span>
                  <span className="block text-xs text-brown-600">
                    {relativeTime(entry.createdAt)}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => onRemove(entry.id)}
                  className="rounded px-2 py-1 text-sm text-brown-600 transition-colors hover:bg-brown-200 hover:text-brown-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brown-600"
                >
                  <span aria-hidden="true">✕</span>
                  <span className="sr-only">Delete “{entry.build.title}”</span>
                </button>
              </div>
            </li>
          );
        })}
      </ul>

      <p className="border-t border-brown-400 p-3 text-xs text-brown-600">
        Saved in this browser only, newest {MAX_HISTORY} kept.
      </p>
    </section>
  );
}
