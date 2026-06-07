import { getLanguageName } from './utils'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface NormalizedWord {
  encountered_form: string
  base_form: string
  translation: string
  part_of_speech: string
  example_sentence: string
}

// ─── Story generation ─────────────────────────────────────────────────────────

export interface GenerateStoryParams {
  languageCode: string
  level: string
  /** 1–2 interests already sampled from the user's list */
  interests: string[]
  wordBankWords: Array<{ word: string; translation: string }>
  length: 'very_short' | 'short' | 'medium' | 'long'
  topicHint?: string
  /** Teacher-supplied linguistic specification, e.g. "Use present tense only" */
  linguisticSpec?: string
}

export interface GeneratedStory {
  title: string
  /** Paragraphs separated by \n\n — target language */
  content: string
  /** Paragraph-aligned English translation, same \n\n structure */
  translation: string
}

// ─── Shared helpers ───────────────────────────────────────────────────────────

const STORY_MODEL = 'gpt-5-mini'
const TRANSLATION_MODEL = 'gpt-5-nano'

const AI_ENDPOINT = '/.netlify/functions/generate'

interface AiRequest {
  prompt: string
  model: string
  responseFormat?: 'json_object'
  temperature?: number
  reasoningEffort?: 'low' | 'medium' | 'high'
}

/** Calls our Netlify function, which holds the OpenAI API key server-side. */
async function callAi(request: AiRequest): Promise<string> {
  const response = await fetch(AI_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  })

  if (!response.ok) {
    const { error } = await response.json().catch(() => ({ error: undefined }))
    throw new Error(error || 'AI request failed. Please try again.')
  }

  const { content } = await response.json() as { content?: string }
  return content ?? ''
}

async function generateJson<T>(prompt: string, model = STORY_MODEL): Promise<T> {
  const text = await callAi({
    prompt,
    model,
    responseFormat: 'json_object',
    ...(model === TRANSLATION_MODEL ? { reasoningEffort: 'low' } : {}),
  })
  return JSON.parse(text) as T
}

async function generateText(prompt: string, temperature: number, model = TRANSLATION_MODEL): Promise<string> {
  const text = await callAi({
    prompt,
    model,
    temperature,
    ...(model === TRANSLATION_MODEL ? { reasoningEffort: 'low' } : {}),
  })
  return text.trim()
}

// ─── Contextual word translation ──────────────────────────────────────────────

export async function translateContextualWord(word: string, contextSentence: string): Promise<string> {
  const prompt = `Translate the word "${word}" as it is used in the following sentence into English.
Sentence: "${contextSentence}"
Return ONLY the base dictionary English translation of the word based on its context. No punctuation, no explanation, no extra text — just the single translated word or short phrase.`
  return generateText(prompt, 0.1, TRANSLATION_MODEL)
}

// ─── Story generation ─────────────────────────────────────────────────────────

export async function generateStory(params: GenerateStoryParams): Promise<GeneratedStory> {
  const languageName = getLanguageName(params.languageCode)

  const wordCounts: Record<typeof params.length, string> = {
    very_short: '80–120',
    short:      '180–220',
    medium:     '330–370',
    long:       '480–520',
  }

  const levelDescriptions: Record<string, string> = {
    complete_beginner: 'A1 — only present tense, extremely simple sentences, very common words only',
    beginner:          'A2 — present and simple past, basic connectives, short sentences',
    novice:            'B1 — main tenses, moderate vocabulary, compound sentences',
    intermediate:      'B2 — all major tenses, varied vocabulary, complex sentences',
    advanced:          'C1/C2 — advanced grammar, rich vocabulary, nuanced expression',
  }

  const wordBankSection = params.wordBankWords.length > 0
    ? `\nVocabulary to naturally weave into the story (use as many as fit naturally):\n${
        params.wordBankWords.map(w => `  - ${w.word} (${w.translation})`).join('\n')
      }\n`
    : ''

  const topicSection = params.topicHint
    ? `\nTopic or story idea: "${params.topicHint}"\n`
    : ''

  const linguisticSection = params.linguisticSpec
    ? `\nLinguistic specification (follow strictly): "${params.linguisticSpec}"\n`
    : ''

  const prompt = `You are a language teacher writing a personalised story for a ${languageName} student.

Level: ${levelDescriptions[params.level] ?? params.level}
Target length: ${wordCounts[params.length]} words in ${languageName}
Themes / interests to weave in: ${params.interests.join(', ')}${topicSection}${linguisticSection}${wordBankSection}
Instructions:
1. Write the story entirely in ${languageName}.
2. Use vocabulary and grammar suitable for the given level.
3. Divide into 3–5 natural paragraphs separated by blank lines.
4. Provide a paragraph-by-paragraph English translation with EXACTLY the same number of paragraphs.
5. Title should be in ${languageName}.
6. Do NOT mix languages within content or translation sections.

Return ONLY this JSON (no markdown, no extra keys):
{
  "title": "<story title in ${languageName}>",
  "content": "<full story in ${languageName}, paragraphs separated by \\n\\n>",
  "translation": "<full English translation, same paragraph count, separated by \\n\\n>"
}`

  const parsed = await generateJson<GeneratedStory>(prompt)
  if (!parsed.title || !parsed.content || !parsed.translation) {
    throw new Error('AI returned an unexpected format. Please try again.')
  }
  return parsed
}

// ─── Word normalisation ───────────────────────────────────────────────────────

export async function normalizeWord(
  word: string,
  languageCode: string,
  contextText = '',
): Promise<NormalizedWord> {
  const languageName = getLanguageName(languageCode)
  const contextLine = contextText ? `Context: "${contextText}"\n\n` : ''

  const prompt = `Word: "${word}" (${languageName})
${contextLine}Return JSON only:
{"encountered_form":"${word}","base_form":"<dict form>","translation":"<English>","part_of_speech":"<noun|verb|adjective|adverb|preposition|conjunction|pronoun|other>","example_sentence":"<short ${languageName} sentence (English)>"}`

  const parsed = await generateJson<NormalizedWord>(prompt, TRANSLATION_MODEL)
  if (!parsed.base_form || !parsed.translation) {
    throw new Error('AI returned an unexpected format. Please try again.')
  }
  return parsed
}

// ─── Story revision (teacher AI assistant) ───────────────────────────────────

export interface ReviseStoryParams {
  languageCode: string
  currentTitle: string
  currentContent: string
  currentTranslation: string
  instruction: string
}

export async function reviseStory(params: ReviseStoryParams): Promise<GeneratedStory> {
  const languageName = getLanguageName(params.languageCode)

  const prompt = `You are helping a ${languageName} teacher revise a language-learning story.

Current story title: "${params.currentTitle}"

Current story (${languageName}):
${params.currentContent}

Current translation (English):
${params.currentTranslation}

Teacher's revision instruction: "${params.instruction}"

Apply the instruction carefully. Keep the same paragraph count and overall structure unless the instruction changes them.
Return ONLY this JSON (no markdown, no extra keys):
{
  "title": "<revised title in ${languageName}>",
  "content": "<revised story in ${languageName}, paragraphs separated by \\n\\n>",
  "translation": "<revised English translation, same paragraph count, separated by \\n\\n>"
}`

  const result = await generateJson<GeneratedStory>(prompt)
  if (!result.title || !result.content) throw new Error('AI returned an unexpected format.')
  return result
}
