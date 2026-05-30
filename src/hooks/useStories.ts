import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { getTodayStr, getYesterdayStr, getISOWeek, getIsraelWeekNumber, isConsecutiveWeek } from '@/lib/utils'
import type { Story, UserProfile } from '@/lib/types'

// ─── Keys ─────────────────────────────────────────────────────────────────────

export const storyKeys = {
  list: (uid: string, lang?: string) => ['stories', uid, lang ?? ''] as const,
  detail: (id: string) => ['story', id] as const,
}

// ─── Queries ──────────────────────────────────────────────────────────────────

export function useStories(userId: string | undefined, language: string) {
  return useQuery({
    queryKey: storyKeys.list(userId ?? '', language),
    enabled: !!userId && !!language,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('stories')
        .select('*')
        .eq('user_id', userId!)
        .eq('language', language)
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as Story[]
    },
  })
}

export function useStory(storyId: string | undefined) {
  return useQuery({
    queryKey: storyKeys.detail(storyId ?? ''),
    enabled: !!storyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('stories')
        .select('*')
        .eq('id', storyId!)
        .single()
      if (error) throw error
      return data as Story
    },
  })
}

// ─── Create story ─────────────────────────────────────────────────────────────

export interface CreateStoryInput {
  user_id: string
  title: string
  content: string
  translation: string
  language: string
  level: string
  length: string
  interests_used: string[]
  words_used_from_bank: string[]
}

export function useCreateStory() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: CreateStoryInput) => {
      const { data, error } = await supabase
        .from('stories')
        .insert(input)
        .select()
        .single()
      if (error) throw error
      return data as Story
    },
    onSuccess: (story) => {
      qc.invalidateQueries({ queryKey: ['stories', story.user_id, story.language] })
    },
  })
}

// ─── Complete story ────────────────────────────────────────────────────────────

export interface CompleteStoryInput {
  storyId: string
  profile: UserProfile
}

export interface CompletionResult {
  updatedProfile: Partial<UserProfile>
  streakGained: boolean
  goalMet: boolean
}

export function useCompleteStory() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ storyId, profile }: CompleteStoryInput): Promise<CompletionResult> => {
      // 1. Mark story completed
      const { error: storyErr } = await supabase
        .from('stories')
        .update({ completed: true, completed_at: new Date().toISOString() })
        .eq('id', storyId)
      if (storyErr) throw storyErr

      const today = getTodayStr()
      const isNewDay = profile.last_story_date !== today
      const newReadToday = isNewDay ? 1 : profile.stories_read_today + 1

      const profileUpdates: Partial<UserProfile> = { last_story_date: today, stories_read_today: newReadToday }
      let streakGained = false
      let goalMet = false

      if (profile.goal_period === 'day') {
        // ── Daily streak ────────────────────────────────────────────────────────
        const yesterday   = getYesterdayStr()
        const currentWeek = getISOWeek()
        const isNewWeek   = (profile.last_story_week ?? 0) !== currentWeek

        const wasYesterday = profile.last_story_date === yesterday
        const newStreak    = isNewDay ? (wasYesterday ? profile.streak_count + 1 : 1) : profile.streak_count
        const newReadWeek  = isNewWeek ? 1 : profile.stories_read_this_week + 1

        streakGained = isNewDay
        goalMet      = newReadToday >= profile.goal_stories

        Object.assign(profileUpdates, {
          last_story_week:        currentWeek,
          streak_count:           newStreak,
          stories_read_this_week: newReadWeek,
        })

      } else {
        // ── Weekly streak (Israel timezone, weeks start Monday midnight IL) ────
        const israelWeek   = getIsraelWeekNumber()
        const isNewWeek    = (profile.last_story_week ?? 0) !== israelWeek
        const prevWeekCount = isNewWeek ? 0 : profile.stories_read_this_week
        const newReadWeek  = prevWeekCount + 1

        // Streak increments exactly when the goal threshold is crossed this week
        const justMetGoal = newReadWeek >= profile.goal_stories && prevWeekCount < profile.goal_stories
        let newStreak = profile.streak_count
        if (justMetGoal) {
          const consecutive = isConsecutiveWeek(profile.last_story_week, israelWeek)
          newStreak    = consecutive ? profile.streak_count + 1 : 1
          streakGained = true
        }

        goalMet = newReadWeek >= profile.goal_stories

        Object.assign(profileUpdates, {
          last_story_week:        israelWeek,
          streak_count:           newStreak,
          stories_read_this_week: newReadWeek,
        })
      }

      // 2. Persist profile updates
      const { error: profErr } = await supabase
        .from('user_profiles')
        .update(profileUpdates)
        .eq('id', profile.id)
      if (profErr) throw profErr

      return { updatedProfile: profileUpdates, streakGained, goalMet }
    },
    onSuccess: (_result, variables) => {
      qc.invalidateQueries({ queryKey: ['story', variables.storyId] })
      qc.invalidateQueries({ queryKey: ['stories', variables.profile.id] })
      qc.invalidateQueries({ queryKey: ['word-stats', variables.profile.id] })
    },
  })
}
