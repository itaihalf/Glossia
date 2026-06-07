// ─── Domain types ─────────────────────────────────────────────────────────────

export type AccountType = 'student' | 'teacher'
export type LanguageLevel = 'complete_beginner' | 'beginner' | 'novice' | 'intermediate' | 'advanced'
export type GoalPeriod = 'day' | 'week'
export type WordStatus = 'learning' | 'known'
export type StoryLength = 'very_short' | 'short' | 'medium' | 'long'
export type MemberStatus = 'pending' | 'accepted' | 'rejected'
export type AssignmentType = 'vocabulary' | 'story'

// ─── Database row shapes ───────────────────────────────────────────────────────

export interface UserProfile {
  id: string
  auth_user_id: string
  nickname: string
  email: string
  account_type: AccountType
  avatar_emoji: string
  current_learning_language: string | null
  language_levels: Record<string, LanguageLevel>
  interests: string[]
  onboarding_complete: boolean
  goal_stories: number
  goal_period: GoalPeriod
  streak_count: number
  stories_read_today: number
  stories_read_this_week: number
  last_story_date: string | null
  last_story_week: number | null
  teaching_languages: string[]
  created_at: string
  updated_at: string
}

export interface WordBankEntry {
  id: string
  user_id: string
  language: string
  word: string
  base_form: string
  translation: string
  example_sentence: string | null
  status: WordStatus
  confidence: number
  times_reviewed: number
  successful_reviews: number
  streak_count: number
  encountered_forms: string[]
  last_reviewed_at: string | null
  created_at: string
  updated_at: string
}

export interface Story {
  id: string
  user_id: string
  class_id: string | null
  teacher_user_id: string | null
  title: string
  content: string
  translation: string | null
  language: string
  level: LanguageLevel
  length: StoryLength
  interests_used: string[]
  words_used_from_bank: string[]
  completed: boolean
  due_date: string | null
  is_open: boolean
  created_at: string
  completed_at: string | null
}

export interface Follow {
  id: string
  follower_user_id: string
  followed_user_id: string
  created_at: string
}

export interface Class {
  id: string
  teacher_user_id: string
  name: string
  language: string
  level: LanguageLevel
  created_at: string
  updated_at: string
}

export interface ClassMember {
  id: string
  class_id: string
  student_user_id: string
  status: MemberStatus
  invited_by_teacher_id: string | null
  created_at: string
  accepted_at: string | null
}

export interface VocabWord {
  word: string
  base_form: string
  translation: string
  part_of_speech?: string
  example_sentence?: string
}

export interface VocabularyList {
  id: string
  class_id: string | null
  teacher_user_id: string
  title: string
  language: string
  words: VocabWord[]
  created_at: string
}

export interface Assignment {
  id: string
  class_id: string
  teacher_user_id: string
  type: AssignmentType
  target_id: string | null
  title: string
  due_date: string | null
  created_at: string
}

export interface AssignmentCompletion {
  id: string
  assignment_id: string
  student_user_id: string
  completed: boolean
  completed_at: string | null
}

export interface PublicProfile {
  id: string
  nickname: string
  email: string
  avatar_emoji: string
  account_type: AccountType
  current_learning_language: string | null
  teaching_languages: string[]
}
