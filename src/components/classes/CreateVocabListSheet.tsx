import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { useCreateVocabList } from '@/hooks/useClasses'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { getLanguageName } from '@/lib/utils'
import type { VocabWord } from '@/lib/types'

interface CreateVocabListSheetProps {
  open: boolean
  onClose: () => void
  classId: string
  teacherId: string
  language: string
}

export function CreateVocabListSheet({ open, onClose, classId, teacherId, language }: CreateVocabListSheetProps) {
  const [title, setTitle]   = useState('')
  const [words, setWords]   = useState<Array<{ word: string; translation: string }>>([{ word: '', translation: '' }])
  const [error, setError]   = useState<string | null>(null)

  const { mutateAsync: create, isPending } = useCreateVocabList()

  const handleClose = () => { setTitle(''); setWords([{ word: '', translation: '' }]); setError(null); onClose() }

  const updateWord = (i: number, field: 'word' | 'translation', val: string) =>
    setWords(ws => ws.map((w, idx) => idx === i ? { ...w, [field]: val } : w))

  const addRow = () => setWords(ws => [...ws, { word: '', translation: '' }])

  const removeRow = (i: number) => setWords(ws => ws.filter((_, idx) => idx !== i))

  const handleSave = async () => {
    const validWords = words.filter(w => w.word.trim() && w.translation.trim())
    if (!title.trim()) { setError('Please enter a list title.'); return }
    if (validWords.length === 0) { setError('Add at least one word with a translation.'); return }
    setError(null)

    const vocabWords: VocabWord[] = validWords.map(w => ({
      word:       w.word.trim(),
      base_form:  w.word.trim(),
      translation: w.translation.trim(),
    }))

    try {
      await create({ class_id: classId, teacher_user_id: teacherId, title: title.trim(), language, words: vocabWords })
      handleClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save vocab list.')
    }
  }

  return (
    <Modal open={open} onClose={handleClose} title="Create Vocabulary List">
      <div className="space-y-4">
        <p className="text-sm text-gray-500">{getLanguageName(language)}</p>

        <Input label="List title" value={title} onChange={e => setTitle(e.target.value)}
          placeholder="e.g. Food vocabulary" maxLength={80} />

        <div>
          <p className="text-sm font-medium text-gray-700 mb-2">Words</p>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {words.map((w, i) => (
              <div key={i} className="flex gap-2 items-start">
                <div className="flex-1">
                  <input value={w.word} onChange={e => updateWord(i, 'word', e.target.value)}
                    placeholder="Word" className="w-full px-3 py-2 text-sm rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-brand-500 mb-1" />
                  <input value={w.translation} onChange={e => updateWord(i, 'translation', e.target.value)}
                    placeholder="Translation" className="w-full px-3 py-2 text-sm rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-brand-500" />
                </div>
                {words.length > 1 && (
                  <button onClick={() => removeRow(i)} className="p-2 text-gray-400 hover:text-red-500 mt-1">
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
          <button onClick={addRow} className="mt-2 flex items-center gap-1.5 text-sm text-brand-600 font-medium hover:text-brand-700">
            <Plus className="w-4 h-4" /> Add word
          </button>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <Button fullWidth size="lg" onClick={handleSave} loading={isPending}>
          Save List
        </Button>
      </div>
    </Modal>
  )
}
