import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { getTodayStr, getYesterdayStr, getISOWeek } from '@/lib/utils'
import type { Class, VocabularyList, VocabWord, Assignment, UserProfile } from '@/lib/types'

// ─── Key helpers ─────────────────────────────────────────────────────────────

export const classKeys = {
  teacher:        (tid: string)  => ['teacher-classes', tid] as const,
  detail:         (cid: string)  => ['class', cid] as const,
  members:        (cid: string)  => ['class-members', cid] as const,
  vocab:          (cid: string)  => ['class-vocab', cid] as const,
  classStories:   (cid: string)  => ['class-stories', cid] as const,
  assignments:    (cid: string)  => ['class-assignments', cid] as const,
  studentClasses: (sid: string)  => ['student-classes', sid] as const,
  pendingInvites: (sid: string)  => ['pending-invites', sid] as const,
  teacherAll:     (tid: string)  => ['teacher-assignments-all', tid] as const,
  studentAll:     (sid: string)  => ['student-assignments-all', sid] as const,
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface MemberWithProfile {
  id: string
  student_user_id: string
  status: string
  created_at: string
  accepted_at: string | null
  profile: { id: string; nickname: string; avatar_emoji: string; email: string } | undefined
}

export interface ClassWithCount extends Class {
  member_count: number
}

export interface StudentClass {
  id: string
  name: string
  language: string
  level: string
  teacher_user_id: string
  created_at: string
  membershipId: string
  teacher: { id: string; nickname: string; avatar_emoji: string } | undefined
}

export interface PendingInvite {
  membershipId: string
  classId: string
  className: string
  language: string
  level: string
  teacherNickname: string
  teacherAvatar: string
  invitedAt: string
}

export interface AssignmentWithClass extends Assignment {
  className?: string
}

// ─── Teacher: class CRUD ──────────────────────────────────────────────────────

export function useTeacherClasses(teacherId: string | undefined) {
  return useQuery({
    queryKey: classKeys.teacher(teacherId ?? ''),
    enabled: !!teacherId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('classes')
        .select('id, name, language, level, teacher_user_id, created_at, updated_at')
        .eq('teacher_user_id', teacherId!)
        .order('created_at', { ascending: false })
      if (error) throw error

      // Fetch accepted member counts
      const ids = (data ?? []).map(c => c.id as string)
      if (ids.length === 0) return [] as ClassWithCount[]

      const { data: memberRows } = await supabase
        .from('class_members')
        .select('class_id')
        .in('class_id', ids)
        .eq('status', 'accepted')

      const countMap = new Map<string, number>()
      ;(memberRows ?? []).forEach(r => {
        const k = r.class_id as string
        countMap.set(k, (countMap.get(k) ?? 0) + 1)
      })

      return (data ?? []).map(c => ({ ...c, member_count: countMap.get(c.id as string) ?? 0 })) as ClassWithCount[]
    },
  })
}

export function useClassDetail(classId: string | undefined) {
  return useQuery({
    queryKey: classKeys.detail(classId ?? ''),
    enabled: !!classId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('classes')
        .select('*')
        .eq('id', classId!)
        .single()
      if (error) throw error
      return data as Class
    },
  })
}

export function useCreateClass() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { teacher_user_id: string; name: string; language: string; level: string }) => {
      const { data, error } = await supabase
        .from('classes')
        .insert(input)
        .select()
        .single()
      if (error) throw error
      return data as Class
    },
    onSuccess: (_data, vars) =>
      qc.invalidateQueries({ queryKey: classKeys.teacher(vars.teacher_user_id) }),
  })
}

export function useDeleteClass() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ classId }: { classId: string; teacherId: string }) => {
      const { error } = await supabase.from('classes').delete().eq('id', classId)
      if (error) throw error
    },
    onSuccess: (_data, vars) =>
      qc.invalidateQueries({ queryKey: classKeys.teacher(vars.teacherId) }),
  })
}

// ─── Class members ────────────────────────────────────────────────────────────

export function useClassMembers(classId: string | undefined) {
  return useQuery({
    queryKey: classKeys.members(classId ?? ''),
    enabled: !!classId,
    queryFn: async () => {
      const { data: rows, error } = await supabase
        .from('class_members')
        .select('id, student_user_id, status, created_at, accepted_at')
        .eq('class_id', classId!)
        .order('created_at', { ascending: true })
      if (error) throw error

      const ids = (rows ?? []).map(r => r.student_user_id as string)
      if (ids.length === 0) return { accepted: [] as MemberWithProfile[], pending: [] as MemberWithProfile[] }

      const { data: profiles } = await supabase
        .from('user_profiles')
        .select('id, nickname, avatar_emoji, email')
        .in('id', ids)

      const pmap = new Map((profiles ?? []).map(p => [p.id as string, p as { id: string; nickname: string; avatar_emoji: string; email: string }]))

      const enrich = (m: typeof rows[number]): MemberWithProfile => ({
        id: m.id as string,
        student_user_id: m.student_user_id as string,
        status: m.status as string,
        created_at: m.created_at as string,
        accepted_at: m.accepted_at as string | null,
        profile: pmap.get(m.student_user_id as string),
      })

      return {
        accepted: (rows ?? []).filter(r => r.status === 'accepted').map(enrich),
        pending:  (rows ?? []).filter(r => r.status === 'pending').map(enrich),
      }
    },
  })
}

export function useInviteStudent() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { class_id: string; student_user_id: string; invited_by_teacher_id: string }) => {
      const { error } = await supabase.from('class_members').insert({
        class_id: input.class_id,
        student_user_id: input.student_user_id,
        invited_by_teacher_id: input.invited_by_teacher_id,
        status: 'pending',
      })
      if (error && error.code !== '23505') throw error
    },
    onSuccess: (_data, vars) =>
      qc.invalidateQueries({ queryKey: classKeys.members(vars.class_id) }),
  })
}

export function useRemoveMember() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ membershipId }: { membershipId: string; classId: string }) => {
      const { error } = await supabase.from('class_members').delete().eq('id', membershipId)
      if (error) throw error
    },
    onSuccess: (_data, vars) =>
      qc.invalidateQueries({ queryKey: classKeys.members(vars.classId) }),
  })
}

// ─── Student: class membership ────────────────────────────────────────────────

export function useStudentClasses(studentId: string | undefined) {
  return useQuery({
    queryKey: classKeys.studentClasses(studentId ?? ''),
    enabled: !!studentId,
    queryFn: async () => {
      const { data: memberships, error: memErr } = await supabase
        .from('class_members')
        .select('id, class_id, accepted_at')
        .eq('student_user_id', studentId!)
        .eq('status', 'accepted')
      if (memErr) throw memErr

      const cids = (memberships ?? []).map(m => m.class_id as string)
      if (cids.length === 0) return [] as StudentClass[]

      const { data: classes, error: cErr } = await supabase
        .from('classes')
        .select('id, name, language, level, teacher_user_id, created_at')
        .in('id', cids)
      if (cErr) throw cErr

      const tids = [...new Set((classes ?? []).map(c => c.teacher_user_id as string))]
      const { data: teachers } = await supabase
        .from('user_profiles')
        .select('id, nickname, avatar_emoji')
        .in('id', tids)

      const tmap = new Map((teachers ?? []).map(t => [t.id as string, t as { id: string; nickname: string; avatar_emoji: string }]))
      const mmap = new Map((memberships ?? []).map(m => [m.class_id as string, m.id as string]))

      return (classes ?? []).map(c => ({
        ...c,
        teacher: tmap.get(c.teacher_user_id as string),
        membershipId: mmap.get(c.id as string) ?? '',
      })) as StudentClass[]
    },
  })
}

export function usePendingInvites(studentId: string | undefined) {
  return useQuery({
    queryKey: classKeys.pendingInvites(studentId ?? ''),
    enabled: !!studentId,
    queryFn: async () => {
      const { data: memberships, error } = await supabase
        .from('class_members')
        .select('id, class_id, created_at')
        .eq('student_user_id', studentId!)
        .eq('status', 'pending')
      if (error) throw error

      const cids = (memberships ?? []).map(m => m.class_id as string)
      if (cids.length === 0) return [] as PendingInvite[]

      const { data: classes } = await supabase
        .from('classes')
        .select('id, name, language, level, teacher_user_id')
        .in('id', cids)

      const tids = [...new Set((classes ?? []).map(c => c.teacher_user_id as string))]
      const { data: teachers } = await supabase
        .from('user_profiles')
        .select('id, nickname, avatar_emoji')
        .in('id', tids)

      const tmap = new Map((teachers ?? []).map(t => [t.id as string, t as { id: string; nickname: string; avatar_emoji: string }]))
      const cmap = new Map((classes ?? []).map(c => [c.id as string, c as { id: string; name: string; language: string; level: string; teacher_user_id: string }]))

      return (memberships ?? []).map(m => {
        const cls = cmap.get(m.class_id as string)
        const teacher = cls ? tmap.get(cls.teacher_user_id) : undefined
        return {
          membershipId: m.id as string,
          classId:       m.class_id as string,
          className:     cls?.name ?? '',
          language:      cls?.language ?? '',
          level:         cls?.level ?? '',
          teacherNickname: teacher?.nickname ?? 'Unknown teacher',
          teacherAvatar:   teacher?.avatar_emoji ?? '😊',
          invitedAt:     m.created_at as string,
        } as PendingInvite
      })
    },
  })
}

export function useRespondToInvite() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ membershipId, status }: { membershipId: string; status: 'accepted' | 'rejected'; studentId: string }) => {
      const updates: Record<string, unknown> = { status }
      if (status === 'accepted') updates.accepted_at = new Date().toISOString()
      const { error } = await supabase.from('class_members').update(updates).eq('id', membershipId)
      if (error) throw error
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: classKeys.pendingInvites(vars.studentId) })
      qc.invalidateQueries({ queryKey: classKeys.studentClasses(vars.studentId) })
    },
  })
}

export function useLeaveClass() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ membershipId: id }: { membershipId: string; studentId: string }) => {
      const { error } = await supabase.from('class_members').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: (_data, vars) =>
      qc.invalidateQueries({ queryKey: classKeys.studentClasses(vars.studentId) }),
  })
}

// ─── Vocabulary lists ─────────────────────────────────────────────────────────

export function useClassVocabLists(classId: string | undefined) {
  return useQuery({
    queryKey: classKeys.vocab(classId ?? ''),
    enabled: !!classId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('vocabulary_lists')
        .select('*')
        .eq('class_id', classId!)
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as VocabularyList[]
    },
  })
}

export function useCreateVocabList() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { class_id: string; teacher_user_id: string; title: string; language: string; words: VocabWord[] }) => {
      const { data, error } = await supabase
        .from('vocabulary_lists')
        .insert(input)
        .select()
        .single()
      if (error) throw error
      return data as VocabularyList
    },
    onSuccess: (_data, vars) =>
      qc.invalidateQueries({ queryKey: classKeys.vocab(vars.class_id) }),
  })
}

export function useImportVocabToWordBank() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ vocabList, profileId }: { vocabList: VocabularyList; profileId: string }) => {
      const words = vocabList.words as VocabWord[]
      const rows = words.map(w => ({
        user_id:          profileId,
        language:         vocabList.language,
        word:             w.base_form || w.word,
        base_form:        w.base_form || w.word,
        translation:      w.translation,
        example_sentence: w.example_sentence ?? null,
        status:           'learning',
        confidence:       0,
        times_reviewed:   0,
        successful_reviews: 0,
        encountered_forms: [] as string[],
      }))

      const { data, error } = await supabase
        .from('word_bank')
        .upsert(rows, { onConflict: 'user_id,language,base_form', ignoreDuplicates: true })
        .select('id')
      if (error) throw error

      return { added: (data ?? []).length, total: rows.length }
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['word-bank', vars.profileId] })
      qc.invalidateQueries({ queryKey: ['word-stats', vars.profileId] })
    },
  })
}

// ─── Class stories ────────────────────────────────────────────────────────────

export function useClassStories(classId: string | undefined) {
  return useQuery({
    queryKey: classKeys.classStories(classId ?? ''),
    enabled: !!classId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('stories')
        .select('id, title, level, length, language, created_at, teacher_user_id, user_id')
        .eq('class_id', classId!)
        .order('created_at', { ascending: false })
      if (error) throw error
      return data ?? []
    },
  })
}

export function useCreateClassStory() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: {
      user_id: string; class_id: string; teacher_user_id: string;
      title: string; content: string; translation: string;
      language: string; level: string; length: string;
      interests_used: string[]; words_used_from_bank: string[]
    }) => {
      const { data, error } = await supabase
        .from('stories')
        .insert(input)
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: classKeys.classStories(vars.class_id) })
    },
  })
}

// ─── Assignments ──────────────────────────────────────────────────────────────

export function useClassAssignments(classId: string | undefined) {
  return useQuery({
    queryKey: classKeys.assignments(classId ?? ''),
    enabled: !!classId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('assignments')
        .select('*')
        .eq('class_id', classId!)
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as Assignment[]
    },
  })
}

export function useTeacherAssignments(teacherId: string | undefined) {
  return useQuery({
    queryKey: classKeys.teacherAll(teacherId ?? ''),
    enabled: !!teacherId,
    queryFn: async () => {
      // Get all teacher's classes
      const { data: classes } = await supabase
        .from('classes')
        .select('id, name')
        .eq('teacher_user_id', teacherId!)

      const cids = (classes ?? []).map(c => c.id as string)
      if (cids.length === 0) return [] as AssignmentWithClass[]

      const { data: assignments, error } = await supabase
        .from('assignments')
        .select('*')
        .in('class_id', cids)
        .order('created_at', { ascending: false })
      if (error) throw error

      const cmap = new Map((classes ?? []).map(c => [c.id as string, c.name as string]))
      return (assignments ?? []).map(a => ({
        ...a,
        className: cmap.get(a.class_id as string),
      })) as AssignmentWithClass[]
    },
  })
}

export function useStudentAssignments(studentId: string | undefined, classIds: string[]) {
  return useQuery({
    queryKey: classKeys.studentAll(studentId ?? ''),
    enabled: !!studentId && classIds.length > 0,
    queryFn: async () => {
      const { data: assignments, error } = await supabase
        .from('assignments')
        .select('*')
        .in('class_id', classIds)
        .order('due_date', { ascending: true, nullsFirst: false })
      if (error) throw error

      // Get completions for this student
      const aids = (assignments ?? []).map(a => a.id as string)
      if (aids.length === 0) return []

      const { data: completions } = await supabase
        .from('assignment_completions')
        .select('assignment_id, completed')
        .eq('student_user_id', studentId!)
        .in('assignment_id', aids)

      const cmap = new Map((completions ?? []).map(c => [c.assignment_id as string, c.completed as boolean]))

      return (assignments ?? []).map(a => ({
        ...a,
        studentCompleted: cmap.get(a.id as string) ?? false,
      }))
    },
  })
}

export function useCreateAssignment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { class_id: string; teacher_user_id: string; type: string; target_id: string | null; title: string; due_date: string | null }) => {
      const { data, error } = await supabase
        .from('assignments')
        .insert(input)
        .select()
        .single()
      if (error) throw error
      return data as Assignment
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: classKeys.assignments(vars.class_id) })
      qc.invalidateQueries({ queryKey: classKeys.teacherAll(vars.teacher_user_id) })
    },
  })
}

export function useMarkAssignmentComplete() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ assignmentId, studentId }: { assignmentId: string; studentId: string }) => {
      const { error } = await supabase
        .from('assignment_completions')
        .upsert({ assignment_id: assignmentId, student_user_id: studentId, completed: true, completed_at: new Date().toISOString() },
          { onConflict: 'assignment_id,student_user_id' })
      if (error) throw error
    },
    onSuccess: (_data, vars) =>
      qc.invalidateQueries({ queryKey: classKeys.studentAll(vars.studentId) }),
  })
}

// ─── Reading stats update (for class stories — no story ownership change) ─────

export function useUpdateReadingStats() {
  return useMutation({
    mutationFn: async ({ profile }: { profile: UserProfile }) => {
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
        last_story_date: today, last_story_week: currentWeek,
        streak_count: newStreak,
        stories_read_today: newReadToday,
        stories_read_this_week: newReadWeek,
      }

      const { error } = await supabase
        .from('user_profiles')
        .update(profileUpdates)
        .eq('id', profile.id)
      if (error) throw error

      const progress = profile.goal_period === 'day' ? newReadToday : newReadWeek
      return {
        updatedProfile: profileUpdates,
        streakGained: isNewDay,
        goalMet: progress >= profile.goal_stories,
      }
    },
  })
}
