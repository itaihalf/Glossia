import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Sparkles } from 'lucide-react'
import { generateStory } from '@/lib/ai'
import { useCreateStory } from '@/hooks/useStories'
import { supabase } from '@/lib/supabase'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { cn } from '@/lib/utils'
import { getLanguageName, getLevelLabel } from '@/lib/utils'
import { STORY_LENGTHS } from '@/lib/constants'
import type { UserProfile, StoryLength } from '@/lib/types'

// ─── Props ────────────────────────────────────────────────────────────────────

interface CreateStorySheetProps {
  open: boolean
  onClose: () => void
  profile: UserProfile
}

// ─── State machine ────────────────────────────────────────────────────────────

type Phase =
  | { t: 'config' }
  | { t: 'generating' }
  | { t: 'error'; message: string }

// ─── Component ────────────────────────────────────────────────────────────────

export function CreateStorySheet({ open, onClose, profile }: CreateStorySheetProps) {
  const navigate = useNavigate()
  const [phase, setPhase] = useState<Phase>({ t: 'config' })
  const [length, setLength] = useState<StoryLength>('short')
  const [topicHint, setTopicHint] = useState('')

  const { mutateAsync: createStory } = useCreateStory()

  const lang = profile.current_learning_language ?? ''
  const level = lang ? (profile.language_levels[lang] ?? 'beginner') : 'beginner'

  const handleClose = () => {
    setPhase({ t: 'config' })
    setTopicHint('')
    onClose()
  }

  const handleGenerate = async () => {
    if (!lang) return
    setPhase({ t: 'generating' })

    try {
      // Fetch the lowest-confidence learning words (those that most need practice).
      // generateStory shuffles and picks a length-scaled subset from this pool.
      const { data: words } = await supabase
        .from('word_bank')
        .select('id, word, translation')
        .eq('user_id', profile.id)
        .eq('language', lang)
        .eq('status', 'learning')
        .order('confidence', { ascending: true })
        .limit(25)

      const wordBankWords = (words ?? []) as Array<{ id: string; word: string; translation: string }>

      // Pass the full interest list — generateStory owns the randomization.
      const generated = await generateStory({
        languageCode: lang,
        level,
        interests: profile.interests,
        wordBankWords,
        length,
        topicHint: topicHint.trim() || undefined,
      })

      // Save to database
      const story = await createStory({
        user_id: profile.id,
        title: generated.title,
        content: generated.content,
        translation: generated.translation,
        language: lang,
        level,
        length,
        interests_used: generated.interestUsed ? [generated.interestUsed] : [],
        words_used_from_bank: generated.usedWordIds,
      })

      handleClose()
      navigate(`/student/stories/${story.id}`)
    } catch (err) {
      setPhase({
        t: 'error',
        message: err instanceof Error ? err.message : 'Could not generate story. Please try again.',
      })
    }
  }

  return (
    <Modal open={open} onClose={handleClose} title="Create a Story">
      {/* Language + level context */}
      <p className="text-sm text-gray-500 mb-5">
        {getLanguageName(lang)} · {getLevelLabel(level)}
      </p>

      {/* ── CONFIG phase ────────────────────────────────────────────────────── */}
      {phase.t === 'config' && (
        <div className="space-y-5">
          {/* Length */}
          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">Story length</p>
            <div className="grid grid-cols-2 gap-2">
              {STORY_LENGTHS.map(sl => (
                <button
                  key={sl.value}
                  onClick={() => setLength(sl.value as StoryLength)}
                  className={cn(
                    'flex flex-col items-start p-3 rounded-xl border-2 text-left transition-all duration-100',
                    length === sl.value
                      ? 'border-brand-500 bg-brand-50'
                      : 'border-gray-200 bg-white hover:border-gray-300',
                  )}
                >
                  <span className="font-semibold text-sm text-gray-900">{sl.label}</span>
                  <span className="text-xs text-gray-400">{sl.description}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Topic hint */}
          <Input
            label="Story idea (optional)"
            value={topicHint}
            onChange={e => setTopicHint(e.target.value)}
            placeholder="e.g. A hiker who gets lost in the mountains…"
            maxLength={200}
          />

          <Button
            fullWidth
            size="lg"
            leftIcon={<Sparkles className="w-4 h-4" />}
            onClick={handleGenerate}
            disabled={!lang}
          >
            Generate Story
          </Button>

          {!lang && (
            <p className="text-xs text-center text-amber-600">
              Set a learning language in your Profile first.
            </p>
          )}
        </div>
      )}

      {/* ── GENERATING phase ─────────────────────────────────────────────────── */}
      {phase.t === 'generating' && (
        <div className="flex flex-col items-center gap-4 py-6">
          <div className="w-16 h-16 rounded-2xl bg-brand-50 flex items-center justify-center">
            <Sparkles className="w-8 h-8 text-brand-500 animate-pulse" />
          </div>
          <div className="text-center">
            <p className="font-semibold text-gray-800 mb-1">Writing your story…</p>
            <p className="text-sm text-gray-400">
              Crafting a {length.replace('_', ' ')} story in {getLanguageName(lang)}
            </p>
          </div>

          {/* The response streams in behind the scenes; the text is only shown
              once the story is complete (we navigate away at that point). */}
          <LoadingSpinner size="md" />
        </div>
      )}

      {/* ── ERROR phase ──────────────────────────────────────────────────────── */}
      {phase.t === 'error' && (
        <div className="space-y-4">
          <div className="bg-red-50 rounded-2xl p-4 border border-red-100">
            <p className="font-semibold text-red-800 mb-1">Could not create story</p>
            <p className="text-sm text-red-700">{phase.message}</p>
          </div>
          <Button variant="secondary" fullWidth onClick={() => setPhase({ t: 'config' })}>
            Try again
          </Button>
        </div>
      )}
    </Modal>
  )
}
