import { useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft, GraduationCap, BookOpen } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { cn } from '@/lib/utils'
import {
  SUPPORTED_LANGUAGES,
  LANGUAGE_LEVELS,
  INTERESTS,
  AVATAR_EMOJIS,
} from '@/lib/constants'
import type { AccountType, GoalPeriod } from '@/lib/types'

// ─── Form state ──────────────────────────────────────────────────────────────

interface OnboardingForm {
  nickname: string
  avatar_emoji: string
  account_type: AccountType | null
  learning_language: string
  level: string
  interests: string[]
  goal_stories: number
  goal_period: GoalPeriod
  teaching_languages: string[]
}

const INIT: OnboardingForm = {
  nickname: '',
  avatar_emoji: '😊',
  account_type: null,
  learning_language: '',
  level: '',
  interests: [],
  goal_stories: 1,
  goal_period: 'week',
  teaching_languages: [],
}

function getTotalSteps(t: AccountType | null) {
  if (t === 'teacher') return 3
  return 6 // student or unknown
}

// ─── Step meta ───────────────────────────────────────────────────────────────

function stepTitle(step: number, accountType: AccountType | null) {
  const titles: Record<number, string | ((t: AccountType | null) => string)> = {
    0: 'Choose your look',
    1: 'How will you use LinguaStory?',
    2: (t) => t === 'teacher' ? 'Which languages do you teach?' : 'Which language are you learning?',
    3: "What's your current level?",
    4: 'What are your interests?',
    5: 'Set a reading goal',
  }
  const t = titles[step]
  return typeof t === 'function' ? t(accountType) : (t ?? '')
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function OnboardingPage() {
  const navigate = useNavigate()
  const { user, refreshProfile } = useAuth()

  const [step, setStep] = useState(0)
  const [form, setForm] = useState<OnboardingForm>(INIT)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const totalSteps = getTotalSteps(form.account_type)
  const isLastStep = step === totalSteps - 1

  const patch = (partial: Partial<OnboardingForm>) =>
    setForm(f => ({ ...f, ...partial }))

  const canProceed = (): boolean => {
    switch (step) {
      case 0: return form.nickname.trim().length >= 2
      case 1: return form.account_type !== null
      case 2:
        if (form.account_type === 'teacher') return form.teaching_languages.length > 0
        return form.learning_language !== ''
      case 3: return form.level !== ''
      case 4: return form.interests.length > 0
      case 5: return true
      default: return false
    }
  }

  const handleBack = () => setStep(s => Math.max(0, s - 1))

  const handleNext = async () => {
    if (isLastStep) {
      await save()
    } else {
      setStep(s => s + 1)
    }
  }

  const save = async () => {
    if (!user) return
    setLoading(true)
    setError(null)

    try {
      const isStudent = form.account_type === 'student'
      const isTeacher = form.account_type === 'teacher'

      const payload = {
        auth_user_id: user.id,
        nickname: form.nickname.trim(),
        email: user.email ?? '',
        account_type: form.account_type!,
        avatar_emoji: form.avatar_emoji,
        current_learning_language: isStudent ? form.learning_language : null,
        language_levels:
          isStudent && form.learning_language && form.level
            ? { [form.learning_language]: form.level }
            : {},
        interests: isStudent ? form.interests : [],
        teaching_languages: isTeacher ? form.teaching_languages : [],
        onboarding_complete: true,
        goal_stories: form.goal_stories,
        goal_period: form.goal_period,
      }

      const { error: dbErr } = await supabase
        .from('user_profiles')
        .upsert(payload, { onConflict: 'auth_user_id' })

      if (dbErr) throw dbErr

      await refreshProfile()
      navigate(isTeacher ? '/teacher/dashboard' : '/student/dashboard', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save profile. Please try again.')
      setLoading(false)
    }
  }

  const progress = Math.round(((step + 1) / totalSteps) * 100)

  return (
    <div className="min-h-dvh flex flex-col bg-slate-50">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-slate-50 px-5 pt-12 pb-4">
        <div className="flex items-center gap-3 mb-4">
          {step > 0 && (
            <button
              onClick={handleBack}
              className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
          )}
          <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-brand-500 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
          <span className="text-xs text-gray-400 tabular-nums shrink-0">
            {step + 1}/{totalSteps}
          </span>
        </div>
        <h1 className="text-xl font-bold text-gray-900">{stepTitle(step, form.account_type)}</h1>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-5 pb-6">
        {step === 0 && <StepAvatar form={form} patch={patch} />}
        {step === 1 && <StepAccountType form={form} patch={patch} />}
        {step === 2 && form.account_type === 'teacher' && <StepTeachingLanguages form={form} patch={patch} />}
        {step === 2 && form.account_type !== 'teacher' && <StepLanguage form={form} patch={patch} />}
        {step === 3 && <StepLevel form={form} patch={patch} />}
        {step === 4 && <StepInterests form={form} patch={patch} />}
        {step === 5 && <StepGoal form={form} patch={patch} />}

        {error && (
          <div className="mt-4 rounded-xl bg-red-50 border border-red-100 px-4 py-3 text-sm text-red-600">
            {error}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="sticky bottom-0 bg-slate-50 border-t border-gray-100 px-5 py-4">
        <Button
          fullWidth
          size="lg"
          onClick={handleNext}
          loading={loading}
          disabled={!canProceed()}
        >
          {isLastStep ? 'Get started →' : 'Continue'}
        </Button>
      </div>
    </div>
  )
}

// ─── Step: Avatar + Nickname ──────────────────────────────────────────────────

interface StepProps {
  form: OnboardingForm
  patch: (p: Partial<OnboardingForm>) => void
}

function StepAvatar({ form, patch }: StepProps) {
  return (
    <div className="space-y-6 pt-2">
      <div>
        <p className="text-sm font-medium text-gray-700 mb-3">Pick an avatar</p>
        <div className="grid grid-cols-8 gap-2">
          {AVATAR_EMOJIS.map(emoji => (
            <button
              key={emoji}
              onClick={() => patch({ avatar_emoji: emoji })}
              className={cn(
                'text-2xl w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-100',
                form.avatar_emoji === emoji
                  ? 'bg-brand-100 ring-2 ring-brand-500 scale-110'
                  : 'bg-white hover:bg-gray-50',
              )}
            >
              {emoji}
            </button>
          ))}
        </div>
      </div>

      <Input
        label="Nickname"
        value={form.nickname}
        onChange={e => patch({ nickname: e.target.value })}
        placeholder="What should we call you?"
        autoFocus
        maxLength={30}
        hint="At least 2 characters"
      />
    </div>
  )
}

// ─── Step: Account Type ───────────────────────────────────────────────────────

function StepAccountType({ form, patch }: StepProps) {
  const options: { value: AccountType; icon: ReactNode; label: string; desc: string }[] = [
    {
      value: 'student',
      icon: <BookOpen className="w-6 h-6" />,
      label: 'I am a student',
      desc: 'I want to read stories and build my vocabulary',
    },
    {
      value: 'teacher',
      icon: <GraduationCap className="w-6 h-6" />,
      label: 'I am a teacher',
      desc: 'I want to create classes and assign stories to students',
    },
  ]

  return (
    <div className="space-y-3 pt-2">
      {options.map(opt => (
        <button
          key={opt.value}
          onClick={() => patch({ account_type: opt.value })}
          className={cn(
            'w-full flex items-start gap-4 p-4 rounded-2xl border-2 text-left transition-all duration-150',
            form.account_type === opt.value
              ? 'border-brand-500 bg-brand-50'
              : 'border-gray-200 bg-white hover:border-gray-300',
          )}
        >
          <span className={cn(
            'w-10 h-10 rounded-xl flex items-center justify-center shrink-0',
            form.account_type === opt.value ? 'bg-brand-500 text-white' : 'bg-gray-100 text-gray-500',
          )}>
            {opt.icon}
          </span>
          <div>
            <p className="font-semibold text-gray-900">{opt.label}</p>
            <p className="text-sm text-gray-500 mt-0.5">{opt.desc}</p>
          </div>
        </button>
      ))}
    </div>
  )
}

// ─── Step: Learning Language ──────────────────────────────────────────────────

function StepLanguage({ form, patch }: StepProps) {
  return (
    <div className="pt-2">
      <div className="grid grid-cols-2 gap-2.5">
        {SUPPORTED_LANGUAGES.map(lang => (
          <button
            key={lang.code}
            onClick={() => patch({ learning_language: lang.code })}
            className={cn(
              'flex items-center gap-3 p-3.5 rounded-2xl border-2 text-left transition-all duration-100',
              form.learning_language === lang.code
                ? 'border-brand-500 bg-brand-50'
                : 'border-gray-200 bg-white hover:border-gray-300',
            )}
          >
            <span className="text-2xl">{lang.flag}</span>
            <div>
              <p className="font-semibold text-sm text-gray-900">{lang.name}</p>
              <p className="text-xs text-gray-400">{lang.nativeName}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}

// ─── Step: Teaching Languages (multi-select) ──────────────────────────────────

function StepTeachingLanguages({ form, patch }: StepProps) {
  const toggle = (code: string) => {
    const current = form.teaching_languages
    patch({
      teaching_languages: current.includes(code)
        ? current.filter(c => c !== code)
        : [...current, code],
    })
  }

  return (
    <div className="pt-2">
      <p className="text-sm text-gray-500 mb-3">Select all languages you teach.</p>
      <div className="grid grid-cols-2 gap-2.5">
        {SUPPORTED_LANGUAGES.map(lang => {
          const selected = form.teaching_languages.includes(lang.code)
          return (
            <button
              key={lang.code}
              onClick={() => toggle(lang.code)}
              className={cn(
                'flex items-center gap-3 p-3.5 rounded-2xl border-2 text-left transition-all duration-100',
                selected ? 'border-brand-500 bg-brand-50' : 'border-gray-200 bg-white hover:border-gray-300',
              )}
            >
              <span className="text-2xl">{lang.flag}</span>
              <div>
                <p className="font-semibold text-sm text-gray-900">{lang.name}</p>
                <p className="text-xs text-gray-400">{lang.nativeName}</p>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ─── Step: Level ─────────────────────────────────────────────────────────────

function StepLevel({ form, patch }: StepProps) {
  return (
    <div className="space-y-2.5 pt-2">
      {LANGUAGE_LEVELS.map(lvl => (
        <button
          key={lvl.value}
          onClick={() => patch({ level: lvl.value })}
          className={cn(
            'w-full flex items-center justify-between p-4 rounded-2xl border-2 text-left transition-all duration-100',
            form.level === lvl.value
              ? 'border-brand-500 bg-brand-50'
              : 'border-gray-200 bg-white hover:border-gray-300',
          )}
        >
          <div>
            <p className="font-semibold text-gray-900">{lvl.label}</p>
            <p className="text-sm text-gray-500">{lvl.description}</p>
          </div>
          {form.level === lvl.value && (
            <span className="w-5 h-5 rounded-full bg-brand-500 flex items-center justify-center shrink-0">
              <svg className="w-3 h-3 text-white" viewBox="0 0 12 12" fill="none">
                <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
          )}
        </button>
      ))}
    </div>
  )
}

// ─── Step: Interests ─────────────────────────────────────────────────────────

function StepInterests({ form, patch }: StepProps) {
  const toggle = (value: string) => {
    const current = form.interests
    patch({
      interests: current.includes(value)
        ? current.filter(v => v !== value)
        : [...current, value],
    })
  }

  return (
    <div className="pt-2">
      <p className="text-sm text-gray-500 mb-3">Stories will be personalised around your interests.</p>
      <div className="flex flex-wrap gap-2">
        {INTERESTS.map(interest => {
          const active = form.interests.includes(interest.value)
          return (
            <button
              key={interest.value}
              onClick={() => toggle(interest.value)}
              className={cn(
                'inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full border-2 text-sm font-medium transition-all duration-100',
                active
                  ? 'border-brand-500 bg-brand-500 text-white'
                  : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300',
              )}
            >
              <span>{interest.emoji}</span>
              {interest.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ─── Step: Reading Goal ───────────────────────────────────────────────────────

function StepGoal({ form, patch }: StepProps) {
  const counts = [1, 2, 3, 4, 5, 6, 7]

  return (
    <div className="space-y-6 pt-2">
      <div>
        <p className="text-sm font-medium text-gray-700 mb-3">Number of stories</p>
        <div className="flex gap-2 flex-wrap">
          {counts.map(n => (
            <button
              key={n}
              onClick={() => patch({ goal_stories: n })}
              className={cn(
                'w-11 h-11 rounded-xl border-2 font-semibold text-sm transition-all duration-100',
                form.goal_stories === n
                  ? 'border-brand-500 bg-brand-500 text-white'
                  : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300',
              )}
            >
              {n}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="text-sm font-medium text-gray-700 mb-3">Period</p>
        <div className="flex gap-2">
          {(['day', 'week'] as GoalPeriod[]).map(period => (
            <button
              key={period}
              onClick={() => patch({ goal_period: period })}
              className={cn(
                'flex-1 py-3 rounded-xl border-2 font-semibold text-sm capitalize transition-all duration-100',
                form.goal_period === period
                  ? 'border-brand-500 bg-brand-500 text-white'
                  : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300',
              )}
            >
              Per {period}
            </button>
          ))}
        </div>
      </div>

      <p className="text-sm text-gray-400 text-center">
        Your goal: <span className="font-semibold text-gray-700">
          {form.goal_stories} {form.goal_stories === 1 ? 'story' : 'stories'} per {form.goal_period}
        </span>
      </p>
    </div>
  )
}
