import { useState } from 'react'
import { useCreateAssignment, useClassVocabLists, useClassStories } from '@/hooks/useClasses'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { cn } from '@/lib/utils'

interface CreateAssignmentSheetProps {
  open: boolean
  onClose: () => void
  classId: string
  teacherId: string
}

export function CreateAssignmentSheet({ open, onClose, classId, teacherId }: CreateAssignmentSheetProps) {
  const [title, setTitle]       = useState('')
  const [type, setType]         = useState<'vocabulary' | 'story'>('vocabulary')
  const [targetId, setTargetId] = useState<string | null>(null)
  const [dueDate, setDueDate]   = useState('')
  const [error, setError]       = useState<string | null>(null)

  const { mutateAsync: create, isPending } = useCreateAssignment()
  const { data: vocabLists = [] }          = useClassVocabLists(classId)
  const { data: classStories = [] }        = useClassStories(classId)

  const handleClose = () => { setTitle(''); setType('vocabulary'); setTargetId(null); setDueDate(''); setError(null); onClose() }

  const handleCreate = async () => {
    if (!title.trim()) { setError('Please enter a title.'); return }
    setError(null)
    try {
      await create({ class_id: classId, teacher_user_id: teacherId, type, target_id: targetId, title: title.trim(), due_date: dueDate || null })
      handleClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create assignment.')
    }
  }

  const targets = type === 'vocabulary' ? vocabLists : classStories
  const targetLabel = type === 'vocabulary' ? 'Vocabulary list' : 'Story'

  return (
    <Modal open={open} onClose={handleClose} title="Create Assignment">
      <div className="space-y-4">
        <Input label="Assignment title" value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Study food vocabulary" />

        <div>
          <p className="text-sm font-medium text-gray-700 mb-2">Type</p>
          <div className="flex gap-2">
            {(['vocabulary', 'story'] as const).map(t => (
              <button key={t} onClick={() => { setType(t); setTargetId(null) }}
                className={cn('flex-1 py-2.5 rounded-xl border-2 font-semibold text-sm capitalize transition-all',
                  type === t ? 'border-brand-500 bg-brand-500 text-white' : 'border-gray-200 text-gray-600 hover:border-gray-300')}>
                {t}
              </button>
            ))}
          </div>
        </div>

        {targets.length > 0 && (
          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">{targetLabel} (optional)</p>
            <div className="space-y-1.5 max-h-40 overflow-y-auto">
              {targets.map((t: { id: string; title: string }) => (
                <button key={t.id} onClick={() => setTargetId(t.id === targetId ? null : t.id)}
                  className={cn('w-full text-left px-3 py-2 rounded-xl border text-sm transition-all',
                    targetId === t.id ? 'border-brand-500 bg-brand-50 text-brand-800' : 'border-gray-200 hover:border-gray-300')}>
                  {t.title}
                </button>
              ))}
            </div>
          </div>
        )}

        <Input label="Due date (optional)" type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} />

        {error && <p className="text-sm text-red-600">{error}</p>}
        <Button fullWidth size="lg" onClick={handleCreate} loading={isPending} disabled={!title.trim()}>
          Create Assignment
        </Button>
      </div>
    </Modal>
  )
}
