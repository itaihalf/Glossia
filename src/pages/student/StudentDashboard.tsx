import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { Sparkles, Flame, BookOpen, Archive, Users } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { getLanguageFlag, getLanguageName, getLevelLabel, getTodayStr, getYesterdayStr } from '@/lib/utils'

// ─── Word bank counts query ───────────────────────────────────────────────────

function useWordStats(profileId: string | undefined) {
  return useQuery({
    queryKey: ['word-stats', profileId],
    enabled: !!profileId,
    queryFn: async () => {
      const [a, b] = await Promise.all([
        supabase
          .from('word_bank')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', profileId!)
          .eq('status', 'learning'),
        supabase
          .from('word_bank')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', profileId!)
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
  const { data: wordStats } = useWordStats(profile?.id)

  // Reset streak if the user missed more than one day since last story
  useEffect(() => {
    if (!profile || profile.streak_count === 0 || !profile.last_story_date) return
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id, profile?.last_story_date])

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
              {profile.streak_count === 1 ? 'day streak' : 'day streak'}
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

      {/* Recent Stories */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-gray-800">Recent Stories</h2>
          <button
            onClick={() => navigate('/student/stories')}
            className="text-sm text-brand-600 font-medium"
          >
            See all
          </button>
        </div>
        <RecentStoriesEmpty />
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

// ─── Empty state ─────────────────────────────────────────────────────────────

function RecentStoriesEmpty() {
  return (
    <div className="bg-white rounded-2xl border border-dashed border-gray-200 px-6 py-8 text-center">
      <p className="text-3xl mb-2">📖</p>
      <p className="font-semibold text-gray-700 mb-1">No stories yet</p>
      <p className="text-sm text-gray-400">
        Tap &ldquo;Create a Story&rdquo; above to generate your first story.
      </p>
    </div>
  )
}

