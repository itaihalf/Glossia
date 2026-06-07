import { useState } from 'react'
import { Download } from 'lucide-react'
import { useGlobalVocabLists, useImportGlobalVocabToClass } from '@/hooks/useClasses'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { getLanguageName } from '@/lib/utils'
import { cn } from '@/lib/utils'
import type { VocabWord } from '@/lib/types'

interface ImportGlobalVocabSheetProps {
  open: boolean
  onClose: () => void
  classId: string
  teacherId: string
  classLanguage: string
}

export function ImportGlobalVocabSheet({ open, onClose, classId, teacherId, classLanguage }: ImportGlobalVocabSheetProps) {
  const [selected, setSelected] = useState<string | null>(null)
  const [error, setError]       = useState<string | null>(null)

  const { data: globalLists = [], isLoading } = useGlobalVocabLists(teacherId, classLanguage)
  const { mutateAsync: importList, isPending } = useImportGlobalVocabToClass()

  const handleClose = () => { setSelected(null); setError(null); onClose() }

  const handleImport = async () => {
    const list = globalLists.find(l => l.id === selected)
    if (!list) return
    setError(null)
    try {
      await importList({ list, classId })
      handleClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed.')
    }
  }

  return (
    <Modal open={open} onClose={handleClose} title="Import from Global Lists">
      <div className="space-y-4">
        <p className="text-sm text-gray-500">
          {getLanguageName(classLanguage)} — select a list to copy into this class
        </p>

        {isLoading && <div className="flex justify-center py-8"><LoadingSpinner /></div>}

        {!isLoading && globalLists.length === 0 && (
          <div className="text-center py-10 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
            <p className="text-3xl mb-2">📚</p>
            <p className="text-sm text-gray-400">
              No global {getLanguageName(classLanguage)} lists yet.
            </p>
            <p className="text-xs text-gray-400 mt-1">
              Create some on the Word Lists page first.
            </p>
          </div>
        )}

        {!isLoading && globalLists.length > 0 && (
          <div className="space-y-2 max-h-72 overflow-y-auto">
            {globalLists.map(list => (
              <button
                key={list.id}
                onClick={() => setSelected(list.id)}
                className={cn(
                  'w-full text-left p-3 rounded-xl border-2 transition-all',
                  selected === list.id
                    ? 'border-brand-500 bg-brand-50'
                    : 'border-gray-200 hover:border-gray-300 bg-white',
                )}
              >
                <p className="font-semibold text-sm text-gray-900">{list.title}</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {(list.words as VocabWord[]).length} words
                </p>
              </button>
            ))}
          </div>
        )}

        {error && <p className="text-sm text-red-600">{error}</p>}

        <Button
          fullWidth size="lg"
          leftIcon={<Download className="w-4 h-4" />}
          disabled={!selected || isPending}
          loading={isPending}
          onClick={handleImport}
        >
          Copy to Class
        </Button>
      </div>
    </Modal>
  )
}
