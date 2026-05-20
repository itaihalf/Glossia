import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { getTodayStr, getYesterdayStr, getISOWeek } from '@/lib/utils'
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

      // 2. Calculate streak
      const today = getTodayStr()
      const yesterday = getYesterdayStr()
      const currentWeek = getISOWeek()

      const isNewDay = profile.last_story_date !== today
      const wasYesterday = profile.last_story_date === yesterday
      const isNewWeek = (profile.last_story_week ?? 0) !== currentWeek

      const newStreak = isNewDay
        ? (wasYesterday ? profile.streak_count + 1 : 1)
        : profile.streak_count

      const newReadToday = isNewDay ? 1 : profile.stories_read_today + 1
      const newReadWeek  = isNewWeek ? 1 : profile.stories_read_this_week + 1

      const profileUpdates: Partial<UserProfile> = {
        last_story_date: today,
        last_story_week: currentWeek,
        streak_count: newStreak,
        stories_read_today: newReadToday,
        stories_read_this_week: newReadWeek,
      }

      // 3. Update profile
      const { error: profErr } = await supabase
        .from('user_profiles')
        .update(profileUpdates)
        .eq('id', profile.id)
      if (profErr) throw profErr

      // Whether goal was hit after this read
      const progress = profile.goal_period === 'day' ? newReadToday : newReadWeek
      const goalMet  = progress >= profile.goal_stories

      return {
        updatedProfile: profileUpdates,
        streakGained: isNewDay,
        goalMet,
      }
    },
    onSuccess: (_result, variables) => {
      qc.invalidateQueries({ queryKey: ['story', variables.storyId] })
      qc.invalidateQueries({ queryKey: ['stories', variables.profile.id] })
      qc.invalidateQueries({ queryKey: ['word-stats', variables.profile.id] })
    },
  })
}
