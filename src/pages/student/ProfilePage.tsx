import { useState, useCallback } from 'react'
import { ChevronRight, LogOut, Check } from 'lucide-react'
import { CommunitySection } from '@/components/social/CommunitySection'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Card } from '@/components/ui/Card'
import { Modal } from '@/components/ui/Modal'
import { cn } from '@/lib/utils'
import { getLanguageFlag, getLanguageName, getLevelLabel } from '@/lib/utils'
import {
  SUPPORTED_LANGUAGES,
  LANGUAGE_LEVELS,
  INTERESTS,
  AVATAR_EMOJIS,
} from '@/lib/constants'
import type { GoalPeriod, LanguageLevel } from '@/lib/types'

// ─── Form shape ───────────────────────────────────────────────────────────────

interface ProfileForm {
  nickname: string
  avatar_emoji: string
  learning_language: string
  language_levels: Record<string, LanguageLevel>
  interests: string[]
  goal_stories: number
  goal_period: GoalPeriod
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ProfilePage() {
  const { profile, signOut, refreshProfile } = useAuth()

  const [form, setForm] = useState<ProfileForm>(() => ({
    nickname: profile?.nickname ?? '',
    avatar_emoji: profile?.avatar_emoji ?? '😊',
    learning_language: profile?.current_learning_language ?? '',
    language_levels: (profile?.language_levels ?? {}) as Record<string, LanguageLevel>,
    interests: profile?.interests ?? [],
    goal_stories: profile?.goal_stories ?? 1,
    goal_period: profile?.goal_period ?? 'week',
  }))

  // Which section is expanded inline
  type Section = 'avatar' | 'language' | 'level'
  const [expanded, setExpanded] = useState<Section | null>(null)

  // Level modal (for switching to a new language)
  const [levelModalLang, setLevelModalLang] = useState<string | null>(null)

  // Save state
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [savedAt, setSavedAt] = useState<number | null>(null)

  const patch = (partial: Partial<ProfileForm>) => setForm(f => ({ ...f, ...partial }))

  const toggleSection = (s: Section) =>
    setExpanded(prev => (prev === s ? null : s))

  // ── Language selection ──────────────────────────────────────────────────────

  const handleLanguageSelect = useCallback((code: string) => {
    if (code === form.learning_language) {
      setExpanded(null)
      return
    }
    if (form.language_levels[code]) {
      // Already have a level for this language → just switch
      patch({ learning_language: code })
      setExpanded(null)
    } else {
      // New language → ask for level via modal
      patch({ learning_language: code })
      setExpanded(null)
      setLevelModalLang(code)
    }
  }, [form.learning_language, form.language_levels])

  const handleLevelFromModal = (lang: string, level: LanguageLevel) => {
    patch({
      language_levels: { ...form.language_levels, [lang]: level },
    })
    setLevelModalLang(null)
  }

  // ── Level selection (inline) ────────────────────────────────────────────────

  const handleLevelSelect = (level: LanguageLevel) => {
    if (!form.learning_language) return
    patch({
      language_levels: { ...form.language_levels, [form.learning_language]: level },
    })
    setExpanded(null)
  }

  // ── Interests ───────────────────────────────────────────────────────────────

  const toggleInterest = (value: string) => {
    patch({
      interests: form.interests.includes(value)
        ? form.interests.filter(v => v !== value)
        : [...form.interests, value],
    })
  }

  // ── Save ────────────────────────────────────────────────────────────────────

  const handleSave = async () => {
    if (!profile) return

    const currentLevel = form.language_levels[form.learning_language]
    if (form.learning_language && !currentLevel) {
      setSaveError('Please select a level for your current learning language.')
      return
    }

    setSaving(true)
    setSaveError(null)

    try {
      const { error } = await supabase
        .from('user_profiles')
        .update({
          nickname: form.nickname.trim(),
          avatar_emoji: form.avatar_emoji,
          current_learning_language: form.learning_language || null,
          language_levels: form.language_levels,
          interests: form.interests,
          goal_stories: form.goal_stories,
          goal_period: form.goal_period,
        })
        .eq('id', profile.id)

      if (error) throw error

      await refreshProfile()
      setSavedAt(Date.now())
      setTimeout(() => setSavedAt(null), 3000)
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Could not save profile. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  if (!profile) return null

  const currentLevel = form.language_levels[form.learning_language] ?? null

  return (
    <div className="px-4 pt-10 pb-6 space-y-5">
      <h1 className="text-2xl font-bold text-gray-900">Profile</h1>

      {/* ── Identity ─────────────────────────────────────────────────────────── */}
      <Card>
        <div className="flex items-center gap-4 mb-4">
          <button
            onClick={() => toggleSection('avatar')}
            className="relative w-16 h-16 rounded-2xl bg-gradient-to-br from-brand-100 to-brand-200 flex items-center justify-center text-3xl hover:scale-105 transition-transform"
          >
            {form.avatar_emoji}
            <span className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-brand-500 flex items-center justify-center text-[10px] text-white font-bold">
              ✏️
            </span>
          </button>
          <div className="flex-1">
            <p className="text-xs font-medium text-gray-500 mb-1">Nickname</p>
            <Input
              value={form.nickname}
              onChange={e => patch({ nickname: e.target.value })}
              placeholder="Your name"
              maxLength={30}
            />
          </div>
        </div>

        {expanded === 'avatar' && (
          <div className="grid grid-cols-8 gap-2 pt-3 border-t border-gray-100">
            {AVATAR_EMOJIS.map(emoji => (
              <button
                key={emoji}
                onClick={() => { patch({ avatar_emoji: emoji }); setExpanded(null) }}
                className={cn(
                  'text-2xl w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-100',
                  form.avatar_emoji === emoji
                    ? 'bg-brand-100 ring-2 ring-brand-500 scale-110'
                    : 'hover:bg-gray-50',
                )}
              >
                {emoji}
              </button>
            ))}
          </div>
        )}
      </Card>

      {/* ── Learning Language ─────────────────────────────────────────────────── */}
      <Card>
        <button
          className="w-full flex items-center justify-between"
          onClick={() => toggleSection('language')}
        >
          <div>
            <p className="text-xs font-medium text-gray-500 mb-1">Learning Language</p>
            {form.learning_language ? (
              <p className="font-semibold text-gray-900">
                {getLanguageFlag(form.learning_language)} {getLanguageName(form.learning_language)}
              </p>
            ) : (
              <p className="text-gray-400">Not set</p>
            )}
          </div>
          <ChevronRight
            className={cn(
              'w-4 h-4 text-gray-400 transition-transform duration-200',
              expanded === 'language' && 'rotate-90',
            )}
          />
        </button>

        {expanded === 'language' && (
          <div className="grid grid-cols-2 gap-2 pt-3 mt-3 border-t border-gray-100">
            {SUPPORTED_LANGUAGES.map(lang => (
              <button
                key={lang.code}
                onClick={() => handleLanguageSelect(lang.code)}
                className={cn(
                  'flex items-center gap-2.5 p-3 rounded-xl border-2 text-left transition-all duration-100',
                  form.learning_language === lang.code
                    ? 'border-brand-500 bg-brand-50'
                    : 'border-gray-200 bg-gray-50 hover:border-gray-300',
                )}
              >
                <span className="text-xl">{lang.flag}</span>
                <div>
                  <p className="font-semibold text-xs text-gray-900">{lang.name}</p>
                  <p className="text-[10px] text-gray-400">{lang.nativeName}</p>
                </div>
              </button>
            ))}
          </div>
        )}
      </Card>

      {/* ── Level ────────────────────────────────────────────────────────────── */}
      {form.learning_language && (
        <Card>
          <button
            className="w-full flex items-center justify-between"
            onClick={() => toggleSection('level')}
          >
            <div>
              <p className="text-xs font-medium text-gray-500 mb-1">
                Level in {getLanguageName(form.learning_language)}
              </p>
              {currentLevel ? (
                <p className="font-semibold text-gray-900">{getLevelLabel(currentLevel)}</p>
              ) : (
                <p className="text-amber-500 font-medium text-sm">Please set your level</p>
              )}
            </div>
            <ChevronRight
              className={cn(
                'w-4 h-4 text-gray-400 transition-transform duration-200',
                expanded === 'level' && 'rotate-90',
              )}
            />
          </button>

          {expanded === 'level' && (
            <div className="space-y-2 pt-3 mt-3 border-t border-gray-100">
              {LANGUAGE_LEVELS.map(lvl => {
                const active = currentLevel === lvl.value
                return (
                  <button
                    key={lvl.value}
                    onClick={() => handleLevelSelect(lvl.value as LanguageLevel)}
                    className={cn(
                      'w-full flex items-center justify-between p-3.5 rounded-xl border-2 text-left transition-all duration-100',
                      active ? 'border-brand-500 bg-brand-50' : 'border-gray-100 hover:border-gray-200',
                    )}
                  >
                    <div>
                      <p className="font-semibold text-sm text-gray-900">{lvl.label}</p>
                      <p className="text-xs text-gray-400">{lvl.description}</p>
                    </div>
                    {active && <Check className="w-4 h-4 text-brand-500 shrink-0" />}
                  </button>
                )
              })}
            </div>
          )}
        </Card>
      )}

      {/* ── Interests ────────────────────────────────────────────────────────── */}
      <Card>
        <p className="text-xs font-medium text-gray-500 mb-3">Interests</p>
        <div className="flex flex-wrap gap-2">
          {INTERESTS.map(interest => {
            const active = form.interests.includes(interest.value)
            return (
              <button
                key={interest.value}
                onClick={() => toggleInterest(interest.value)}
                className={cn(
                  'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border-2 text-xs font-medium transition-all duration-100',
                  active
                    ? 'border-brand-500 bg-brand-500 text-white'
                    : 'border-gray-200 bg-gray-50 text-gray-600 hover:border-gray-300',
                )}
              >
                <span>{interest.emoji}</span>
                {interest.label}
              </button>
            )
          })}
        </div>
      </Card>

      {/* ── Reading Goal ─────────────────────────────────────────────────────── */}
      <Card>
        <p className="text-xs font-medium text-gray-500 mb-3">Reading Goal</p>
        <div className="space-y-3">
          <div className="flex gap-2 flex-wrap">
            {[1, 2, 3, 4, 5, 6, 7].map(n => (
              <button
                key={n}
                onClick={() => patch({ goal_stories: n })}
                className={cn(
                  'w-10 h-10 rounded-xl border-2 font-semibold text-sm transition-all duration-100',
                  form.goal_stories === n
                    ? 'border-brand-500 bg-brand-500 text-white'
                    : 'border-gray-200 bg-gray-50 text-gray-700 hover:border-gray-300',
                )}
              >
                {n}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            {(['day', 'week'] as GoalPeriod[]).map(period => (
              <button
                key={period}
                onClick={() => patch({ goal_period: period })}
                className={cn(
                  'flex-1 py-2.5 rounded-xl border-2 font-semibold text-sm capitalize transition-all duration-100',
                  form.goal_period === period
                    ? 'border-brand-500 bg-brand-500 text-white'
                    : 'border-gray-200 bg-gray-50 text-gray-700 hover:border-gray-300',
                )}
              >
                Per {period}
              </button>
            ))}
          </div>
          <p className="text-xs text-gray-400">
            Goal: {form.goal_stories} {form.goal_stories === 1 ? 'story' : 'stories'} per {form.goal_period}
          </p>
        </div>
      </Card>

      {/* ── Save ─────────────────────────────────────────────────────────────── */}
      {saveError && (
        <div className="rounded-xl bg-red-50 border border-red-100 px-4 py-3 text-sm text-red-600">
          {saveError}
        </div>
      )}

      {savedAt && (
        <div className="rounded-xl bg-emerald-50 border border-emerald-100 px-4 py-3 text-sm text-emerald-700 flex items-center gap-2">
          <Check className="w-4 h-4" />
          Profile saved!
        </div>
      )}

      <Button fullWidth size="lg" onClick={handleSave} loading={saving}>
        Save changes
      </Button>

      {/* ── Community ─────────────────────────────────────────────────────────── */}
      <CommunitySection profileId={profile.id} />

      <button
        onClick={signOut}
        className="w-full flex items-center justify-center gap-2 py-3 text-sm text-gray-400 hover:text-red-500 transition-colors"
      >
        <LogOut className="w-4 h-4" />
        Sign out
      </button>

      {/* ── Level modal (for new language selection) ──────────────────────────── */}
      <Modal
        open={levelModalLang !== null}
        onClose={() => {
          // Revert to previous language if modal is dismissed without selecting
          patch({
            learning_language: profile.current_learning_language ?? '',
          })
          setLevelModalLang(null)
        }}
        title={levelModalLang ? `Your level in ${getLanguageName(levelModalLang)}` : ''}
      >
        {levelModalLang && (
          <div className="space-y-2.5">
            <p className="text-sm text-gray-500 mb-4">
              You haven&apos;t studied {getLanguageName(levelModalLang)} before in LinguaStory. What&apos;s your current level?
            </p>
            {LANGUAGE_LEVELS.map(lvl => (
              <button
                key={lvl.value}
                onClick={() => handleLevelFromModal(levelModalLang, lvl.value as LanguageLevel)}
                className="w-full flex items-start gap-3 p-3.5 rounded-xl border border-gray-200 hover:border-brand-400 hover:bg-brand-50 text-left transition-all duration-100"
              >
                <div>
                  <p className="font-semibold text-sm text-gray-900">{lvl.label}</p>
                  <p className="text-xs text-gray-400">{lvl.description}</p>
                </div>
              </button>
            ))}
          </div>
        )}
      </Modal>
    </div>
  )
}
