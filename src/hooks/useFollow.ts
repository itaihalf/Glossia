import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { PublicProfile } from '@/lib/types'

// ─── Query keys ───────────────────────────────────────────────────────────────

export const followKeys = {
  following: (uid: string) => ['following', uid] as const,
  search:    (q: string)   => ['user-search', q] as const,
}

// ─── Who am I following? ──────────────────────────────────────────────────────

export function useFollowing(profileId: string | undefined) {
  return useQuery({
    queryKey: followKeys.following(profileId ?? ''),
    enabled: !!profileId,
    staleTime: 60_000,
    queryFn: async () => {
      // Step 1 — get follow edges
      const { data: edges, error: edgesErr } = await supabase
        .from('follows')
        .select('followed_user_id')
        .eq('follower_user_id', profileId!)
      if (edgesErr) throw edgesErr

      const ids = (edges ?? []).map(e => e.followed_user_id as string)
      if (ids.length === 0) return [] as PublicProfile[]

      // Step 2 — load those profiles (only public fields)
      const { data: profiles, error: profErr } = await supabase
        .from('user_profiles')
        .select('id, nickname, email, avatar_emoji, account_type, current_learning_language, teaching_languages, streak_count, stories_completed_total')
        .in('id', ids)
      if (profErr) throw profErr

      return (profiles ?? []) as PublicProfile[]
    },
  })
}

// ─── Search ───────────────────────────────────────────────────────────────────

export function useSearchUsers(rawQuery: string, myProfileId: string | undefined) {
  const trimmed = rawQuery.trim()
  return useQuery({
    queryKey: followKeys.search(trimmed),
    enabled: trimmed.length >= 2 && !!myProfileId,
    staleTime: 30_000,
    queryFn: async () => {
      // Strip SQL LIKE wildcards to prevent injection / unintended patterns
      const safe = trimmed.replace(/[%_]/g, '')
      const { data, error } = await supabase
        .from('user_profiles')
        .select('id, nickname, email, avatar_emoji, account_type, current_learning_language, teaching_languages, streak_count, stories_completed_total')
        .or(`nickname.ilike.%${safe}%,email.ilike.%${safe}%`)
        .neq('id', myProfileId!)   // exclude self
        .limit(15)
      if (error) throw error
      return (data ?? []) as PublicProfile[]
    },
  })
}

// ─── Follow ───────────────────────────────────────────────────────────────────

interface FollowInput { followerId: string; followedId: string }

export function useFollow() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ followerId, followedId }: FollowInput) => {
      const { error } = await supabase
        .from('follows')
        .insert({ follower_user_id: followerId, followed_user_id: followedId })
      // 23505 = unique_violation: already following — treat as success
      if (error && error.code !== '23505') throw error
    },
    onSuccess: (_data, vars) =>
      qc.invalidateQueries({ queryKey: followKeys.following(vars.followerId) }),
  })
}

// ─── Unfollow ─────────────────────────────────────────────────────────────────

export function useUnfollow() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ followerId, followedId }: FollowInput) => {
      const { error } = await supabase
        .from('follows')
        .delete()
        .eq('follower_user_id', followerId)
        .eq('followed_user_id', followedId)
      if (error) throw error
    },
    onSuccess: (_data, vars) =>
      qc.invalidateQueries({ queryKey: followKeys.following(vars.followerId) }),
  })
}
