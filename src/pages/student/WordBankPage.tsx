import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import {
  useWordBankItems,
  useUpdateWordStatus,
  useDeleteWord,
} from '@/hooks/useWordBank'
import { WordCard } from '@/components/wordbank/WordCard'
import { AddWordSheet } from '@/components/wordbank/AddWordSheet'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils'
import { getLanguageFlag, getLanguageName } from '@/lib/utils'
import type { WordStatus } from '@/lib/types'

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function WordBankPage() {
  const { profile } = useAuth()
  const navigate = useNavigate()

  const availableLanguages = Object.keys(profile?.language_levels ?? {})

  const [activeLang, setActiveLang] = useState<string>(
    () => profile?.current_learning_language ?? availableLanguages[0] ?? '',
  )
  const [activeTab, setActiveTab] = useState<WordStatus>('learning')
  const [addSheetOpen, setAddSheetOpen] = useState(false)
  const [mutatingId, setMutatingId] = useState<string | null>(null)

  const { mutateAsync: updateStatus } = useUpdateWordStatus()
  const { mutateAsync: deleteWord } = useDeleteWord()

  const { data: learningWords = [], isLoading: isLoadingLearning } = useWordBankItems(
    profile?.id, activeLang, 'learning',
  )
  const { data: knownWords = [], isLoading: isLoadingKnown } = useWordBankItems(
    profile?.id, activeLang, 'known',
  )

  if (!profile) return null

  // ── No language configured ────────────────────────────────────────────────

  if (!activeLang) {
    return (
      <div className="px-4 pt-10 text-center">
        <h1 className="text-2xl font-bold text-gray-900 mb-8">Word Bank</h1>
        <div className="bg-white rounded-2xl border border-dashed border-gray-200 p-10">
          <p className="text-4xl mb-3">🌍</p>
          <p className="font-semibold text-gray-700 mb-2">No learning language set</p>
          <p className="text-sm text-gray-400 mb-5">
            Set your learning language in Profile to start building your word bank.
          </p>
          <Button size="sm" onClick={() => navigate('/student/profile')}>
            Go to Profile
          </Button>
        </div>
      </div>
    )
  }

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleStatusChange = async (id: string, newStatus: WordStatus) => {
    setMutatingId(id)
    try {
      await updateStatus({
        id,
        userId: profile.id,
        language: activeLang,
        status: newStatus,
        // Set 100 confidence when manually marking as known; preserve when reverting
        confidence: newStatus === 'known' ? 100 : undefined,
      })
    } finally {
      setMutatingId(null)
    }
  }

  const handleDelete = async (id: string) => {
    setMutatingId(id)
    try {
      await deleteWord({ id, userId: profile.id, language: activeLang })
    } finally {
      setMutatingId(null)
    }
  }

  const handleLangSwitch = (code: string) => {
    setActiveLang(code)
    setActiveTab('learning')
  }

  // ── Derived values ────────────────────────────────────────────────────────

  const activeWords = activeTab === 'learning' ? learningWords : knownWords
  const isLoading = activeTab === 'learning' ? isLoadingLearning : isLoadingKnown

  return (
    <div className="px-4 pt-10 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Word Bank</h1>
        <button
          onClick={() => setAddSheetOpen(true)}
          className="w-9 h-9 rounded-xl bg-brand-500 text-white flex items-center justify-center hover:bg-brand-600 active:scale-95 transition-all shadow-sm shadow-brand-500/30"
          title="Add a word"
        >
          <Plus className="w-5 h-5" />
        </button>
      </div>

      {/* Language switcher (only shown if multiple languages) */}
      {availableLanguages.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
          {availableLanguages.map(code => (
            <button
              key={code}
              onClick={() => handleLangSwitch(code)}
              className={cn(
                'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-all duration-100 shrink-0',
                activeLang === code
                  ? 'bg-brand-500 text-white shadow-sm'
                  : 'bg-white border border-gray-200 text-gray-600 hover:border-gray-300',
              )}
            >
              <span>{getLanguageFlag(code)}</span>
              {getLanguageName(code)}
            </button>
          ))}
        </div>
      )}

      {/* Single language label (when only one language) */}
      {availableLanguages.length === 1 && (
        <p className="text-sm text-gray-500">
          {getLanguageFlag(activeLang)} {getLanguageName(activeLang)}
        </p>
      )}

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl">
        {(['learning', 'known'] as WordStatus[]).map(tab => {
          const count = tab === 'learning' ? learningWords.length : knownWords.length
          return (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                'flex-1 py-2 rounded-lg text-sm font-semibold transition-all duration-150 capitalize',
                activeTab === tab
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700',
              )}
            >
              {tab === 'learning' ? 'Learning' : 'Known'}{' '}
              <span className={cn(
                'text-xs rounded-full px-1.5 py-0.5 ml-0.5',
                activeTab === tab ? 'bg-brand-100 text-brand-700' : 'bg-gray-200 text-gray-500',
              )}>
                {count}
              </span>
            </button>
          )
        })}
      </div>

      {/* Word list */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <LoadingSpinner size="lg" />
        </div>
      ) : activeWords.length === 0 ? (
        <EmptyState
          tab={activeTab}
          onAdd={() => setAddSheetOpen(true)}
        />
      ) : (
        <div className="space-y-2.5 pb-4">
          {activeWords.map(entry => (
            <WordCard
              key={entry.id}
              entry={entry}
              onStatusChange={handleStatusChange}
              onDelete={handleDelete}
              mutating={mutatingId === entry.id}
            />
          ))}
        </div>
      )}

      {/* Add Word Sheet */}
      <AddWordSheet
        open={addSheetOpen}
        onClose={() => setAddSheetOpen(false)}
        language={activeLang}
        userId={profile.id}
      />
    </div>
  )
}

// ─── Empty states ─────────────────────────────────────────────────────────────

function EmptyState({ tab, onAdd }: { tab: WordStatus; onAdd: () => void }) {
  if (tab === 'learning') {
    return (
      <div className="bg-white rounded-2xl border border-dashed border-gray-200 p-10 text-center">
        <p className="text-4xl mb-3">📚</p>
        <p className="font-semibold text-gray-700 mb-2">No words yet</p>
        <p className="text-sm text-gray-400 mb-5">
          Tap + to add your first word. The AI will find its dictionary form automatically.
        </p>
        <Button size="sm" leftIcon={<Plus className="w-4 h-4" />} onClick={onAdd}>
          Add a word
        </Button>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-2xl border border-dashed border-gray-200 p-10 text-center">
      <p className="text-4xl mb-3">🎓</p>
      <p className="font-semibold text-gray-700 mb-2">No known words yet</p>
      <p className="text-sm text-gray-400">
        Words from your learning list will move here as your confidence grows through reviews.
      </p>
    </div>
  )
}
