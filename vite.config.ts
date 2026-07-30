import { Buffer } from 'node:buffer'
import type { IncomingMessage, ServerResponse } from 'node:http'
import react from '@vitejs/plugin-react'
import { type Plugin, type ViteDevServer, defineConfig, loadEnv } from 'vite'

const API_ROUTE = '/api/generate'
const API_MODULE = '/api/generate.ts'

/** Server-only variables. Deliberately un-prefixed so Vite cannot inline them. */
const SERVER_ENV_KEYS = ['OPENROUTER_API_KEY', 'OPENROUTER_MODEL']

/** Headers that describe the Node connection rather than the request itself. */
const HOP_BY_HOP = new Set([
  'connection',
  'keep-alive',
  'transfer-encoding',
  'upgrade',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'content-length',
])

async function readBody(req: IncomingMessage): Promise<Buffer | undefined> {
  const chunks: Buffer[] = []
  for await (const chunk of req) chunks.push(chunk as Buffer)
  return chunks.length > 0 ? Buffer.concat(chunks) : undefined
}

function toWebRequest(req: IncomingMessage, body: Buffer | undefined): Request {
  const headers = new Headers()
  for (const [key, value] of Object.entries(req.headers)) {
    if (value === undefined || HOP_BY_HOP.has(key.toLowerCase())) continue
    if (Array.isArray(value)) for (const item of value) headers.append(key, item)
    else headers.set(key, value)
  }

  // Connect rewrites req.url to the path *after* the mount point, and stashes
  // the original on a property it does not declare in its types.
  const { originalUrl } = req as IncomingMessage & { originalUrl?: string }
  const url = new URL(originalUrl ?? API_ROUTE, `http://${req.headers.host ?? 'localhost'}`)

  return new Request(url, { method: req.method ?? 'GET', headers, body })
}

async function pipeWebResponse(response: Response, res: ServerResponse): Promise<void> {
  res.statusCode = response.status
  response.headers.forEach((value, key) => res.setHeader(key, value))

  if (!response.body) {
    res.end()
    return
  }

  const reader = response.body.getReader()
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      res.write(Buffer.from(value))
    }
  } finally {
    reader.releaseLock()
    res.end()
  }
}

/**
 * Serve `api/generate.ts` during `vite dev`.
 *
 * In production Vercel runs that file as an Edge function; locally there is no
 * Vercel, so this loads the very same module through Vite's SSR pipeline and
 * adapts Node's req/res to the Web `Request`/`Response` it expects. One handler,
 * both environments, and no duplicated OpenRouter logic.
 */
function apiDevServer(): Plugin {
  return {
    name: 'classi:api-dev-server',
    apply: 'serve',
    configureServer(server: ViteDevServer) {
      server.middlewares.use(API_ROUTE, (req, res) => {
        void (async () => {
          try {
            const request = toWebRequest(req, await readBody(req))
            const module = await server.ssrLoadModule(API_MODULE)
            const handler = module.default as (request: Request) => Promise<Response>
            await pipeWebResponse(await handler(request), res)
          } catch (error) {
            server.config.logger.error(
              `[classi] ${API_ROUTE} threw: ${error instanceof Error ? error.stack : String(error)}`,
            )
            if (!res.headersSent) {
              res.statusCode = 500
              res.setHeader('content-type', 'application/json')
            }
            res.end(
              JSON.stringify({
                error: 'The local API route crashed. Check the dev server terminal.',
              }),
            )
          }
        })()
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // The empty prefix loads every variable in .env, not just VITE_ ones. This
  // does NOT expose them to the client — only `import.meta.env.VITE_*` is
  // inlined — it just makes them reachable from the dev middleware above.
  const env = loadEnv(mode, '.', '')
  for (const key of SERVER_ENV_KEYS) {
    if (env[key] && !process.env[key]) process.env[key] = env[key]
  }

  return {
    plugins: [react(), apiDevServer()],
  }
})
