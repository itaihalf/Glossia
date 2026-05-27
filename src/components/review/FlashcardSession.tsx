import { useState, useEffect, type ReactNode } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { X, CheckCircle, RotateCcw, Star } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { FlashCard } from './FlashCard'
import { Button } from '@/components/ui/Button'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { useReviewWord, type ReviewWordResult } from '@/hooks/useWordBank'
import type { WordBankEntry } from '@/lib/types'

// ─── Types ────────────────────────────────────────────────────────────────────

interface CardResult {
  word: string
  translation: string
  response: 'comfortable' | 'practice'
  movedToKnown: boolean
  newStreak: number
}

interface FlashcardSessionProps {
  storyId: string
  userId: string
  wordIds: string[]
  open: boolean
  onDone: () => void
}

type Phase = 'loading' | 'empty' | 'reviewing' | 'summary'

// ─── Component ────────────────────────────────────────────────────────────────

export function FlashcardSession({
  storyId,
  userId,
  wordIds,
  open,
  onDone,
}: FlashcardSessionProps) {
  const { data: wordEntries, isLoading } = useQuery({
    queryKey: ['review-words', storyId],
    enabled: open && wordIds.length > 0 && !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('word_bank')
        .select('*')
        .in('id', wordIds)
        .eq('user_id', userId)
        .eq('status', 'learning')
      if (error) throw error
      return (data ?? []) as WordBankEntry[]
    },
  })

  const { mutateAsync: reviewWord, isPending: isReviewing } = useReviewWord()
  const qc = useQueryClient()

  const [phase, setPhase]         = useState<Phase>('loading')
  const [cards, setCards]         = useState<WordBankEntry[]>([])
  const [cardIndex, setCardIndex] = useState(0)
  const [results, setResults]     = useState<CardResult[]>([])

  // Reset session whenever it opens
  useEffect(() => {
    if (!open) return
    setPhase('loading')
    setCardIndex(0)
    setResults([])
  }, [open, storyId])

  useEffect(() => {
    if (!open || isLoading) return
    if (wordIds.length === 0 || (wordEntries ?? []).length === 0) {
      setPhase('empty')
      return
    }
    setCards(wordEntries ?? [])
    setPhase('reviewing')
  }, [open, isLoading, wordEntries, wordIds.length])

  const handleRespond = async (response: 'comfortable' | 'practice') => {
    const entry = cards[cardIndex]
    if (!entry) return

    let reviewResult: ReviewWordResult = { newStreak: entry.streak_count, movedToKnown: false }
    try {
      reviewResult = await reviewWord({ entry, response, userId })
    } catch (err) {
      console.error("Review Update Error:", err)
    }

    // Explicitly flush stale word-bank cache so the Words tab always shows fresh data
    qc.invalidateQueries({ queryKey: ['word-bank', userId] })

    const next = [
      ...results,
      {
        word:        entry.word,
        translation: entry.translation,
        response,
        movedToKnown: reviewResult.movedToKnown,
        newStreak:    reviewResult.newStreak,
      },
    ]
    setResults(next)

    if (cardIndex + 1 >= cards.length) {
      setPhase('summary')
    } else {
      setCardIndex(i => i + 1)
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 bg-white flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-12 pb-3 border-b border-gray-100">
        <div>
          <h1 className="font-bold text-gray-900">Vocabulary Review</h1>
          <p className="text-xs text-gray-400">Words practiced in this story</p>
        </div>
        <button
          onClick={onDone}
          className="p-2 rounded-xl hover:bg-gray-100 text-gray-500 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col items-center justify-center px-5 pb-8">
        {(phase === 'loading' || isLoading) && <LoadingSpinner size="lg" />}

        {phase === 'empty' && !isLoading && (
          <div className="text-center max-w-xs">
            <p className="text-4xl mb-3">🎓</p>
            <p className="font-semibold text-gray-800 mb-2">Nothing to review</p>
            <p className="text-sm text-gray-500 mb-6">
              No Learning words from this story yet — try adding words as you read.
            </p>
            <Button onClick={onDone}>Done</Button>
          </div>
        )}

        {phase === 'reviewing' && cards[cardIndex] && (
          <FlashCard
            key={cards[cardIndex].id}
            entry={cards[cardIndex]}
            index={cardIndex}
            total={cards.length}
            isPending={isReviewing}
            onRespond={handleRespond}
          />
        )}

        {phase === 'summary' && (
          <SessionSummary results={results} onDone={onDone} />
        )}
      </div>
    </div>
  )
}

// ─── Session summary ──────────────────────────────────────────────────────────

function SessionSummary({
  results,
  onDone,
}: {
  results: CardResult[]
  onDone: () => void
}) {
  const comfortable  = results.filter(r => r.response === 'comfortable')
  const practice     = results.filter(r => r.response === 'practice')
  const movedToKnown = results.filter(r => r.movedToKnown)

  return (
    <div className="w-full max-w-sm">
      <div className="text-center mb-6">
        <p className="text-5xl mb-3">✨</p>
        <h2 className="text-xl font-bold text-gray-900 mb-1">Review complete!</h2>
        <p className="text-sm text-gray-500">
          You reviewed {results.length} word{results.length !== 1 ? 's' : ''}.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-6">
        <SummaryCard
          icon={<span className="text-xl">👍</span>}
          count={comfortable.length}
          label="Comfortable"
          color="emerald"
        />
        <SummaryCard
          icon={<span className="text-xl">📚</span>}
          count={practice.length}
          label="Need practice"
          color="orange"
        />
        <SummaryCard
          icon={<Star className="w-5 h-5 text-amber-500" />}
          count={movedToKnown.length}
          label="Moved to Known"
          color="amber"
        />
      </div>

      {results.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 divide-y divide-gray-50 mb-5 max-h-60 overflow-y-auto">
          {results.map((r, i) => (
            <div key={i} className="flex items-center justify-between px-4 py-3">
              <div>
                <span className="font-semibold text-sm text-gray-900">{r.word}</span>
                <span className="text-gray-400 text-sm ml-2">{r.translation}</span>
              </div>
              <div className="flex items-center gap-1.5">
                {r.movedToKnown && (
                  <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">
                    Known!
                  </span>
                )}
                {r.newStreak > 0 && !r.movedToKnown && (
                  <span className="text-xs text-brand-600 font-medium">
                    🔥 {r.newStreak}/5
                  </span>
                )}
                {r.response === 'comfortable'
                  ? <CheckCircle className="w-4 h-4 text-emerald-500" />
                  : <RotateCcw className="w-4 h-4 text-orange-400" />
                }
              </div>
            </div>
          ))}
        </div>
      )}

      <Button fullWidth size="lg" onClick={onDone}>
        Done
      </Button>
    </div>
  )
}

// ─── Stat card ────────────────────────────────────────────────────────────────

function SummaryCard({
  icon, count, label, color,
}: {
  icon: ReactNode
  count: number
  label: string
  color: 'emerald' | 'orange' | 'amber'
}) {
  const bg: Record<string, string> = {
    emerald: 'bg-emerald-50',
    orange:  'bg-orange-50',
    amber:   'bg-amber-50',
  }
  return (
    <div className={`${bg[color]} rounded-2xl p-3 text-center`}>
      <div className="flex justify-center mb-1">{icon}</div>
      <p className="text-2xl font-bold text-gray-900 leading-none">{count}</p>
      <p className="text-[10px] text-gray-500 mt-0.5 leading-tight">{label}</p>
    </div>
  )
}
