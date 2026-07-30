# Classi 🎲

A fan-made character build generator for Baldur's Gate 3. Describe a character in
plain English and Classi returns a complete level 1-12 build with roleplay flavour
and mechanical synergy.

## Features

- **Free to run** — the default model costs nothing, so a working deploy needs an
  OpenRouter account but no credit.
- **Structured build generation** — the model returns JSON against a strict schema,
  so every level, class split and choice lands in its own field instead of being
  regex-scraped out of prose.
- **Streams as it generates** — the header appears in about a second and levels
  fill in one row at a time, rather than a blank screen for half a minute.
- **Server-side API key** — the OpenRouter key lives in a serverless function and
  never reaches the browser.
- **Local history** — the last 20 builds are kept in your browser and can be
  reopened, with no account required.
- **Copy and download** — export any build as Markdown for Discord, Reddit or notes.
- **Parchment theme** — serif typography and a brown palette, responsive down to
  phone width.

## Tech stack

- **Frontend** — React 19 + TypeScript, Vite 7, Tailwind CSS 3.4
- **API** — one Vercel Edge function (`api/generate.ts`)
- **Model** — OpenRouter, defaulting to the free `google/gemma-4-26b-a4b-it:free`
- **Tests** — Vitest

## Getting started

### Prerequisites

- Node.js 20+
- An [OpenRouter](https://openrouter.ai/) account and API key

### Setup

```bash
git clone https://github.com/linaliwanag/classi.git
cd classi
npm install
cp .env.example .env
```

Put your key in `.env`:

```env
OPENROUTER_API_KEY=sk-or-v1-...
```

Then:

```bash
npm run dev
```

Open http://localhost:5173.

### About that missing `VITE_` prefix

`OPENROUTER_API_KEY` is intentionally **not** prefixed with `VITE_`. Vite inlines
every `VITE_`-prefixed variable into the client bundle at build time, so a key
named `VITE_OPENROUTER_API_KEY` is readable by anyone who opens devtools on the
deployed site — `.gitignore` does not help, because the leak is in the compiled
JavaScript rather than the repo.

The key is read only by `api/generate.ts`, which runs on the server. To confirm
nothing leaked after a change:

```bash
npm run build && grep -r "sk-or-" dist/ || echo "clean"
```

## Configuration

| Variable | Required | Default | Purpose |
| --- | --- | --- | --- |
| `OPENROUTER_API_KEY` | yes | — | Server-side OpenRouter credential. |
| `OPENROUTER_MODEL` | no | `google/gemma-4-26b-a4b-it:free` | Any OpenRouter model with structured-output support. |

### Choosing a model

The default costs **nothing**. Swapping needs no code change, only the env var.

| Model | Cost per build | Notes |
| --- | --- | --- |
| `google/gemma-4-26b-a4b-it:free` | free | The default. ~30s for 12 levels. Gets class/feat timing right; sometimes omits a subclass choice. |
| `anthropic/claude-haiku-4.5` | ~2¢ | Noticeably better rules recall. |
| `anthropic/claude-sonnet-5` | ~4¢ | Best BG3 accuracy of the practical options. |

Free-tier limits are **20 requests/minute**, and **50/day** — rising to
**1,000/day** once an account has purchased at least $10 of credit at any point.

Two constraints on any replacement:

- **It must support structured outputs.** Only a handful of `:free` models do.
  Check `supported_parameters` on <https://openrouter.ai/api/v1/models> for
  `structured_outputs`; without it, `provider.require_parameters` finds no
  provider and the request fails.
- **Avoid reasoning models.** Reasoning tokens count against `max_tokens`. The
  free reasoning models spend the whole budget thinking and return no build —
  `openai/gpt-oss-20b:free` produced 23,000 characters of reasoning and zero
  characters of output in 389 seconds. Also note some models reject
  `temperature`, which is why this app does not send it.

## Scripts

```bash
npm run dev        # dev server, with the API route mounted locally
npm run build      # typecheck all three tsconfig projects, then build
npm run lint       # eslint
npm test           # vitest, single run
npm run test:watch # vitest, watch mode
```

## Project structure

```
api/
└── generate.ts            # Edge function: holds the key, calls OpenRouter, streams back
src/
├── components/
│   ├── BuildActions.tsx   # copy, download, regenerate
│   ├── BuildTable.tsx     # level-by-level table
│   ├── BuildView.tsx      # header, summary, table, roleplay notes
│   ├── ConceptForm.tsx    # textarea, examples, submit
│   └── HistoryPanel.tsx   # past builds
├── lib/
│   ├── api.ts             # browser client for /api/generate
│   ├── build.ts           # types, JSON schema, runtime validation
│   ├── history.ts         # localStorage history
│   ├── markdown.ts        # Markdown export
│   ├── prompt.ts          # system prompt and concept validation
│   ├── sse.ts             # reader for OpenRouter's SSE format
│   ├── streamJson.ts      # incremental JSON reader for progressive rendering
│   └── wire.ts            # NDJSON protocol between the function and the browser
├── App.tsx                # state and composition
└── index.css              # Tailwind entry and base styles
```

### How streaming works

1. The browser POSTs a concept to `/api/generate`.
2. The function calls OpenRouter with `stream: true` and the build JSON schema.
3. OpenRouter's server-sent events are translated into newline-delimited JSON
   events (`delta`, `error`, `done`). NDJSON rather than a raw text stream because
   once a streaming response has started the HTTP status is already committed, and
   a failure mid-generation still needs a way to reach the client.
4. The browser accumulates the model's JSON and rescans it as chunks land,
   rendering each field and each level as soon as it has *definitively* finished
   arriving. `src/lib/streamJson.ts` never reports a half-written value.
5. On `done` the whole buffer is parsed and validated. A response cut short is
   salvaged down to the last complete level rather than discarded.

Locally there is no Vercel, so `vite.config.ts` loads that same function through
Vite's SSR pipeline and adapts Node's req/res to the Web `Request`/`Response` it
expects — one handler in both environments.

## Deployment (Vercel)

1. Push to GitHub and import the repo into Vercel. The Vite preset is detected
   automatically and `api/generate.ts` is picked up as an Edge function.
2. Add `OPENROUTER_API_KEY` under **Settings → Environment Variables**. Add
   `OPENROUTER_MODEL` too if you want something other than the default.
3. Deploy.

Other hosts work, but `api/generate.ts` is a Vercel-shaped entry point. It is
written against standard `Request`/`Response` and Web Streams, so porting it to
Cloudflare Pages or Netlify is a matter of moving the file and renaming the
export, not rewriting it.

### Before you make it public

The proxy stops the key from leaking, but `/api/generate` is unauthenticated, so
anyone who finds the URL can spend your credits. Two things worth doing:

- Set a **credit limit** on the OpenRouter key.
- Add rate limiting. Vercel's WAF can do per-IP limits without any code; a
  durable per-user limit needs a store such as Upstash or Vercel KV.

The function caps `max_tokens` and concept length, which bounds the cost of any
single request but not the number of requests.

## Usage

1. Describe a character, or pick one of the example concepts.
2. Press **Generate Build** (or ⌘/Ctrl + Enter).
3. Watch the levels stream in. **Stop** cancels a run in progress.
4. Copy or download the result, or regenerate for a different take.

Past builds are listed under the results and stored only in your browser.

## Contributing

1. Fork the repository and create a feature branch.
2. Make your changes.
3. Run `npm run lint`, `npm test` and `npm run build`.
4. Open a pull request.

## Legal notice

Classi is a fan-made tool and is not affiliated with Baldur's Gate 3, Larian
Studios, or Wizards of the Coast in any capacity.

## License

[MIT](LICENSE).
