import OpenAI from 'openai'

// Mirrors the model constants in src/lib/ai.ts — keep in sync.
const STORY_MODEL = 'gpt-5-mini'
const TRANSLATION_MODEL = 'gpt-5-nano'
const ALLOWED_MODELS = new Set([STORY_MODEL, TRANSLATION_MODEL])

let client = null
function getClient() {
  if (!client) {
    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) throw new Error('OPENAI_API_KEY is not configured on the server')
    client = new OpenAI({ apiKey })
  }
  return client
}

function jsonResponse(statusCode, payload) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }
}

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return jsonResponse(405, { error: 'Method not allowed' })
  }

  let body
  try {
    body = JSON.parse(event.body || '{}')
  } catch {
    return jsonResponse(400, { error: 'Invalid JSON body' })
  }

  const { prompt, model, responseFormat, temperature, reasoningEffort } = body

  if (typeof prompt !== 'string' || !prompt.trim()) {
    return jsonResponse(400, { error: 'A non-empty "prompt" string is required' })
  }
  if (!ALLOWED_MODELS.has(model)) {
    return jsonResponse(400, { error: 'Unsupported model' })
  }

  try {
    const openai = getClient()
    const response = await openai.chat.completions.create({
      model,
      messages: [{ role: 'user', content: prompt }],
      ...(responseFormat === 'json_object' ? { response_format: { type: 'json_object' } } : {}),
      ...(typeof temperature === 'number' ? { temperature } : {}),
      ...(reasoningEffort ? { reasoning_effort: reasoningEffort } : {}),
    })

    const content = response.choices[0]?.message?.content ?? ''
    return jsonResponse(200, { content })
  } catch (err) {
    console.error('OpenAI request failed:', err)
    return jsonResponse(502, { error: 'AI request failed. Please try again.' })
  }
}
