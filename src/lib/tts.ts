// TTS helpers — talk to the `read` Netlify serverless function, which wraps
// Google TTS (replacing the old local Python/gTTS server).

const TTS_ENDPOINT = '/.netlify/functions/read'

async function fetchAudio(text: string, lang: string, slow: boolean): Promise<Response> {
  return fetch(TTS_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, lang, slow }),
  })
}

/**
 * Fetch story audio and return a ready-to-play Audio element.
 * Requires internet. `lang` is an ISO 639-1 code (e.g. 'el', 'fr').
 *
 * The caller owns the returned element: call `.play()` to start playback and
 * `stopStoryAudio()` to stop and release it. Throws if the request fails.
 */
export async function fetchStoryAudio(text: string, lang: string): Promise<HTMLAudioElement> {
  const res = await fetchAudio(text, lang, false)
  if (!res.ok) throw new Error(`TTS request failed (${res.status})`)
  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  return new Audio(url)
}

/** Stop and fully reset a story Audio element, releasing its blob URL. */
export function stopStoryAudio(audio: HTMLAudioElement | null): void {
  if (!audio) return
  audio.pause()
  audio.currentTime = 0
  if (audio.src.startsWith('blob:')) URL.revokeObjectURL(audio.src)
}

/**
 * Fetch pronunciation audio for a single word and play it in the browser.
 * Read slowly for clarity. `lang` is an ISO 639-1 code (e.g. 'el', 'fr').
 */
export async function pronounceWord(word: string, lang: string): Promise<void> {
  const res = await fetchAudio(word, lang, true)
  if (!res.ok) return
  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const audio = new Audio(url)
  audio.onended = () => URL.revokeObjectURL(url)
  audio.play()
}
