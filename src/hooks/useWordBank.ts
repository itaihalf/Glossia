import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { WordBankEntry, WordStatus } from '@/lib/types'

// ─── Query keys ───────────────────────────────────────────────────────────────

export const wordBankKeys = {
  list:   (uid: string, lang: string, status: WordStatus) =>
            ['word-bank', uid, lang, status] as const,
  stats:  (uid: string) => ['word-stats', uid] as const,
}

// ─── Queries ─────────────────────────────────────────────────────────────────

export function useWordBankItems(
  profileId: string | undefined,
  language: string,
  status: WordStatus,
) {
  return useQuery({
    queryKey: wordBankKeys.list(profileId ?? '', language, status),
    enabled: !!profileId && !!language,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('word_bank')
        .select('*')
        .eq('user_id', profileId!)
        .eq('language', language)
        .eq('status', status)
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as WordBankEntry[]
    },
  })
}

// ─── Add word ─────────────────────────────────────────────────────────────────

export interface AddWordInput {
  user_id: string
  language: string
  word: string
  base_form: string
  translation: string
  example_sentence: string | null
  encountered_forms: string[]
}

export function useAddWord() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: AddWordInput) => {
      // Check for duplicate before insert
      const { data: existing } = await supabase
        .from('word_bank')
        .select('id, word, translation, status')
        .eq('user_id', input.user_id)
        .eq('language', input.language)
        .eq('base_form', input.base_form)
        .maybeSingle()

      if (existing) {
        const err = new Error('DUPLICATE')
        ;(err as Error & { existing: unknown }).existing = existing
        throw err
      }

      const { data, error } = await supabase
        .from('word_bank')
        .insert({
          user_id: input.user_id,
          language: input.language,
          word: input.base_form,       // always store base form as display word
          base_form: input.base_form,
          translation: input.translation,
          example_sentence: input.example_sentence,
          status: 'learning',
          confidence: 0,
          times_reviewed: 0,
          successful_reviews: 0,
          encountered_forms: input.encountered_forms,
        })
        .select()
        .single()

      if (error) throw error
      return data as WordBankEntry
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['word-bank', variables.user_id, variables.language] })
      qc.invalidateQueries({ queryKey: wordBankKeys.stats(variables.user_id) })
    },
  })
}

// ─── Update status ────────────────────────────────────────────────────────────

interface UpdateStatusInput {
  id: string
  userId: string
  language: string
  status: WordStatus
  confidence?: number
}

export function useUpdateWordStatus() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, status, confidence }: UpdateStatusInput) => {
      const updates: Partial<WordBankEntry> = { status }
      if (confidence !== undefined) updates.confidence = confidence
      const { error } = await supabase
        .from('word_bank')
        .update(updates)
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['word-bank', variables.userId, variables.language] })
      qc.invalidateQueries({ queryKey: wordBankKeys.stats(variables.userId) })
    },
  })
}

// ─── Review word ─────────────────────────────────────────────────────────────

// Confidence thresholds for spaced-repetition promotion
const COMFORTABLE_GAIN   = 20   // +20 per correct response
const PRACTICE_LOSS      = 10   // −10 per practice response
const KNOWN_CONFIDENCE   = 80   // threshold to mark as known
const KNOWN_SUCCESSES    = 3    // minimum successful reviews before promotion

export interface ReviewWordInput {
  entry: WordBankEntry
  response: 'comfortable' | 'practice'
  userId: string
}

export interface ReviewWordResult {
  newConfidence: number
  movedToKnown: boolean
}

export function useReviewWord() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ entry, response }: ReviewWordInput): Promise<ReviewWordResult> => {
      const delta        = response === 'comfortable' ? COMFORTABLE_GAIN : -PRACTICE_LOSS
      const newConf      = Math.min(100, Math.max(0, entry.confidence + delta))
      const newSuccesses = response === 'comfortable'
        ? entry.successful_reviews + 1
        : entry.successful_reviews
      const movedToKnown =
        response === 'comfortable' &&
        newConf >= KNOWN_CONFIDENCE &&
        newSuccesses >= KNOWN_SUCCESSES

      const { error } = await supabase
        .from('word_bank')
        .update({
          confidence:        newConf,
          times_reviewed:    entry.times_reviewed + 1,
          successful_reviews: newSuccesses,
          status:            movedToKnown ? 'known' : entry.status,
          last_reviewed_at:  new Date().toISOString(),
        })
        .eq('id', entry.id)

      if (error) throw error
      return { newConfidence: newConf, movedToKnown }
    },
    onSuccess: (_result, variables) => {
      qc.invalidateQueries({ queryKey: ['word-bank', variables.userId] })
      qc.invalidateQueries({ queryKey: wordBankKeys.stats(variables.userId) })
    },
  })
}

// ─── Delete word ──────────────────────────────────────────────────────────────

interface DeleteWordInput {
  id: string
  userId: string
  language: string
}

export function useDeleteWord() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id }: DeleteWordInput) => {
      const { error } = await supabase
        .from('word_bank')
        .delete()
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['word-bank', variables.userId, variables.language] })
      qc.invalidateQueries({ queryKey: wordBankKeys.stats(variables.userId) })
    },
  })
}
