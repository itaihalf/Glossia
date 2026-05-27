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

const STREAK_TO_KNOWN = 5

export interface ReviewWordInput {
  entry: WordBankEntry
  response: 'comfortable' | 'practice'
  userId: string
}

export interface ReviewWordResult {
  newStreak: number
  movedToKnown: boolean
}

export function useReviewWord() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ entry, response }: ReviewWordInput): Promise<ReviewWordResult> => {
      const newStreak    = response === 'comfortable' ? entry.streak_count + 1 : 0
      const movedToKnown = response === 'comfortable' && newStreak >= STREAK_TO_KNOWN

      const { error } = await supabase
        .from('word_bank')
        .update({
          streak_count:       newStreak,
          times_reviewed:     entry.times_reviewed + 1,
          successful_reviews: response === 'comfortable'
            ? entry.successful_reviews + 1
            : entry.successful_reviews,
          status:             movedToKnown ? 'known' : 'learning',
          last_reviewed_at:   new Date().toISOString(),
        })
        .eq('id', entry.id)

      if (error) throw error
      return { newStreak, movedToKnown }
    },
    onSuccess: (_result, variables) => {
      qc.invalidateQueries({ queryKey: ['word-bank', variables.userId, variables.entry.language] })
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
