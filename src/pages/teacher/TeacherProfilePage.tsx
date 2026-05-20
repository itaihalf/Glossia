import { useState, useCallback } from 'react'
import { LogOut, Plus, X, Check } from 'lucide-react'
import { CommunitySection } from '@/components/social/CommunitySection'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Card } from '@/components/ui/Card'
import { Modal } from '@/components/ui/Modal'
import { cn } from '@/lib/utils'
import { getLanguageFlag, getLanguageName } from '@/lib/utils'
import { SUPPORTED_LANGUAGES, AVATAR_EMOJIS } from '@/lib/constants'

// ─── Form shape ───────────────────────────────────────────────────────────────

interface TeacherProfileForm {
  nickname: string
  avatar_emoji: string
  teaching_languages: string[]
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function TeacherProfilePage() {
  const { profile, signOut, refreshProfile } = useAuth()

  const [form, setForm] = useState<TeacherProfileForm>(() => ({
    nickname: profile?.nickname ?? '',
    avatar_emoji: profile?.avatar_emoji ?? '😊',
    teaching_languages: profile?.teaching_languages ?? [],
  }))

  const [expandAvatar, setExpandAvatar] = useState(false)
  const [langModalOpen, setLangModalOpen] = useState(false)

  // Save state
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [savedAt, setSavedAt] = useState<number | null>(null)

  const patch = (partial: Partial<TeacherProfileForm>) =>
    setForm(f => ({ ...f, ...partial }))

  // ── Teaching languages ──────────────────────────────────────────────────────

  const addLanguage = useCallback((code: string) => {
    if (!form.teaching_languages.includes(code)) {
      patch({ teaching_languages: [...form.teaching_languages, code] })
    }
    setLangModalOpen(false)
  }, [form.teaching_languages])

  const removeLanguage = useCallback((code: string) => {
    patch({ teaching_languages: form.teaching_languages.filter(c => c !== code) })
  }, [form.teaching_languages])

  // Languages not yet in the teaching list
  const availableToAdd = SUPPORTED_LANGUAGES.filter(
    l => !form.teaching_languages.includes(l.code),
  )

  // ── Save ────────────────────────────────────────────────────────────────────

  const handleSave = async () => {
    if (!profile) return

    if (form.nickname.trim().length < 2) {
      setSaveError('Nickname must be at least 2 characters.')
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
          teaching_languages: form.teaching_languages,
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

  return (
    <div className="px-4 pt-10 pb-6 space-y-5">
      <h1 className="text-2xl font-bold text-gray-900">Profile</h1>

      {/* ── Identity ─────────────────────────────────────────────────────────── */}
      <Card>
        <div className="flex items-center gap-4 mb-4">
          <button
            onClick={() => setExpandAvatar(v => !v)}
            className="relative w-16 h-16 rounded-2xl bg-gradient-to-br from-brand-100 to-brand-200 flex items-center justify-center text-3xl hover:scale-105 transition-transform"
          >
            {form.avatar_emoji}
            <span className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-brand-500 flex items-center justify-center text-[10px] text-white">
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

        {expandAvatar && (
          <div className="grid grid-cols-8 gap-2 pt-3 border-t border-gray-100">
            {AVATAR_EMOJIS.map(emoji => (
              <button
                key={emoji}
                onClick={() => { patch({ avatar_emoji: emoji }); setExpandAvatar(false) }}
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

      {/* ── Teaching Languages ────────────────────────────────────────────────── */}
      <Card>
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-medium text-gray-500">Teaching Languages</p>
          <Button
            variant="secondary"
            size="sm"
            leftIcon={<Plus className="w-3.5 h-3.5" />}
            onClick={() => setLangModalOpen(true)}
            disabled={availableToAdd.length === 0}
          >
            Add
          </Button>
        </div>

        {form.teaching_languages.length === 0 ? (
          <div className="text-center py-6">
            <p className="text-3xl mb-2">🌍</p>
            <p className="text-sm text-gray-500 mb-3">No teaching languages yet</p>
            <Button
              variant="primary"
              size="sm"
              leftIcon={<Plus className="w-3.5 h-3.5" />}
              onClick={() => setLangModalOpen(true)}
            >
              Add a language
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            {form.teaching_languages.map(code => (
              <div
                key={code}
                className="flex items-center justify-between p-3 rounded-xl bg-gray-50 border border-gray-100"
              >
                <span className="flex items-center gap-2.5 font-medium text-sm text-gray-800">
                  <span className="text-xl">{getLanguageFlag(code)}</span>
                  {getLanguageName(code)}
                </span>
                <button
                  onClick={() => removeLanguage(code)}
                  className="p-1 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                  title={`Remove ${getLanguageName(code)}`}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* ── Account info (read-only) ──────────────────────────────────────────── */}
      <Card>
        <p className="text-xs font-medium text-gray-500 mb-2">Account</p>
        <p className="text-sm text-gray-700">{profile.email}</p>
        <p className="text-xs text-gray-400 mt-1">Teacher account</p>
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

      {/* ── Add Language Modal ────────────────────────────────────────────────── */}
      <Modal
        open={langModalOpen}
        onClose={() => setLangModalOpen(false)}
        title="Add a teaching language"
      >
        {availableToAdd.length === 0 ? (
          <p className="text-sm text-gray-500 py-4 text-center">
            You are already teaching all available languages!
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {availableToAdd.map(lang => (
              <button
                key={lang.code}
                onClick={() => addLanguage(lang.code)}
                className="flex items-center gap-2.5 p-3 rounded-xl border border-gray-200 hover:border-brand-400 hover:bg-brand-50 text-left transition-all duration-100"
              >
                <span className="text-2xl">{lang.flag}</span>
                <div>
                  <p className="font-semibold text-xs text-gray-900">{lang.name}</p>
                  <p className="text-[10px] text-gray-400">{lang.nativeName}</p>
                </div>
              </button>
            ))}
          </div>
        )}
      </Modal>
    </div>
  )
}
