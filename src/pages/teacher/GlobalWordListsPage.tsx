import { useState } from 'react'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useGlobalVocabLists, useDeleteVocabList } from '@/hooks/useClasses'
import { CreateVocabListSheet } from '@/components/classes/CreateVocabListSheet'
import { Button } from '@/components/ui/Button'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { getLanguageFlag, getLanguageName, formatDate } from '@/lib/utils'
import { cn } from '@/lib/utils'
import type { VocabularyList, VocabWord } from '@/lib/types'

export default function GlobalWordListsPage() {
  const { profile } = useAuth()

  const teachingLangs = profile?.teaching_languages ?? []
  const [activeLang, setActiveLang] = useState<string>(teachingLangs[0] ?? '')
  const [createOpen, setCreateOpen]     = useState(false)
  const [editTarget, setEditTarget]     = useState<VocabularyList | null>(null)

  const { data: lists = [], isLoading } = useGlobalVocabLists(profile?.id, activeLang || undefined)
  const { mutateAsync: deleteList, isPending: deleting } = useDeleteVocabList()

  if (!profile) return null

  const handleDelete = async (listId: string) => {
    await deleteList({ listId, classId: null, teacherId: profile.id })
  }

  return (
    <div className="px-4 pt-10 pb-nav space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Word Lists</h1>
        <button
          onClick={() => { setEditTarget(null); setCreateOpen(true) }}
          disabled={!activeLang}
          className="w-9 h-9 rounded-xl bg-brand-500 text-white flex items-center justify-center hover:bg-brand-600 active:scale-95 transition-all shadow-sm shadow-brand-500/30 disabled:opacity-40"
        >
          <Plus className="w-5 h-5" />
        </button>
      </div>

      {/* Language selector */}
      {teachingLangs.length === 0 ? (
        <p className="text-sm text-gray-400">No teaching languages set on your profile.</p>
      ) : (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {teachingLangs.map(code => (
            <button
              key={code}
              onClick={() => setActiveLang(code)}
              className={cn(
                'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-all border',
                activeLang === code
                  ? 'bg-brand-500 text-white border-brand-500'
                  : 'bg-white text-gray-700 border-gray-200 hover:border-gray-300',
              )}
            >
              {getLanguageFlag(code)} {getLanguageName(code)}
            </button>
          ))}
        </div>
      )}

      {/* List */}
      {isLoading && <div className="flex justify-center py-12"><LoadingSpinner size="lg" /></div>}

      {!isLoading && activeLang && lists.length === 0 && (
        <div className="bg-white rounded-2xl border border-dashed border-gray-200 p-10 text-center">
          <p className="text-4xl mb-3">📚</p>
          <p className="font-semibold text-gray-700 mb-2">No global lists yet</p>
          <p className="text-sm text-gray-400 mb-5">
            Global lists are reusable across any class. Import them into a class to share with students.
          </p>
          <Button size="sm" leftIcon={<Plus className="w-4 h-4" />} onClick={() => { setEditTarget(null); setCreateOpen(true) }}>
            Create first list
          </Button>
        </div>
      )}

      {!isLoading && lists.map(list => (
        <VocabListCard
          key={list.id}
          list={list}
          onEdit={() => { setEditTarget(list); setCreateOpen(true) }}
          onDelete={() => handleDelete(list.id)}
          deleting={deleting}
        />
      ))}

      {/* Create / Edit sheet */}
      <CreateVocabListSheet
        open={createOpen}
        onClose={() => { setCreateOpen(false); setEditTarget(null) }}
        classId={null}
        teacherId={profile.id}
        language={activeLang}
        existingList={editTarget ?? undefined}
      />
    </div>
  )
}

// ─── Vocab list card ──────────────────────────────────────────────────────────

function VocabListCard({
  list, onEdit, onDelete, deleting,
}: {
  list: VocabularyList
  onEdit: () => void
  onDelete: () => void
  deleting: boolean
}) {
  const [expanded, setExpanded] = useState(false)
  const words = list.words as VocabWord[]

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
      <div className="flex items-start justify-between gap-2">
        <button className="flex-1 text-left" onClick={() => setExpanded(e => !e)}>
          <p className="font-semibold text-gray-900">{list.title}</p>
          <p className="text-xs text-gray-400 mt-0.5">
            {words.length} word{words.length !== 1 ? 's' : ''} · {formatDate(list.created_at)}
          </p>
        </button>
        <div className="flex gap-1 shrink-0">
          <button
            onClick={onEdit}
            className="p-1.5 text-gray-400 hover:text-brand-600 hover:bg-brand-50 rounded-lg transition-colors"
          >
            <Pencil className="w-4 h-4" />
          </button>
          <button
            onClick={onDelete}
            disabled={deleting}
            className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-40"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {expanded && (
        <div className="flex flex-wrap gap-1.5 mt-3">
          {words.map((w, i) => (
            <span key={i} className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded-full">
              {w.word} — {w.translation}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
