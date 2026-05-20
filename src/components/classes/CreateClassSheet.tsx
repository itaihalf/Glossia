import { useState } from 'react'
import { useCreateClass } from '@/hooks/useClasses'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { cn } from '@/lib/utils'
import { SUPPORTED_LANGUAGES, LANGUAGE_LEVELS } from '@/lib/constants'

interface CreateClassSheetProps {
  open: boolean
  onClose: () => void
  teacherId: string
  teachingLanguages: string[]
  onCreated?: (classId: string) => void
}

export function CreateClassSheet({ open, onClose, teacherId, teachingLanguages, onCreated }: CreateClassSheetProps) {
  const [name, setName]     = useState('')
  const [lang, setLang]     = useState(teachingLanguages[0] ?? '')
  const [level, setLevel]   = useState('')
  const [error, setError]   = useState<string | null>(null)

  const { mutateAsync: create, isPending } = useCreateClass()

  const handleClose = () => { setName(''); setLevel(''); setError(null); onClose() }

  const handleSubmit = async () => {
    if (!name.trim() || !lang || !level) { setError('Please fill in all fields.'); return }
    setError(null)
    try {
      const cls = await create({ teacher_user_id: teacherId, name: name.trim(), language: lang, level })
      handleClose()
      onCreated?.(cls.id)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create class.')
    }
  }

  const displayLangs = teachingLanguages.length > 0
    ? SUPPORTED_LANGUAGES.filter(l => teachingLanguages.includes(l.code))
    : SUPPORTED_LANGUAGES

  return (
    <Modal open={open} onClose={handleClose} title="Create a Class">
      <div className="space-y-4">
        <Input label="Class name" value={name} onChange={e => setName(e.target.value)}
          placeholder="e.g. Greek Beginners A" maxLength={60} />

        <div>
          <p className="text-sm font-medium text-gray-700 mb-2">Language</p>
          <div className="grid grid-cols-2 gap-2 max-h-52 overflow-y-auto">
            {displayLangs.map(l => (
              <button key={l.code} onClick={() => setLang(l.code)}
                className={cn(
                  'flex items-center gap-2 p-2.5 rounded-xl border-2 text-left text-sm transition-all duration-100',
                  lang === l.code ? 'border-brand-500 bg-brand-50' : 'border-gray-200 hover:border-gray-300',
                )}>
                <span className="text-lg">{l.flag}</span>
                <div><p className="font-medium text-xs text-gray-900">{l.name}</p></div>
              </button>
            ))}
          </div>
          {teachingLanguages.length === 0 && (
            <p className="text-xs text-amber-600 mt-1">Add teaching languages in your Profile first.</p>
          )}
        </div>

        <div>
          <p className="text-sm font-medium text-gray-700 mb-2">Class level</p>
          <div className="space-y-2">
            {LANGUAGE_LEVELS.map(lvl => (
              <button key={lvl.value} onClick={() => setLevel(lvl.value)}
                className={cn(
                  'w-full flex items-center justify-between p-3 rounded-xl border-2 text-left transition-all duration-100',
                  level === lvl.value ? 'border-brand-500 bg-brand-50' : 'border-gray-200 hover:border-gray-300',
                )}>
                <div>
                  <p className="font-semibold text-sm text-gray-900">{lvl.label}</p>
                  <p className="text-xs text-gray-400">{lvl.description}</p>
                </div>
                {level === lvl.value && <span className="w-4 h-4 rounded-full bg-brand-500 shrink-0" />}
              </button>
            ))}
          </div>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <Button fullWidth size="lg" onClick={handleSubmit} loading={isPending}
          disabled={!name.trim() || !lang || !level}>
          Create Class
        </Button>
      </div>
    </Modal>
  )
}
