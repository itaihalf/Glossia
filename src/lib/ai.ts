import { getLanguageName } from './utils'
import { containsTokenRun, splitWords, tokenizeWords } from './words'
import type { UsedWord } from './types'

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
  /** The user's full interest list — generateStory samples one. */
  interests: string[]
  wordBankWords: Array<{ id?: string; word: string; translation: string }>
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

/** Story JSON as returned by the model, before we verify its used-word report. */
interface GeneratedStoryRaw extends GeneratedStory {
  /** {word, forms} pairs the model reports it wove in — unverified. */
  used_words?: unknown
}

export interface GenerateStoryResult extends GeneratedStory {
  /** Word-bank entries verified to be in the story, with their surface forms. */
  usedWords: UsedWord[]
  /** The interest value chosen for the theme, or null (topic-driven / none). */
  interestUsed: string | null
}

// ─── Shared helpers ───────────────────────────────────────────────────────────

const STORY_MODEL = 'gpt-5-mini'
const TRANSLATION_MODEL = 'gpt-5-nano'

// ─── Randomisation utilities ──────────────────────────────────────────────────

/** Returns a new array with the elements of `arr` in random order (Fisher–Yates). */
function shuffle<T>(arr: readonly T[]): T[] {
  const out = [...arr]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

/** Picks a single random element, or undefined if the array is empty. */
function pickOne<T>(arr: readonly T[]): T | undefined {
  if (arr.length === 0) return undefined
  return arr[Math.floor(Math.random() * arr.length)]
}

/** Shuffles and returns up to `n` elements (fewer if the array is shorter). */
function sample<T>(arr: readonly T[], n: number): T[] {
  return shuffle(arr).slice(0, Math.max(0, n))
}

/**
 * Maps each standard interest (see INTERESTS in constants.ts) to a list of
 * specific sub-interests. One sub-interest is sampled at story time so that
 * repeated stories around the same interest stay varied and concrete.
 */
const INTEREST_SUBTOPICS: Record<string, string[]> = {
  sports:        ['tennis', 'basketball', 'bouldering', 'scuba diving', 'marathon running', 'surfing', 'football', 'cycling', 'skiing', 'boxing', 'swimming', 'table tennis'],
  hiking:        ['summiting a peak', 'a coastal trail', 'forest camping', 'a desert trek', 'wild swimming', 'spotting wildlife', 'a mountain hut stay', 'a river-valley walk', 'navigating with a map', 'an overnight thru-hike', 'a waterfall hike', 'foraging on the trail'],
  food:          ['street food', 'baking bread', 'a family recipe', 'a food market', 'making pasta', 'spicy cuisine', 'a cooking competition', 'fermentation', 'desserts and pastries', 'a vegetarian feast', 'coffee culture', 'a seaside seafood meal'],
  travel:        ['a backpacking trip', 'a missed train', 'a city food tour', 'an island getaway', 'a road trip', 'a homestay abroad', 'getting lost in an old town', 'a night market', 'a long-distance flight', 'a mountain village', 'a museum visit', 'a beach holiday'],
  cars:          ['a classic car restoration', 'a road race', 'electric vehicles', 'a cross-country drive', 'a mechanic’s garage', 'a vintage rally', 'learning to drive', 'a Formula 1 weekend', 'off-road driving', 'a car auction', 'a breakdown on the highway', 'tuning an engine'],
  history:       ['ancient Rome', 'medieval castles', 'the age of exploration', 'an archaeological dig', 'a famous battle', 'the Industrial Revolution', 'ancient Egypt', 'a forgotten empire', 'a historical mystery', 'old trade routes', 'a revolution', 'life in a past century'],
  mythology:     ['Greek gods', 'Norse legends', 'a hero’s quest', 'sea monsters', 'Egyptian deities', 'a trickster spirit', 'underworld journeys', 'mythical creatures', 'a cursed artifact', 'creation myths', 'a prophecy', 'gods in disguise'],
  math:          ['a puzzle competition', 'patterns in nature', 'a clever shortcut', 'probability and games', 'geometry in art', 'a famous unsolved problem', 'codes and ciphers', 'infinity', 'a logic riddle', 'numbers in everyday life', 'a mathematician’s discovery', 'symmetry'],
  science:       ['a space mission', 'a chemistry experiment', 'deep-sea creatures', 'volcanoes', 'the human brain', 'climate and weather', 'robotics', 'a lab discovery', 'genetics', 'electricity', 'dinosaurs', 'a solar eclipse'],
  music:         ['jazz', 'playing guitar', 'a music festival', 'forming a band', 'classical concerts', 'writing a song', 'a DJ set', 'learning the piano', 'street musicians', 'a choir', 'vinyl records', 'a first live show'],
  movies:        ['a film set', 'a heist thriller', 'an animated adventure', 'a sci-fi blockbuster', 'an old black-and-white classic', 'a horror night', 'a documentary', 'a film festival', 'special effects', 'a romantic comedy', 'a superhero saga', 'a surprise plot twist'],
  animals:       ['a clever dog', 'wild cats', 'ocean life', 'a bird migration', 'a zoo rescue', 'farm animals', 'insects and bugs', 'a wildlife safari', 'an animal shelter', 'reptiles', 'a pet adventure', 'endangered species'],
  technology:    ['a new smartphone app', 'artificial intelligence', 'a robot helper', 'video game design', 'a hacking mystery', 'virtual reality', 'a startup launch', 'drones', 'a coding challenge', 'social media', 'a gadget that breaks', 'self-driving cars'],
  fantasy:       ['a dragon', 'a wizard’s tower', 'an enchanted forest', 'a magic sword', 'a hidden kingdom', 'a talking animal companion', 'a quest for treasure', 'a sorcerer’s duel', 'a portal to another world', 'a cursed village', 'a flying ship', 'an ancient prophecy'],
  daily_life:    ['a busy morning routine', 'grocery shopping', 'a neighbour’s favour', 'a rainy commute', 'cooking dinner', 'a weekend at home', 'losing the keys', 'a chat with a stranger', 'doing the laundry', 'a power outage', 'a visit to the doctor', 'a quiet evening'],
  school:        ['an important exam', 'a science fair', 'a new student', 'a school trip', 'a difficult teacher', 'a group project', 'sports day', 'a forgotten homework', 'a class election', 'the school play', 'making friends', 'graduation day'],
  work:          ['a job interview', 'a tough deadline', 'a new colleague', 'a big presentation', 'a difficult client', 'a promotion', 'working from home', 'a team retreat', 'an office mix-up', 'a first day at work', 'a brilliant idea', 'a long meeting'],
  relationships: ['a first date', 'an old friendship', 'a family reunion', 'a misunderstanding', 'a long-distance friend', 'meeting the in-laws', 'a surprise reunion', 'making up after an argument', 'a new neighbour', 'a wedding', 'a secret crush', 'a loyal best friend'],
  comedy:        ['a hilarious mix-up', 'a prank gone wrong', 'an awkward dinner', 'a talking pet', 'a clumsy hero', 'a case of mistaken identity', 'a disastrous holiday', 'a silly bet', 'a stand-up night', 'a misheard phrase', 'a chaotic party', 'an unlucky day'],
}

/** Word-bank words to weave into a story, scaled by target length. */
const WORD_BANK_LIMITS: Record<'very_short' | 'short' | 'medium' | 'long', number> = {
  very_short: 4,
  short:      6,
  medium:     9,
  long:       13,
}

// Netlify Edge Function — routed in netlify.toml. Keep the two in sync.
const AI_ENDPOINT = '/api/generate'

interface AiRequest {
  prompt: string
  model: string
  responseFormat?: 'json_object'
  temperature?: number
  reasoningEffort?: 'low' | 'medium' | 'high'
}

/**
 * Calls our Netlify edge function (which holds the OpenAI API key server-side)
 * and consumes the streamed token response. We accumulate the deltas and return
 * the complete text once the stream closes.
 *
 * The stream may contain leading whitespace keepalive bytes emitted while the
 * model is still reasoning; JSON.parse ignores them and generateText() trims.
 */
async function callAi(request: AiRequest): Promise<string> {
  const response = await fetch(AI_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  })

  // Errors are returned as a normal (non-streamed) JSON body.
  if (!response.ok || !response.body) {
    const { error } = await response.json().catch(() => ({ error: undefined }))
    throw new Error(error || 'AI request failed. Please try again.')
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let text = ''
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    text += decoder.decode(value, { stream: true })
  }
  text += decoder.decode() // flush any buffered multi-byte char
  return text
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

/** Narrows an unknown JSON value to a trimmed non-empty string, or null. */
function asText(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

/**
 * Groups the model's `used_words` report by base form. Tolerates a bare string
 * where an object was asked for, and a single form where a list was asked for.
 */
function collectReportedForms(reported: unknown): Map<string, string[]> {
  const byWord = new Map<string, string[]>()
  if (!Array.isArray(reported)) return byWord

  for (const item of reported) {
    const record = typeof item === 'object' && item !== null
      ? item as Record<string, unknown>
      : null

    const word = asText(record ? record.word : item)
    if (!word) continue

    const rawForms = record?.forms
    const forms = Array.isArray(rawForms)
      ? rawForms.map(asText).filter((f): f is string => f !== null)
      : [asText(rawForms) ?? word]

    byWord.set(word.toLowerCase(), [...(byWord.get(word.toLowerCase()) ?? []), ...forms])
  }

  return byWord
}

/**
 * Turns the model's report into a verified index of the vocabulary the story
 * actually contains. Nothing is taken on trust: a reported word must be one we
 * offered, and each reported form must occur in the content as a run of whole
 * tokens — a substring test would match `es` inside `interesante`. A word the
 * model used but forgot to report is still caught by its base form.
 *
 * Whatever survives drives both the reader's highlighting and the Review
 * flashcards, which is what keeps those two in step.
 */
function resolveUsedWords(
  offered: Array<{ id?: string; word: string; translation: string }>,
  reported: unknown,
  content: string,
): UsedWord[] {
  const contentTokens = tokenizeWords(content)
  const reportedForms = collectReportedForms(reported)
  const out: UsedWord[] = []

  for (const entry of offered) {
    const base = entry.word.trim()
    if (!entry.id || !base) continue

    // Everything reported for this word, plus the base form as a safety net.
    const candidates = [...(reportedForms.get(base.toLowerCase()) ?? []), base]

    const forms: string[] = []
    const seen = new Set<string>()
    for (const candidate of candidates) {
      const tokens = tokenizeWords(candidate)
      if (tokens.length === 0) continue

      const key = tokens.join(' ')
      if (seen.has(key)) continue
      if (!containsTokenRun(contentTokens, tokens)) continue

      seen.add(key)
      forms.push(splitWords(candidate).join(' '))
    }

    if (forms.length > 0) out.push({ id: entry.id, word: base, forms })
  }

  return out
}

export async function generateStory(params: GenerateStoryParams): Promise<GenerateStoryResult> {
  const languageName = getLanguageName(params.languageCode)

  const wordCounts: Record<typeof params.length, string> = {
    very_short: '80–120',
    short:      '180–220',
    medium:     '330–370',
    long:       '480–520',
  }

  const levelDescriptions: Record<string, string> = {
    complete_beginner: 'A1 — present tense only, simple but natural-sounding sentences using basic conjunctions (and, but, so), very common words',
    beginner:          'A2 — present and simple past, natural narrative flow using basic connectives, short but cohesive sentences',
    novice:            'B1 — main tenses, moderate vocabulary, compound sentences',
    intermediate:      'B2 — all major tenses, varied vocabulary, complex sentences',
    advanced:          'C1/C2 — advanced grammar, rich vocabulary, nuanced expression',
  }

  const paragraphCounts: Record<typeof params.length, string> = {
    very_short: '2–3',
    short:      '3–4',
    medium:     '4–5',
    long:       '5–6',
  }

  // Scale the word bank down to a random subset sized for the story length.
  const selectedWords = sample(params.wordBankWords, WORD_BANK_LIMITS[params.length])
  const wordBankSection = selectedWords.length > 0
    ? `\nVocabulary to naturally weave into the story (use as many as fit naturally):\n${
        selectedWords.map(w => `  - ${w.word} (${w.translation})`).join('\n')
      }\n`
    : ''

  // Topic and interests are mutually exclusive: a story idea overrides interests.
  // With no topic, sample one interest → one concrete sub-interest as the theme.
  let topicSection = ''
  let themeSection = ''
  let interestUsed: string | null = null
  if (params.topicHint) {
    topicSection = `\nTopic or story idea: "${params.topicHint}"\n`
  } else {
    const interest = pickOne(params.interests)
    if (interest) {
      interestUsed = interest
      const subInterest = pickOne(INTEREST_SUBTOPICS[interest] ?? []) ?? interest
      themeSection = `\nTheme to weave in: ${subInterest}\n`
    }
  }

  const linguisticSection = params.linguisticSpec
    ? `\nLinguistic specification (follow strictly): "${params.linguisticSpec}"\n`
    : ''

  // When vocabulary is offered, ask the model to report which words it wove in
  // AND how each one is actually spelled in the story. Inflected, conjugated
  // and prefixed forms rarely match the base form we supplied, so without this
  // report there is no reliable way to find those words in the finished text.
  const hasWords = selectedWords.length > 0
  const usedWordsInstruction = hasWords
    ? `\n7. In "used_words", report every vocabulary word you actually incorporated. For each one give "word" — the EXACT base form as written in the vocabulary list — and "forms" — every distinct form of it that literally appears in your story, copied character for character from the story text (conjugated, inflected, declined or prefixed as you wrote it). List a form once even if it occurs several times, and list several forms if you varied it. Omit any word you did not use, and never report a form that is not really in the story.`
    : ''
  const usedWordsJsonKey = hasWords
    ? `,\n  "used_words": [{ "word": "<base form from the vocabulary list>", "forms": ["<each distinct form exactly as it appears in the story>"] }]`
    : ''

  const prompt = `You are a language teacher writing a personalised story for a ${languageName} student.

Level: ${levelDescriptions[params.level] ?? params.level}
Target length: ${wordCounts[params.length]} words in ${languageName}${themeSection}${topicSection}${linguisticSection}${wordBankSection}
Instructions:
1. Write the story entirely in ${languageName}.
2. Use vocabulary and grammar suitable for the given level.
3. Divide into ${paragraphCounts[params.length]} natural paragraphs separated by blank lines.
4. Provide a paragraph-by-paragraph English translation with EXACTLY the same number of paragraphs.
5. Title should be in ${languageName}.
6. Do NOT mix languages within content or translation sections.${usedWordsInstruction}

Return ONLY this JSON (no markdown, no extra keys):
{
  "title": "<story title in ${languageName}>",
  "content": "<full story in ${languageName}, paragraphs separated by \\n\\n>",
  "translation": "<full English translation, same paragraph count, separated by \\n\\n>"${usedWordsJsonKey}
}`

  const parsed = await generateJson<GeneratedStoryRaw>(prompt, STORY_MODEL)
  if (!parsed.title || !parsed.content || !parsed.translation) {
    throw new Error('AI returned an unexpected format. Please try again.')
  }
  return {
    title: parsed.title,
    content: parsed.content,
    translation: parsed.translation,
    interestUsed,
    usedWords: resolveUsedWords(selectedWords, parsed.used_words, parsed.content),
  }
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

  const result = await generateJson<GeneratedStory>(prompt, STORY_MODEL)
  if (!result.title || !result.content) throw new Error('AI returned an unexpected format.')
  return result
}
