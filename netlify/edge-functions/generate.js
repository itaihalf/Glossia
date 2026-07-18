// Netlify Edge Function (Deno runtime) — story/translation generation.
//
// Ported from netlify/functions/generate.js. Two deliberate differences from the
// serverless version:
//
//   1. No `openai` npm SDK. The SDK pulls in Node shims that are dead weight on
//      Deno, and all we need is one POST + an SSE reader. We call the REST API
//      with plain `fetch` and parse the event stream by hand.
//   2. Secrets come from `Deno.env`, not `process.env`.
//
// The wire format to the browser is unchanged: a plain-text stream of content
// deltas that src/lib/ai.ts accumulates and JSON.parses once the stream closes.

// Mirrors the model constants in src/lib/ai.ts — keep in sync.
const STORY_MODEL = 'gpt-5-mini'
const TRANSLATION_MODEL = 'gpt-5-nano'
const ALLOWED_MODELS = new Set([STORY_MODEL, TRANSLATION_MODEL])

const OPENAI_URL = 'https://api.openai.com/v1/chat/completions'

// Reasoning models emit no content deltas until reasoning finishes, so the first
// real byte can be a long way off. We drip a single space every 10s until then:
// proxies and CDNs see an active connection, and the client is unaffected because
// JSON.parse ignores leading whitespace and generateText() trims.
const KEEPALIVE_MS = 10_000

function jsonError(status, message) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

export default async (req) => {
  if (req.method !== 'POST') return jsonError(405, 'Method not allowed')

  const apiKey = Deno.env.get('OPENAI_API_KEY')
  if (!apiKey) return jsonError(500, 'OPENAI_API_KEY is not configured on the server')

  let body
  try {
    body = await req.json()
  } catch {
    return jsonError(400, 'Invalid JSON body')
  }

  const { prompt, model, responseFormat, temperature, reasoningEffort } = body

  if (typeof prompt !== 'string' || !prompt.trim()) {
    return jsonError(400, 'A non-empty "prompt" string is required')
  }
  if (!ALLOWED_MODELS.has(model)) {
    return jsonError(400, 'Unsupported model')
  }

  let upstream
  try {
    upstream = await fetch(OPENAI_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: prompt }],
        stream: true,
        ...(responseFormat === 'json_object' ? { response_format: { type: 'json_object' } } : {}),
        ...(typeof temperature === 'number' ? { temperature } : {}),
        ...(reasoningEffort ? { reasoning_effort: reasoningEffort } : {}),
      }),
    })
  } catch (err) {
    console.error('OpenAI request failed:', err)
    return jsonError(502, 'AI request failed. Please try again.')
  }

  // Failures before the first token (auth, bad request, rate limit) still have a
  // normal response body, so we can surface them as a proper JSON error.
  if (!upstream.ok || !upstream.body) {
    const detail = await upstream.text().catch(() => '')
    console.error('OpenAI returned', upstream.status, detail)
    return jsonError(502, 'AI request failed. Please try again.')
  }

  const encoder = new TextEncoder()
  const decoder = new TextDecoder()

  const stream = new ReadableStream({
    async start(controller) {
      let closed = false
      let sawContent = false

      // enqueue() throws once the controller is closed, and the keepalive timer
      // races the read loop, so every write goes through this guard.
      const send = (text) => {
        if (closed) return
        try {
          controller.enqueue(encoder.encode(text))
        } catch {
          closed = true
        }
      }

      const keepalive = setInterval(() => {
        if (!sawContent) send(' ')
      }, KEEPALIVE_MS)

      const reader = upstream.body.getReader()
      // OpenAI's SSE frames are split across network chunks arbitrarily, so we
      // hold a buffer and only consume whole lines.
      let buffer = ''

      try {
        for (;;) {
          const { done, value } = await reader.read()
          if (done) break

          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          // The trailing element is either '' (chunk ended on a newline) or a
          // partial line — either way it stays in the buffer for the next read.
          buffer = lines.pop() ?? ''

          for (const line of lines) {
            const trimmed = line.trim()
            if (!trimmed.startsWith('data:')) continue

            const payload = trimmed.slice(5).trim()
            if (payload === '[DONE]') continue

            let parsed
            try {
              parsed = JSON.parse(payload)
            } catch {
              // A frame we can't parse is not worth killing the story over.
              console.error('Skipping unparseable SSE frame:', payload.slice(0, 200))
              continue
            }

            const delta = parsed.choices?.[0]?.delta?.content
            if (delta) {
              sawContent = true
              send(delta)
            }
          }
        }
      } catch (err) {
        // We've already sent 200 + headers, so there's no switching to an error
        // status. Closing here leaves the client with a truncated body, which
        // fails its JSON.parse and trips the caller's "unexpected format" path.
        console.error('OpenAI stream interrupted:', err)
      } finally {
        clearInterval(keepalive)
        if (!closed) {
          closed = true
          controller.close()
        }
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  })
}
