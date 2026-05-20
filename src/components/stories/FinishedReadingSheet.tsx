import { type ReactNode } from 'react'
import { Flame, BookOpen, Star } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import type { CompletionResult } from '@/hooks/useStories'
import type { UserProfile } from '@/lib/types'

interface FinishedReadingSheetProps {
  open: boolean
  result: CompletionResult | null
  profile: UserProfile
  onReview: () => void
  onSkip: () => void
}

export function FinishedReadingSheet({
  open,
  result,
  profile,
  onReview,
  onSkip,
}: FinishedReadingSheetProps) {
  if (!result) return null

  const { streakGained, goalMet, updatedProfile } = result
  const newStreak = updatedProfile.streak_count ?? profile.streak_count
  const period = profile.goal_period
  const progress = period === 'day'
    ? (updatedProfile.stories_read_today ?? profile.stories_read_today)
    : (updatedProfile.stories_read_this_week ?? profile.stories_read_this_week)
  const goal = profile.goal_stories

  return (
    <Modal open={open} onClose={onSkip}>
      <div className="text-center pb-2">
        {/* Hero emoji */}
        <div className="text-5xl mb-3">🎉</div>
        <h2 className="text-xl font-bold text-gray-900 mb-1">Story complete!</h2>
        <p className="text-sm text-gray-500 mb-6">Great reading session.</p>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <StatCard
            icon={<Flame className="w-5 h-5 text-orange-400" />}
            value={newStreak}
            label={`day${newStreak !== 1 ? 's' : ''} streak`}
            highlight={streakGained}
          />
          <StatCard
            icon={<BookOpen className="w-5 h-5 text-brand-500" />}
            value={`${progress}/${goal}`}
            label={`this ${period}`}
            highlight={goalMet}
          />
          <StatCard
            icon={<Star className="w-5 h-5 text-amber-400" />}
            value={goalMet ? '🏆' : '📖'}
            label={goalMet ? 'Goal met!' : 'Keep going'}
            highlight={goalMet}
          />
        </div>

        {/* Review prompt */}
        <div className="bg-brand-50 rounded-2xl p-4 mb-5 text-left">
          <p className="font-semibold text-brand-900 text-sm mb-1">
            Quick vocabulary review?
          </p>
          <p className="text-xs text-brand-700">
            Review the words from your bank that appeared in this story.
          </p>
        </div>

        <div className="space-y-2.5">
          <Button fullWidth size="lg" onClick={onReview}>
            Start Review
          </Button>
          <Button fullWidth variant="ghost" size="md" onClick={onSkip}>
            Skip for now
          </Button>
        </div>
      </div>
    </Modal>
  )
}

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({
  icon, value, label, highlight,
}: {
  icon: ReactNode
  value: string | number
  label: string
  highlight?: boolean
}) {
  return (
    <div className={`rounded-2xl p-3 text-center ${highlight ? 'bg-brand-50 border border-brand-100' : 'bg-gray-50'}`}>
      <div className="flex justify-center mb-1">{icon}</div>
      <p className="font-bold text-gray-900 text-lg leading-none">{value}</p>
      <p className="text-xs text-gray-500 mt-0.5 leading-tight">{label}</p>
    </div>
  )
}
