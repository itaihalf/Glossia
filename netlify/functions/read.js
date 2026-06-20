import googleTTS from 'google-tts-api'

// Replicates the old gTTS Python server (tts_service.py): turn a text string +
// language code into MP3 audio. Google TTS caps a single request at 200 chars,
// so getAllAudioBase64() splits longer text into chunks; we concatenate the
// resulting MP3 buffers into one stream the browser can play directly.

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

  const text = (body.text || '').trim()
  const lang = (body.lang || 'en').trim()
  const slow = Boolean(body.slow)

  if (!text) {
    return jsonResponse(400, { error: 'text required' })
  }

  try {
    // Returns an ordered array of { shortText, base64 } chunks, each ≤ 200 chars.
    const chunks = await googleTTS.getAllAudioBase64(text, {
      lang,
      slow,
      splitPunct: ',.?!;:',
    })

    const audio = Buffer.concat(chunks.map((c) => Buffer.from(c.base64, 'base64')))

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'audio/mpeg' },
      body: audio.toString('base64'),
      isBase64Encoded: true,
    }
  } catch (err) {
    console.error('TTS request failed:', err)
    return jsonResponse(502, { error: 'TTS request failed. Please try again.' })
  }
}
