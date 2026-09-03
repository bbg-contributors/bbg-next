import type { IncomingMessage, ServerResponse } from 'node:http'
import { Buffer } from 'node:buffer'
import { readFile, stat } from 'node:fs/promises'
import { createServer } from 'node:http'
import { extname, join, normalize, relative, resolve, sep } from 'node:path'

const reloadPath = '/__bbg/reload'

const mimeTypes: Readonly<Record<string, string>> = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
  '.xml': 'application/xml; charset=utf-8',
}

// injected into HTML responses in memory only, never written to disk
const reloadSnippet = `<script>
(() => {
  const source = new EventSource(${JSON.stringify(reloadPath)})
  source.addEventListener('reload', () => location.reload())
})()
</script>
`

export interface PreviewServer {
  readonly url: string
  readonly reload: () => void
  readonly close: () => Promise<void>
}

export interface PreviewServerOptions {
  readonly root: string
  readonly host: string
  readonly port: number
}

function contentType(path: string): string {
  return mimeTypes[extname(path).toLowerCase()] ?? 'application/octet-stream'
}

/** `null` if the path tries to escape the root. */
function safeResolve(root: string, pathname: string): string | null {
  let decoded: string
  try {
    decoded = decodeURIComponent(pathname)
  } catch {
    return null
  }

  const target = resolve(root, `.${normalize(decoded)}`)
  const rel = relative(root, target)
  if (rel.startsWith(`..${sep}`) || rel === '..') return null

  return target
}

interface Served {
  /** What was actually read: a directory resolves to its index.html. Type the response from this. */
  readonly path: string
  readonly body: Buffer
}

async function readIfFile(path: string): Promise<Served | null> {
  try {
    const info = await stat(path)
    if (info.isDirectory()) return await readIfFile(join(path, 'index.html'))
    if (!info.isFile()) return null

    return { path, body: await readFile(path) }
  } catch {
    return null
  }
}

function injectReload(html: Buffer): Buffer {
  const text = html.toString('utf8')
  const index = text.lastIndexOf('</body>')

  return Buffer.from(
    index === -1 ? text + reloadSnippet : text.slice(0, index) + reloadSnippet + text.slice(index),
    'utf8',
  )
}

export async function startPreviewServer(options: PreviewServerOptions): Promise<PreviewServer> {
  const { root, host, port } = options
  const clients = new Set<ServerResponse>()

  const handle = async (request: IncomingMessage, response: ServerResponse): Promise<void> => {
    // Built absolute: resolved against a base, `//foo` would parse as protocol-relative and throw.
    const url = new URL(`http://${host}${request.url ?? '/'}`)

    if (url.pathname === reloadPath) {
      response.writeHead(200, {
        'Cache-Control': 'no-store',
        'Content-Type': 'text/event-stream',
        Connection: 'keep-alive',
      })
      response.write(': connected\n\n')
      clients.add(response)
      request.once('close', () => clients.delete(response))

      return
    }

    const target = safeResolve(root, url.pathname)
    if (target === null) {
      response.writeHead(403).end('Forbidden')

      return
    }

    let served = await readIfFile(target)

    // SPA fallback. Extensionless only, so a missing asset still 404s instead of returning HTML.
    if (served === null && extname(url.pathname) === '') {
      served = await readIfFile(join(root, 'index.html'))
    }

    if (served === null) {
      response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Not found')

      return
    }

    const type = contentType(served.path)
    const body = type.startsWith('text/html') ? injectReload(served.body) : served.body

    response.writeHead(200, {
      'Cache-Control': 'no-store',
      'Content-Length': body.byteLength,
      'Content-Type': type,
    })
    response.end(body)
  }

  const server = createServer((request, response) => {
    handle(request, response).catch((cause: unknown) => {
      const message = cause instanceof Error ? cause.message : String(cause)
      if (!response.headersSent) response.writeHead(500, { 'Content-Type': 'text/plain' })
      response.end(`Preview server error: ${message}`)
    })
  })

  await new Promise<void>((settle, fail) => {
    server.once('error', fail)
    server.listen(port, host, settle)
  })

  return {
    url: `http://${host}:${port}/`,

    reload: () => {
      for (const client of clients) client.write('event: reload\ndata: {}\n\n')
    },

    close: async () => {
      for (const client of clients) client.end()
      clients.clear()
      await new Promise<void>(settle => server.close(() => settle()))
    },
  }
}
