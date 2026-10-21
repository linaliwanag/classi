import { useCallback, useEffect, useRef, useState } from 'react';
import BuildView from './components/BuildView';
import ConceptForm from './components/ConceptForm';
import ErrorNotice from './components/ErrorNotice';
import HistoryPanel from './components/HistoryPanel';
import { type BuildDraft, GenerateError, generateBuild } from './lib/api';
import type { Build } from './lib/build';
import {
  type HistoryEntry,
  addEntry,
  createEntry,
  loadHistory,
  removeEntry,
  saveHistory,
} from './lib/history';
import {
  type Quota,
  isExhausted,
  loadQuota,
  nextResetAt,
  recordBuild,
  remainingBuilds,
  saveQuota,
} from './lib/quota';

type Status = 'idle' | 'streaming' | 'done' | 'error';

const emptyDraft = (): BuildDraft => ({ levels: [] });

/** A finished build already has every field a draft can show. */
const toDraft = (build: Build): BuildDraft => ({ ...build });

export default function App() {
  const [concept, setConcept] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [draft, setDraft] = useState<BuildDraft>(emptyDraft);
  const [build, setBuild] = useState<Build | null>(null);
  const [error, setError] = useState<GenerateError | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>(loadHistory);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [quota, setQuota] = useState<Quota>(loadQuota);

  /** The in-flight request, so it can be cancelled and staleness detected. */
  const requestRef = useRef<AbortController | null>(null);

  useEffect(() => () => requestRef.current?.abort(), []);
  useEffect(() => {
    saveHistory(history);
  }, [history]);
  useEffect(() => {
    saveQuota(quota);
  }, [quota]);

  // A tab left open across midnight should notice its allowance refilled,
  // rather than showing a stale "0 left" until the page is reloaded.
  useEffect(() => {
    const delay = Math.max(1000, nextResetAt() - Date.now()) + 1000;
    const timer = setTimeout(() => setQuota(loadQuota()), delay);
    return () => clearTimeout(timer);
  }, [quota.day]);

  const generate = useCallback(async (rawConcept: string) => {
    const trimmed = rawConcept.trim();
    if (trimmed.length === 0) {
      setError(new GenerateError('Describe your character first.'));
      setStatus('error');
      return;
    }

    // Read fresh rather than trusting state, so a day rollover is respected
    // even if the timer above has not fired yet.
    const current = loadQuota();
    if (isExhausted(current)) {
      setQuota(current);
      return; // the form already explains this and disables submitting
    }

    // Supersede any request already running.
    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    // A superseded request must not write state over its replacement's.
    const isCurrent = () => requestRef.current === controller;

    setStatus('streaming');
    setError(null);
    setBuild(null);
    setActiveId(null);
    setDraft(emptyDraft);

    try {
      const result = await generateBuild(trimmed, {
        signal: controller.signal,
        onProgress: (next) => {
          if (isCurrent()) setDraft(next);
        },
      });
      if (!isCurrent()) return;

      const entry = createEntry(trimmed, result);
      setBuild(result);
      setDraft(toDraft(result));
      setStatus('done');
      setHistory((entries) => addEntry(entries, entry));
      setActiveId(entry.id);
      // Counted only on success — a failed generation should not cost anyone
      // part of their allowance.
      setQuota(recordBuild(current));
    } catch (caught) {
      if (!isCurrent()) return;
      // Cancelling is not a failure — return to a clean idle state.
      if (caught instanceof DOMException && caught.name === 'AbortError') {
        setStatus('idle');
        return;
      }
      setError(
        caught instanceof GenerateError
          ? caught
          : new GenerateError(
              caught instanceof Error
                ? caught.message
                : 'Something went wrong generating that build. Try again.',
            ),
      );
      setStatus('error');
    } finally {
      // Whatever happened above, the button never stays stuck on "Generating…".
      if (isCurrent()) requestRef.current = null;
    }
  }, []);

  const cancel = useCallback(() => {
    requestRef.current?.abort();
  }, []);

  const openEntry = useCallback((entry: HistoryEntry) => {
    requestRef.current?.abort();
    requestRef.current = null;
    setConcept(entry.concept);
    setBuild(entry.build);
    setDraft(toDraft(entry.build));
    setActiveId(entry.id);
    setError(null);
    setStatus('done');
  }, []);

  const streaming = status === 'streaming';
  const showBuild = streaming || build !== null;

  return (
    <div className="min-h-screen bg-brown-300 text-black">
      <div className="mx-auto max-w-4xl p-6">
        <header className="mb-8">
          <h1 className="mb-3 font-serif text-4xl font-bold">Classi 🎲</h1>
          <p className="max-w-2xl font-serif text-lg">
            Describe your character concept, and Classi will generate a complete level 1-12
            Baldur’s Gate 3 build with roleplay flavour and mechanical synergy.
          </p>
        </header>

        <main className="space-y-6">
          <ConceptForm
            concept={concept}
            onConceptChange={setConcept}
            onSubmit={() => void generate(concept)}
            onCancel={cancel}
            streaming={streaming}
            buildsLeft={remainingBuilds(quota)}
            resetAt={nextResetAt()}
          />

          {/* Assertive: a failed generation is the one thing a screen reader
              user must not miss while waiting. */}
          <div role="alert" aria-live="assertive">
            {error !== null && <ErrorNotice error={error} />}
          </div>

          {showBuild && (
            <BuildView
              draft={draft}
              concept={concept}
              streaming={streaming}
              complete={build}
              onRegenerate={() => void generate(concept)}
            />
          )}

          <HistoryPanel
            entries={history}
            activeId={activeId}
            onOpen={openEntry}
            onRemove={(id) => setHistory((entries) => removeEntry(entries, id))}
            onClear={() => {
              setHistory([]);
              setActiveId(null);
            }}
          />
        </main>
      </div>

      <footer className="mt-12 border-t border-brown-400 pt-6">
        <div className="mx-auto max-w-4xl px-6 pb-6">
          <p className="text-center font-serif text-sm text-brown-600">
            Classi is a fan-made tool and is not affiliated with Baldur’s Gate 3, Larian Studios,
            or Wizards of the Coast in any capacity.
          </p>
          <p className="mt-2 text-center font-serif text-sm text-brown-600">
            <a href="/privacy.html" className="underline hover:text-brown-700">
              Privacy
            </a>
          </p>
        </div>
      </footer>
    </div>
  );
}
