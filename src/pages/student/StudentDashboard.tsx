import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { Sparkles, Flame, BookOpen, Archive, Users, Clock, Trophy } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { StoriesCompletedModal } from '@/components/student/StoriesCompletedModal'
import { useStories } from '@/hooks/useStories'
import { getLanguageFlag, getLanguageName, getLevelLabel, getTodayStr, getYesterdayStr, formatDate, getIsraelWeekNumber, isConsecutiveWeek } from '@/lib/utils'
import type { Story } from '@/lib/types'

// ─── Word bank counts query ───────────────────────────────────────────────────

function useWordStats(profileId: string | undefined, language: string | null | undefined) {
  return useQuery({
    queryKey: ['word-stats', profileId, language],
    enabled: !!profileId && !!language,
    queryFn: async () => {
      const [a, b] = await Promise.all([
        supabase
          .from('word_bank')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', profileId!)
          .eq('language', language!)
          .eq('status', 'learning'),
        supabase
          .from('word_bank')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', profileId!)
          .eq('language', language!)
          .eq('status', 'known'),
      ])
      return { learning: a.count ?? 0, known: b.count ?? 0 }
    },
  })
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

export default function StudentDashboard() {
  const { profile, refreshProfile } = useAuth()
  const navigate = useNavigate()
  const { data: wordStats } = useWordStats(profile?.id, profile?.current_learning_language)
  const [completedModalOpen, setCompletedModalOpen] = useState(false)

  // Reset streak when the user has broken their reading cadence
  useEffect(() => {
    if (!profile || profile.streak_count === 0) return

    if (profile.goal_period === 'day') {
      // Daily: reset if last story was neither today nor yesterday
      if (!profile.last_story_date) return
      const today     = getTodayStr()
      const yesterday = getYesterdayStr()
      const last      = profile.last_story_date
      if (last !== today && last !== yesterday) {
        supabase
          .from('user_profiles')
          .update({ streak_count: 0 })
          .eq('id', profile.id)
          .then(({ error }) => { if (!error) refreshProfile() })
      }
    } else {
      // Weekly: reset if the previous week's goal wasn't met, or if >1 week
      // has passed since any story was read.
      // When last_story_week < current week, stories_read_this_week still
      // holds last week's count (it only resets on the next story completion).
      if (profile.last_story_week === null) return
      const israelWeek = getIsraelWeekNumber()
      const isCurrentWeek = profile.last_story_week === israelWeek
      const wasLastWeek   = isConsecutiveWeek(profile.last_story_week, israelWeek)

      if (!isCurrentWeek && !wasLastWeek) {
        // 2+ weeks since last story — streak is definitely broken
        supabase
          .from('user_profiles')
          .update({ streak_count: 0 })
          .eq('id', profile.id)
          .then(({ error }) => { if (!error) refreshProfile() })
      } else if (!isCurrentWeek && wasLastWeek) {
        // It's a new week; stories_read_this_week is last week's count
        if (profile.stories_read_this_week < profile.goal_stories) {
          supabase
            .from('user_profiles')
            .update({ streak_count: 0 })
            .eq('id', profile.id)
            .then(({ error }) => { if (!error) refreshProfile() })
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id, profile?.goal_period, profile?.last_story_date, profile?.last_story_week])

  if (!profile) return null

  const lang = profile.current_learning_language
  const level = lang ? (profile.language_levels[lang] ?? null) : null
  const langFlag = lang ? getLanguageFlag(lang) : '🌐'
  const langName = lang ? getLanguageName(lang) : 'No language set'
  const levelLabel = level ? getLevelLabel(level) : null

  const goalTarget = profile.goal_stories
  const goalPeriod = profile.goal_period
  const goalActual =
    goalPeriod === 'day' ? profile.stories_read_today : profile.stories_read_this_week
  const goalFraction = Math.min(goalActual / Math.max(goalTarget, 1), 1)

  const hour = new Date().getHours()
  const greeting =
    hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'

  return (
    <div className="px-4 pt-12 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-500">{greeting},</p>
          <h1 className="text-2xl font-bold text-gray-900">{profile.nickname} {profile.avatar_emoji}</h1>
        </div>
        <div className="flex flex-col items-end gap-1">
          <Badge variant="primary" className="text-sm">
            {langFlag} {langName}
          </Badge>
          {levelLabel && (
            <span className="text-xs text-gray-400">{levelLabel}</span>
          )}
        </div>
      </div>

      {/* Create Story CTA */}
      <Card
        padding="lg"
        interactive
        onClick={() => navigate('/student/stories')}
        className="bg-gradient-to-br from-brand-500 to-brand-600 border-0 text-white"
      >
        <div className="flex items-center justify-between">
          <div>
            <p className="text-brand-100 text-sm font-medium mb-1">Ready to learn?</p>
            <h2 className="text-xl font-bold mb-3">Create a Story</h2>
            <p className="text-brand-100 text-sm">
              A personalised story based on your level and interests
            </p>
          </div>
          <div className="w-14 h-14 rounded-2xl bg-white/20 flex items-center justify-center shrink-0">
            <Sparkles className="w-7 h-7 text-white" />
          </div>
        </div>
      </Card>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3">
        <Card padding="sm" className="text-center">
          <div className="flex flex-col items-center gap-1">
            <Flame className="w-5 h-5 text-orange-400" />
            <p className="text-xl font-bold text-gray-900">{profile.streak_count}</p>
            <p className="text-xs text-gray-500">
              {goalPeriod === 'week' ? 'week streak' : 'day streak'}
            </p>
          </div>
        </Card>

        <Card padding="sm" className="text-center">
          <div className="flex flex-col items-center gap-1">
            <BookOpen className="w-5 h-5 text-brand-500" />
            <p className="text-xl font-bold text-gray-900">
              {goalActual}/{goalTarget}
            </p>
            <p className="text-xs text-gray-500">this {goalPeriod}</p>
          </div>
        </Card>

        <Card padding="sm" className="text-center">
          <div className="flex flex-col items-center gap-1">
            <Archive className="w-5 h-5 text-emerald-500" />
            <p className="text-xl font-bold text-gray-900">
              {wordStats?.learning ?? 0}
            </p>
            <p className="text-xs text-gray-500">learning</p>
          </div>
        </Card>
      </div>

      {/* Lifetime stories completed */}
      <Card interactive onClick={() => setCompletedModalOpen(true)}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center">
              <Trophy className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <p className="font-semibold text-gray-800 text-sm">Stories Completed</p>
              <p className="text-xs text-gray-400">Tap for language breakdown</p>
            </div>
          </div>
          <p className="text-2xl font-bold text-gray-900">{profile.stories_completed_total}</p>
        </div>
      </Card>

      <StoriesCompletedModal
        open={completedModalOpen}
        onClose={() => setCompletedModalOpen(false)}
        byLanguage={profile.stories_completed_by_language ?? {}}
        total={profile.stories_completed_total}
      />

      {/* Goal progress */}
      <Card>
        <div className="flex items-center justify-between mb-3">
          <p className="font-semibold text-gray-800 text-sm">Reading goal</p>
          <span className="text-xs text-gray-500">
            {goalActual} / {goalTarget} per {goalPeriod}
          </span>
        </div>
        <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-brand-500 rounded-full transition-all duration-500"
            style={{ width: `${goalFraction * 100}%` }}
          />
        </div>
        {goalFraction >= 1 && (
          <p className="mt-2 text-xs text-emerald-600 font-medium">🎉 Goal reached!</p>
        )}
      </Card>

      {/* Word bank summary */}
      <Card interactive onClick={() => navigate('/student/words')}>
        <div className="flex items-center justify-between">
          <div>
            <p className="font-semibold text-gray-800 mb-1">My Word Bank</p>
            <div className="flex gap-4 text-sm">
              <span className="text-brand-600 font-medium">
                {wordStats?.learning ?? 0} learning
              </span>
              <span className="text-emerald-600 font-medium">
                {wordStats?.known ?? 0} known
              </span>
            </div>
          </div>
          <Archive className="w-5 h-5 text-gray-300" />
        </div>
      </Card>

      {/* Unfinished Stories */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-gray-800">Unfinished Stories</h2>
          <button
            onClick={() => navigate('/student/stories')}
            className="text-sm text-brand-600 font-medium"
          >
            See all
          </button>
        </div>
        <UnfinishedStories profileId={profile.id} language={lang} />
      </div>

      {/* Classes shortcut */}
      <Card interactive onClick={() => navigate('/student/classes')}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center">
            <Users className="w-5 h-5 text-purple-600" />
          </div>
          <div>
            <p className="font-semibold text-gray-800 text-sm">My Classes</p>
            <p className="text-xs text-gray-400">View your enrolled classes</p>
          </div>
        </div>
      </Card>

      {/* Bottom spacing */}
      <div className="h-2" />
    </div>
  )
}

// ─── Unfinished stories ───────────────────────────────────────────────────────

function UnfinishedStories({ profileId, language }: { profileId: string; language: string | null }) {
  const navigate = useNavigate()
  const { data: stories = [], isLoading } = useStories(profileId, language ?? '')
  const unfinished = stories.filter((s: Story) => !s.completed).slice(0, 3)

  if (isLoading) {
    return (
      <div className="flex justify-center py-6">
        <LoadingSpinner />
      </div>
    )
  }

  if (unfinished.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-dashed border-gray-200 px-6 py-8 text-center">
        <p className="text-3xl mb-2">📖</p>
        <p className="font-semibold text-gray-700 mb-1">No unfinished stories</p>
        <p className="text-sm text-gray-400">
          Tap &ldquo;Create a Story&rdquo; above to start a new one.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-2.5">
      {unfinished.map((story: Story) => (
        <Card
          key={story.id}
          interactive
          padding="md"
          onClick={() => navigate(`/student/stories/${story.id}`)}
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-brand-100 flex items-center justify-center shrink-0">
              <BookOpen className="w-5 h-5 text-brand-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-gray-900 text-sm leading-tight truncate">
                {story.title}
              </p>
              <div className="flex items-center gap-1 text-xs text-gray-400 mt-0.5">
                <Clock className="w-3 h-3" />
                {getLevelLabel(story.level)} · {formatDate(story.created_at)}
              </div>
            </div>
          </div>
        </Card>
      ))}
    </div>
  )
}

