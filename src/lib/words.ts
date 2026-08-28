import type { UsedWord } from './types'

/**
 * Word tokenisation and surface-form matching, shared by story generation and
 * the reader. Both sides must agree on what counts as a word, otherwise a form
 * verified at generation time could fail to highlight when the story is read.
 */

// ─── Tokenisation ─────────────────────────────────────────────────────────────

/** Matches any sequence that contains at least one Unicode letter or digit. */
export const WORD_RE = /[\p{L}\p{N}]/u

/** Strips leading and trailing punctuation from a chunk of text. */
export function cleanWord(chunk: string): string {
  return chunk.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '')
}

/** Splits text into words with edge punctuation stripped, casing preserved. */
export function splitWords(text: string): string[] {
  return text
    .split(/\s+/u)
    .map(cleanWord)
    .filter(w => w.length > 0 && WORD_RE.test(w))
}

/** Splits text into the lowercased tokens used for every comparison here. */
export function tokenizeWords(text: string): string[] {
  return splitWords(text).map(w => w.toLowerCase())
}

// ─── Form matching ────────────────────────────────────────────────────────────

/** True if `phrase` occurs in `tokens` as a run of whole tokens. */
export function containsTokenRun(tokens: readonly string[], phrase: readonly string[]): boolean {
  if (phrase.length === 0 || phrase.length > tokens.length) return false
  for (let i = 0; i <= tokens.length - phrase.length; i++) {
    if (phrase.every((t, k) => t === tokens[i + k])) return true
  }
  return false
}

/**
 * Prepares surface forms for matching: tokenised, deduplicated, and ordered
 * longest first so a phrase ("ha comido") wins over one of its own words
 * ("comido") when both could match at the same position.
 */
export function buildHighlightForms(forms: readonly string[]): string[][] {
  const seen = new Set<string>()
  const out: string[][] = []

  for (const form of forms) {
    const tokens = tokenizeWords(form)
    if (tokens.length === 0) continue
    const key = tokens.join(' ')
    if (seen.has(key)) continue
    seen.add(key)
    out.push(tokens)
  }

  return out.sort((a, b) => b.length - a.length)
}

/**
 * Returns the positions in `tokens` that fall inside a match of one of `forms`.
 * Scans left to right taking the longest form available at each position, so
 * every occurrence of a word is marked, however many times it appears.
 */
export function matchFormPositions(tokens: readonly string[], forms: readonly string[][]): Set<number> {
  const marked = new Set<number>()
  if (forms.length === 0) return marked

  for (let i = 0; i < tokens.length; ) {
    const hit = forms.find(form => containsTokenRunAt(tokens, form, i))
    if (!hit) {
      i++
      continue
    }
    for (let k = 0; k < hit.length; k++) marked.add(i + k)
    i += hit.length
  }

  return marked
}

/** True if `phrase` matches `tokens` starting exactly at `start`. */
function containsTokenRunAt(tokens: readonly string[], phrase: readonly string[], start: number): boolean {
  if (phrase.length === 0 || start + phrase.length > tokens.length) return false
  return phrase.every((t, k) => t === tokens[start + k])
}

// ─── stories.words_used_from_bank ─────────────────────────────────────────────

/**
 * Reads the `words_used_from_bank` column. Stories written before surface-form
 * tracking hold a bare array of word_bank ids; those parse to entries with no
 * forms, which still drives Review but carries nothing to highlight.
 */
export function parseUsedWords(raw: unknown): UsedWord[] {
  if (!Array.isArray(raw)) return []
  const out: UsedWord[] = []

  for (const item of raw) {
    if (typeof item === 'string') {
      if (item) out.push({ id: item, word: '', forms: [] })
      continue
    }
    if (typeof item !== 'object' || item === null) continue

    const rec = item as Record<string, unknown>
    if (typeof rec.id !== 'string' || !rec.id) continue

    out.push({
      id:    rec.id,
      word:  typeof rec.word === 'string' ? rec.word : '',
      forms: Array.isArray(rec.forms)
        ? rec.forms.filter((f): f is string => typeof f === 'string' && f.length > 0)
        : [],
    })
  }

  return out
}

/** True if the column still holds the legacy id-only shape (no surface forms). */
export function isLegacyUsedWords(raw: unknown): boolean {
  return Array.isArray(raw) && raw.length > 0 && raw.every(item => typeof item === 'string')
}
