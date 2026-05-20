import { useState, useRef } from 'react'
import { Search, ArrowLeft, AlertCircle } from 'lucide-react'
import { normalizeWord, type NormalizedWord } from '@/lib/ai'
import { useAddWord } from '@/hooks/useWordBank'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { getLanguageFlag, getLanguageName } from '@/lib/utils'

// ─── State machine ────────────────────────────────────────────────────────────

type Phase =
  | { t: 'input' }
  | { t: 'loading'; word: string }
  | { t: 'preview'; word: string; result: NormalizedWord }
  | { t: 'duplicate'; existingWord: string; existingTranslation: string }
  | { t: 'error'; message: string }

// ─── Props ────────────────────────────────────────────────────────────────────

interface AddWordSheetProps {
  open: boolean
  onClose: () => void
  language: string
  userId: string
}

// ─── Component ───────────────────────────────────────────────────────────────

export function AddWordSheet({ open, onClose, language, userId }: AddWordSheetProps) {
  const [phase, setPhase] = useState<Phase>({ t: 'input' })
  const [inputWord, setInputWord] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const { mutateAsync: addWord, isPending: isSaving } = useAddWord()

  const reset = () => {
    setPhase({ t: 'input' })
    setInputWord('')
  }

  const handleClose = () => {
    reset()
    onClose()
  }

  // ── Look up ─────────────────────────────────────────────────────────────────

  const handleLookup = async () => {
    const word = inputWord.trim()
    if (!word) return

    setPhase({ t: 'loading', word })
    try {
      const result = await normalizeWord(word, language)
      setPhase({ t: 'preview', word, result })
    } catch (err) {
      setPhase({
        t: 'error',
        message: err instanceof Error ? err.message : 'Failed to look up word. Please try again.',
      })
    }
  }

  // ── Save ────────────────────────────────────────────────────────────────────

  const handleAdd = async () => {
    if (phase.t !== 'preview') return
    const { result } = phase

    try {
      await addWord({
        user_id: userId,
        language,
        word: result.base_form,
        base_form: result.base_form,
        translation: result.translation,
        example_sentence: result.example_sentence || null,
        encountered_forms:
          result.encountered_form !== result.base_form ? [result.encountered_form] : [],
      })
      handleClose()
    } catch (err) {
      if (err instanceof Error && err.message === 'DUPLICATE') {
        const e = err as Error & { existing: { word: string; translation: string } }
        setPhase({
          t: 'duplicate',
          existingWord: e.existing.word,
          existingTranslation: e.existing.translation,
        })
      } else {
        setPhase({
          t: 'error',
          message: err instanceof Error ? err.message : 'Could not save word.',
        })
      }
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  const langFlag = getLanguageFlag(language)
  const langName = getLanguageName(language)

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Add a word"
    >
      {/* Language badge */}
      <div className="flex items-center gap-2 mb-5">
        <span className="text-lg">{langFlag}</span>
        <span className="text-sm font-medium text-gray-700">{langName}</span>
      </div>

      {/* ── INPUT phase ─────────────────────────────────────────────────────── */}
      {phase.t === 'input' && (
        <div className="space-y-4">
          <Input
            ref={inputRef}
            value={inputWord}
            onChange={e => setInputWord(e.target.value)}
            placeholder={`Type a word in ${langName}…`}
            autoFocus
            onKeyDown={e => e.key === 'Enter' && handleLookup()}
          />
          <Button
            fullWidth
            size="lg"
            onClick={handleLookup}
            disabled={!inputWord.trim()}
            leftIcon={<Search className="w-4 h-4" />}
          >
            Look up with AI
          </Button>
        </div>
      )}

      {/* ── LOADING phase ───────────────────────────────────────────────────── */}
      {phase.t === 'loading' && (
        <div className="flex flex-col items-center gap-4 py-8">
          <LoadingSpinner size="lg" />
          <p className="text-sm text-gray-500">
            Looking up &ldquo;{phase.word}&rdquo; in {langName}…
          </p>
        </div>
      )}

      {/* ── PREVIEW phase ───────────────────────────────────────────────────── */}
      {phase.t === 'preview' && (
        <div className="space-y-4">
          {/* Result card */}
          <div className="bg-gray-50 rounded-2xl p-4 space-y-2">
            <div className="flex items-baseline gap-3 flex-wrap">
              <span className="text-2xl font-bold text-gray-900">
                {phase.result.base_form}
              </span>
              <span className="text-sm text-gray-500 bg-white px-2 py-0.5 rounded-full border border-gray-200">
                {phase.result.part_of_speech}
              </span>
            </div>

            <p className="text-brand-700 font-semibold">{phase.result.translation}</p>

            {phase.result.example_sentence && (
              <p className="text-sm text-gray-600 italic leading-relaxed">
                &ldquo;{phase.result.example_sentence}&rdquo;
              </p>
            )}

            {/* Show inflection note if the input was different from base form */}
            {phase.result.base_form !== phase.word && (
              <p className="text-xs text-amber-600 bg-amber-50 px-3 py-1.5 rounded-lg">
                ✨ Normalised from &ldquo;{phase.word}&rdquo; → dictionary form
              </p>
            )}
          </div>

          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="md"
              onClick={reset}
              leftIcon={<ArrowLeft className="w-4 h-4" />}
            >
              Back
            </Button>
            <Button
              fullWidth
              size="lg"
              onClick={handleAdd}
              loading={isSaving}
            >
              Add to Word Bank
            </Button>
          </div>
        </div>
      )}

      {/* ── DUPLICATE phase ─────────────────────────────────────────────────── */}
      {phase.t === 'duplicate' && (
        <div className="space-y-4">
          <div className="bg-amber-50 rounded-2xl p-4 border border-amber-100">
            <p className="font-semibold text-amber-800 mb-1">Already in your word bank!</p>
            <p className="text-sm text-amber-700">
              <span className="font-medium">{phase.existingWord}</span> — {phase.existingTranslation}
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" size="md" onClick={reset} leftIcon={<ArrowLeft className="w-4 h-4" />}>
              Add another
            </Button>
            <Button variant="secondary" size="md" fullWidth onClick={handleClose}>
              Close
            </Button>
          </div>
        </div>
      )}

      {/* ── ERROR phase ─────────────────────────────────────────────────────── */}
      {phase.t === 'error' && (
        <div className="space-y-4">
          <div className="bg-red-50 rounded-2xl p-4 border border-red-100 flex gap-3">
            <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
            <p className="text-sm text-red-700">{phase.message}</p>
          </div>
          <Button
            variant="secondary"
            fullWidth
            onClick={reset}
            leftIcon={<ArrowLeft className="w-4 h-4" />}
          >
            Try again
          </Button>
        </div>
      )}
    </Modal>
  )
}
