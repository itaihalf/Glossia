import { useState } from 'react'
import { Sparkles, Edit3, Send, Calendar } from 'lucide-react'
import { generateStory, reviseStory, type GeneratedStory } from '@/lib/ai'
import { useCreateClassStory, useClassVocabLists } from '@/hooks/useClasses'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { cn } from '@/lib/utils'
import { getLanguageName, getLevelLabel } from '@/lib/utils'
import { STORY_LENGTHS, LANGUAGE_LEVELS } from '@/lib/constants'
import type { StoryLength, VocabWord } from '@/lib/types'

interface TeacherStorySheetProps {
  open: boolean
  onClose: () => void
  classId: string
  teacherId: string
  classLanguage: string
  classLevel: string
}

type Phase =
  | { t: 'config' }
  | { t: 'generating' }
  | { t: 'draft'; story: GeneratedStory }
  | { t: 'revising'; story: GeneratedStory }
  | { t: 'sending'; story: GeneratedStory }
  | { t: 'error'; message: string; prevStory?: GeneratedStory }

function sampleWords(words: VocabWord[], count: number): Array<{ word: string; translation: string }> {
  const shuffled = [...words].sort(() => Math.random() - 0.5)
  return shuffled.slice(0, count).map(w => ({ word: w.word, translation: w.translation }))
}

export function TeacherStorySheet({ open, onClose, classId, teacherId, classLanguage, classLevel }: TeacherStorySheetProps) {
  const [phase, setPhase]       = useState<Phase>({ t: 'config' })
  const [length, setLength]     = useState<StoryLength>('short')
  const [level, setLevel]       = useState(classLevel)
  const [lingSpec, setLingSpec] = useState('')
  const [topic, setTopic]       = useState('')
  const [reviseInstr, setReviseInstr] = useState('')

  // Vocab list selection
  const [selectedListId, setSelectedListId] = useState<string>('')
  const [wordCount, setWordCount]           = useState(5)

  // Due date
  const [dueDate, setDueDate] = useState('')

  const { data: vocabLists = [] } = useClassVocabLists(classId)
  const { mutateAsync: createStory } = useCreateClassStory()

  const selectedList = vocabLists.find(l => l.id === selectedListId)
  const maxWords = selectedList ? (selectedList.words as VocabWord[]).length : 0

  const handleClose = () => {
    setPhase({ t: 'config' })
    setLingSpec(''); setTopic(''); setReviseInstr('')
    setSelectedListId(''); setWordCount(5); setDueDate('')
    onClose()
  }

  // ── Generate ──────────────────────────────────────────────────────────────

  const handleGenerate = async () => {
    setPhase({ t: 'generating' })
    try {
      const wordBankWords = selectedList
        ? sampleWords(selectedList.words as VocabWord[], Math.min(wordCount, maxWords))
        : []

      const generated = await generateStory({
        languageCode: classLanguage,
        level,
        interests: [],
        wordBankWords,
        length,
        topicHint:     topic    || undefined,
        linguisticSpec: lingSpec || undefined,
      })
      setPhase({ t: 'draft', story: generated })
    } catch (err) {
      setPhase({ t: 'error', message: err instanceof Error ? err.message : 'Generation failed.' })
    }
  }

  // ── Revise ────────────────────────────────────────────────────────────────

  const handleRevise = async (currentStory: GeneratedStory) => {
    if (!reviseInstr.trim()) return
    setPhase({ t: 'revising', story: currentStory })
    try {
      const revised = await reviseStory({
        languageCode: classLanguage,
        currentTitle: currentStory.title,
        currentContent: currentStory.content,
        currentTranslation: currentStory.translation,
        instruction: reviseInstr,
      })
      setReviseInstr('')
      setPhase({ t: 'draft', story: revised })
    } catch (err) {
      setPhase({ t: 'error', message: err instanceof Error ? err.message : 'Revision failed.', prevStory: currentStory })
    }
  }

  // ── Send to class ─────────────────────────────────────────────────────────

  const handleSend = async (story: GeneratedStory) => {
    setPhase({ t: 'sending', story })
    try {
      await createStory({
        user_id: teacherId, class_id: classId, teacher_user_id: teacherId,
        title: story.title, content: story.content, translation: story.translation,
        language: classLanguage, level, length,
        interests_used: [], words_used_from_bank: [],
        due_date:  dueDate ? new Date(dueDate).toISOString() : null,
        is_open:   true,
      })
      handleClose()
    } catch (err) {
      setPhase({ t: 'error', message: err instanceof Error ? err.message : 'Could not send story.', prevStory: story })
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <Modal open={open} onClose={handleClose} title="Create Class Story" className="max-h-[92dvh]">
      <p className="text-sm text-gray-500 mb-4">{getLanguageName(classLanguage)}</p>

      {/* ── Config ──────────────────────────────────────────────────────────── */}
      {phase.t === 'config' && (
        <div className="space-y-4">

          {/* Length */}
          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">Length</p>
            <div className="grid grid-cols-2 gap-2">
              {STORY_LENGTHS.map(sl => (
                <button key={sl.value} onClick={() => setLength(sl.value as StoryLength)}
                  className={cn('flex flex-col p-3 rounded-xl border-2 text-left transition-all',
                    length === sl.value ? 'border-brand-500 bg-brand-50' : 'border-gray-200 hover:border-gray-300')}>
                  <span className="font-semibold text-sm text-gray-900">{sl.label}</span>
                  <span className="text-xs text-gray-400">{sl.description}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Level */}
          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">Level (defaults to class level)</p>
            <div className="grid grid-cols-1 gap-1.5 max-h-40 overflow-y-auto">
              {LANGUAGE_LEVELS.map(lvl => (
                <button key={lvl.value} onClick={() => setLevel(lvl.value)}
                  className={cn('flex items-center justify-between px-3 py-2 rounded-xl border-2 text-left transition-all',
                    level === lvl.value ? 'border-brand-500 bg-brand-50' : 'border-gray-200 hover:border-gray-300')}>
                  <span className="text-sm font-medium text-gray-900">{lvl.label}</span>
                  {level === lvl.value && <span className="w-3 h-3 rounded-full bg-brand-500" />}
                </button>
              ))}
            </div>
          </div>

          {/* Vocabulary list picker */}
          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">Vocabulary list (optional)</p>
            <select
              value={selectedListId}
              onChange={e => {
                setSelectedListId(e.target.value)
                const list = vocabLists.find(l => l.id === e.target.value)
                if (list) setWordCount(Math.min(5, (list.words as VocabWord[]).length))
              }}
              className="w-full px-3 py-2.5 text-sm rounded-xl border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              <option value="">None — no vocabulary injection</option>
              {vocabLists.map(l => (
                <option key={l.id} value={l.id}>
                  {l.title} ({(l.words as VocabWord[]).length} words)
                </option>
              ))}
            </select>

            {selectedList && (
              <div className="mt-3 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-gray-700">
                    Words to inject: <span className="text-brand-600 font-bold">{wordCount}</span>
                  </p>
                  <p className="text-xs text-gray-400">of {maxWords} total</p>
                </div>
                <input
                  type="range"
                  min={1}
                  max={maxWords}
                  value={wordCount}
                  onChange={e => setWordCount(Number(e.target.value))}
                  className="w-full accent-brand-500"
                />
                <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                  {(selectedList.words as VocabWord[]).slice(0, wordCount).map((w, i) => (
                    <span key={i} className="text-xs bg-brand-50 text-brand-700 border border-brand-100 px-2 py-1 rounded-full">
                      {w.word}
                    </span>
                  ))}
                  {wordCount < maxWords && (
                    <span className="text-xs text-gray-400 px-2 py-1">
                      +{maxWords - wordCount} more not shown
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Linguistic spec */}
          <Input label="Linguistic specification (optional)"
            value={lingSpec} onChange={e => setLingSpec(e.target.value)}
            placeholder="e.g. Use present tense only, Practice accusative case" />

          {/* Topic */}
          <Input label="Story idea / topic (optional)"
            value={topic} onChange={e => setTopic(e.target.value)}
            placeholder="e.g. Two friends exploring Athens…" />

          {/* Due date */}
          <div>
            <label className="flex items-center gap-1.5 text-sm font-medium text-gray-700 mb-1.5">
              <Calendar className="w-4 h-4 text-gray-400" />
              Due date (optional)
            </label>
            <input
              type="date"
              value={dueDate}
              onChange={e => setDueDate(e.target.value)}
              min={new Date().toISOString().split('T')[0]}
              className="w-full px-3 py-2.5 text-sm rounded-xl border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>

          <Button fullWidth size="lg" leftIcon={<Sparkles className="w-4 h-4" />} onClick={handleGenerate}>
            Generate Story
          </Button>
        </div>
      )}

      {/* ── Generating ──────────────────────────────────────────────────────── */}
      {phase.t === 'generating' && (
        <div className="flex flex-col items-center gap-4 py-10">
          <Sparkles className="w-10 h-10 text-brand-400 animate-pulse" />
          <LoadingSpinner size="md" />
          <p className="text-sm text-gray-500 text-center">
            Writing a {getLevelLabel(level)} story in {getLanguageName(classLanguage)}…
          </p>
        </div>
      )}

      {/* ── Draft ───────────────────────────────────────────────────────────── */}
      {(phase.t === 'draft' || phase.t === 'revising' || phase.t === 'sending') && (
        <DraftEditor
          story={phase.story}
          reviseInstr={reviseInstr}
          setReviseInstr={setReviseInstr}
          isRevising={phase.t === 'revising'}
          isSending={phase.t === 'sending'}
          dueDate={dueDate}
          onStoryChange={s => setPhase({ t: 'draft', story: s })}
          onRevise={() => handleRevise(phase.story)}
          onSend={() => handleSend(phase.story)}
          onBack={() => setPhase({ t: 'config' })}
        />
      )}

      {/* ── Error ───────────────────────────────────────────────────────────── */}
      {phase.t === 'error' && (
        <div className="space-y-4">
          <div className="bg-red-50 rounded-2xl p-4 border border-red-100">
            <p className="font-semibold text-red-800 mb-1">Something went wrong</p>
            <p className="text-sm text-red-700">{phase.message}</p>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" fullWidth onClick={() => setPhase({ t: 'config' })}>
              Start over
            </Button>
            {phase.prevStory && (
              <Button fullWidth onClick={() => setPhase({ t: 'draft', story: phase.prevStory! })}>
                Back to draft
              </Button>
            )}
          </div>
        </div>
      )}
    </Modal>
  )
}

// ─── Draft editor sub-component ──────────────────────────────────────────────

interface DraftEditorProps {
  story: GeneratedStory
  reviseInstr: string
  setReviseInstr: (v: string) => void
  isRevising: boolean
  isSending: boolean
  dueDate: string
  onStoryChange: (s: GeneratedStory) => void
  onRevise: () => void
  onSend: () => void
  onBack: () => void
}

function DraftEditor({ story, reviseInstr, setReviseInstr, isRevising, isSending, dueDate, onStoryChange, onRevise, onSend, onBack }: DraftEditorProps) {
  return (
    <div className="space-y-4">
      {/* Title */}
      <Input label="Story title (editable)"
        value={story.title}
        onChange={e => onStoryChange({ ...story, title: e.target.value })} />

      {/* Content */}
      <div>
        <p className="text-sm font-medium text-gray-700 mb-1.5">Story content (editable)</p>
        <textarea value={story.content}
          onChange={e => onStoryChange({ ...story, content: e.target.value })}
          className="w-full h-40 px-3 py-2.5 text-sm rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
          placeholder="Story content…" />
      </div>

      {/* Due date reminder */}
      {dueDate && (
        <p className="text-xs text-gray-500 flex items-center gap-1.5">
          <Calendar className="w-3.5 h-3.5" />
          Due {new Date(dueDate).toLocaleDateString()}
        </p>
      )}

      {/* AI revision */}
      <div className="bg-brand-50 rounded-2xl p-4 border border-brand-100">
        <div className="flex items-center gap-2 mb-2">
          <Edit3 className="w-4 h-4 text-brand-600" />
          <p className="text-sm font-semibold text-brand-800">Revise with AI</p>
        </div>
        <div className="flex gap-2">
          <input value={reviseInstr} onChange={e => setReviseInstr(e.target.value)}
            placeholder="e.g. Make it shorter, Add more past tense…"
            className="flex-1 px-3 py-2 text-sm rounded-xl border border-brand-200 bg-white focus:outline-none focus:ring-2 focus:ring-brand-500" />
          <Button size="sm" onClick={onRevise} loading={isRevising}
            disabled={!reviseInstr.trim() || isSending}>
            Apply
          </Button>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <Button variant="secondary" size="md" onClick={onBack} disabled={isRevising || isSending}>
          ← Back
        </Button>
        <Button fullWidth size="lg" leftIcon={<Send className="w-4 h-4" />}
          loading={isSending} disabled={isRevising}
          onClick={onSend}>
          Send to Class
        </Button>
      </div>
    </div>
  )
}
