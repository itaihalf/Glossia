import { useState, useEffect, type ReactNode } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, CheckCircle, RotateCcw, Star } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useStory } from '@/hooks/useStories'
import { useReviewWord, type ReviewWordResult } from '@/hooks/useWordBank'
import { supabase } from '@/lib/supabase'
import { FlashCard } from '@/components/review/FlashCard'
import { Button } from '@/components/ui/Button'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import type { WordBankEntry } from '@/lib/types'

// ─── Result tracking ──────────────────────────────────────────────────────────

interface CardResult {
  word: string
  translation: string
  response: 'comfortable' | 'practice'
  movedToKnown: boolean
  newStreak: number
}

// ─── Phase ────────────────────────────────────────────────────────────────────

type Phase = 'loading' | 'empty' | 'reviewing' | 'summary'

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ReviewPage() {
  const { storyId } = useParams<{ storyId: string }>()
  const navigate    = useNavigate()
  const { profile } = useAuth()

  const { data: story } = useStory(storyId)

  // Fetch the specific word-bank entries used in this story (learning status only)
  const wordIds: string[] = (story?.words_used_from_bank ?? []) as string[]

  const { data: wordEntries, isLoading: isLoadingWords } = useQuery({
    queryKey: ['review-words', storyId],
    enabled: !!story && wordIds.length > 0 && !!profile,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('word_bank')
        .select('*')
        .in('id', wordIds)
        .eq('user_id', profile!.id)
        .eq('status', 'learning')
      if (error) throw error
      return (data ?? []) as WordBankEntry[]
    },
  })

  const { mutateAsync: reviewWord, isPending: isReviewing } = useReviewWord()

  // ── Review state ────────────────────────────────────────────────────────────

  const [phase, setPhase]           = useState<Phase>('loading')
  const [cards, setCards]           = useState<WordBankEntry[]>([])
  const [cardIndex, setCardIndex]   = useState(0)
  const [results, setResults]       = useState<CardResult[]>([])

  useEffect(() => {
    if (isLoadingWords) return

    if (!story) { setPhase('loading'); return }

    // If the story has no words from the bank, or none are still 'learning'
    if (wordIds.length === 0 || (wordEntries ?? []).length === 0) {
      setPhase('empty')
      return
    }

    setCards(wordEntries ?? [])
    setPhase('reviewing')
  }, [isLoadingWords, wordEntries, story, wordIds.length])

  // ── Handle card response ────────────────────────────────────────────────────

  const handleRespond = async (response: 'comfortable' | 'practice') => {
    const entry = cards[cardIndex]
    if (!entry || !profile) return

    let reviewResult: ReviewWordResult = { newStreak: entry.streak_count, movedToKnown: false }

    try {
      reviewResult = await reviewWord({ entry, response, userId: profile.id })
    } catch {
      // Silently continue — don't block the review session on a DB error
    }

    const result: CardResult = {
      word:         entry.word,
      translation:  entry.translation,
      response,
      movedToKnown: reviewResult.movedToKnown,
      newStreak:    reviewResult.newStreak,
    }

    const updatedResults = [...results, result]
    setResults(updatedResults)

    if (cardIndex + 1 >= cards.length) {
      setPhase('summary')
    } else {
      setCardIndex(i => i + 1)
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  const backToStories = () => navigate('/student/stories')
  const backToStory   = () => navigate(`/student/stories/${storyId}`)

  return (
    <div className="min-h-dvh flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 pt-12 pb-4">
        <button
          onClick={backToStories}
          className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="font-bold text-gray-900">Vocabulary Review</h1>
          {story && (
            <p className="text-xs text-gray-400 truncate max-w-[200px]">{story.title}</p>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col items-center justify-center px-5 pb-nav">

        {/* Loading */}
        {(phase === 'loading' || isLoadingWords) && (
          <LoadingSpinner size="lg" />
        )}

        {/* Empty: no learning words from this story */}
        {phase === 'empty' && (
          <div className="text-center max-w-xs">
            <p className="text-4xl mb-3">🎓</p>
            <p className="font-semibold text-gray-800 mb-2">Nothing to review</p>
            <p className="text-sm text-gray-500 mb-6">
              None of the words from this story are in your Learning list — they may already be Known or not yet added.
            </p>
            <div className="flex flex-col gap-2">
              <Button onClick={backToStory} variant="secondary">Back to story</Button>
              <Button onClick={backToStories} variant="ghost">My stories</Button>
            </div>
          </div>
        )}

        {/* Reviewing */}
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

        {/* Summary */}
        {phase === 'summary' && (
          <ReviewSummary
            results={results}
            onDone={backToStories}
            onReread={backToStory}
          />
        )}
      </div>
    </div>
  )
}

// ─── Review summary ───────────────────────────────────────────────────────────

function ReviewSummary({
  results,
  onDone,
  onReread,
}: {
  results: CardResult[]
  onDone: () => void
  onReread: () => void
}) {
  const comfortable  = results.filter(r => r.response === 'comfortable')
  const practice     = results.filter(r => r.response === 'practice')
  const movedToKnown = results.filter(r => r.movedToKnown)

  return (
    <div className="w-full max-w-sm">
      {/* Header */}
      <div className="text-center mb-6">
        <p className="text-5xl mb-3">✨</p>
        <h2 className="text-xl font-bold text-gray-900 mb-1">Review complete!</h2>
        <p className="text-sm text-gray-500">You reviewed {results.length} word{results.length !== 1 ? 's' : ''}.</p>
      </div>

      {/* Stats */}
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

      {/* Word list */}
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
                {r.response === 'comfortable'
                  ? <CheckCircle className="w-4 h-4 text-emerald-500" />
                  : <RotateCcw className="w-4 h-4 text-orange-400" />
                }
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-col gap-2">
        <Button fullWidth size="lg" onClick={onDone}>
          Done
        </Button>
        <Button fullWidth variant="ghost" size="md" onClick={onReread}>
          Re-read the story
        </Button>
      </div>
    </div>
  )
}

// ─── Summary stat card ────────────────────────────────────────────────────────

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
