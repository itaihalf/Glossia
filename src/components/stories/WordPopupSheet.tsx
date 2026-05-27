import { useEffect, type ReactNode } from 'react'
import { X, BookPlus, Check, AlertCircle, RotateCcw } from 'lucide-react'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils'

// ─── Types passed in ─────────────────────────────────────────────────────────

export type WordLookupState =
  | { phase: 'closed' }
  | { phase: 'loading'; word: string }
  | { phase: 'result'; word: string; baseForm: string; translation: string; pos: string; example: string }
  | { phase: 'error'; word: string; message: string }

export type AddState = 'idle' | 'adding' | 'added' | 'duplicate' | 'error'
export type TransferState = 'idle' | 'transferring' | 'transferred' | 'error'

interface WordPopupSheetProps {
  state: WordLookupState
  addState: AddState
  onClose: () => void
  onAddToWordBank: () => void
  existingStatus: 'learning' | 'known' | null
  transferState: TransferState
  onTransferToLearning: () => void
}

// ─── Component ───────────────────────────────────────────────────────────────

export function WordPopupSheet({ state, addState, onClose, onAddToWordBank, existingStatus, transferState, onTransferToLearning }: WordPopupSheetProps) {
  const open = state.phase !== 'closed'

  // Lock scroll when open
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center pt-[10vh] px-4">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />

      <div className="relative w-full max-w-[440px] bg-white rounded-2xl shadow-2xl px-5 pt-4 pb-5">
        {/* Header row */}
        <div className="flex items-center justify-between mb-4">
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">
            {state.phase === 'loading' ? 'Looking up…' : 'Word'}
          </p>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* ── Loading ───────────────────────────────────────────────────────── */}
        {state.phase === 'loading' && (
          <div className="flex items-center gap-3 py-4">
            <LoadingSpinner size="sm" />
            <span className="text-gray-600 font-medium">&ldquo;{state.word}&rdquo;</span>
          </div>
        )}

        {/* ── Result ────────────────────────────────────────────────────────── */}
        {state.phase === 'result' && (
          <div className="space-y-3">
            <div>
              <div className="flex items-baseline gap-3 flex-wrap">
                <span className="text-2xl font-bold text-gray-900">{state.baseForm}</span>
                {state.pos && (
                  <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">
                    {state.pos}
                  </span>
                )}
              </div>
              {state.baseForm !== state.word && (
                <p className="text-xs text-gray-400 mt-0.5">
                  from &ldquo;{state.word}&rdquo;
                </p>
              )}
              <p className="text-brand-700 font-semibold mt-1">{state.translation}</p>
            </div>

            {state.example && (
              <p className="text-sm text-gray-500 italic leading-relaxed">
                &ldquo;{state.example}&rdquo;
              </p>
            )}

            {/* Action area: depends on word's existing status */}
            {addState !== 'idle' ? (
              <AddButton addState={addState} onClick={onAddToWordBank} />
            ) : existingStatus === 'learning' ? (
              <div className="flex items-center gap-2 py-2 px-3 rounded-xl bg-blue-50 text-blue-700 text-sm font-medium">
                <Check className="w-4 h-4 shrink-0" />
                Already in the learning list
              </div>
            ) : existingStatus === 'known' ? (
              <TransferButton transferState={transferState} onClick={onTransferToLearning} />
            ) : (
              <AddButton addState={addState} onClick={onAddToWordBank} />
            )}
          </div>
        )}

        {/* ── Error ─────────────────────────────────────────────────────────── */}
        {state.phase === 'error' && (
          <div className="flex gap-2 py-2">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            <p className="text-sm text-red-600">{state.message}</p>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Transfer button ──────────────────────────────────────────────────────────

function TransferButton({ transferState, onClick }: { transferState: TransferState; onClick: () => void }) {
  if (transferState === 'transferred') {
    return (
      <div className="flex items-center gap-2 py-2 px-3 rounded-xl bg-emerald-50 text-emerald-700 text-sm font-medium">
        <Check className="w-4 h-4 shrink-0" />
        Moved to learning list!
      </div>
    )
  }

  return (
    <Button
      fullWidth
      variant="secondary"
      disabled={transferState === 'transferring'}
      onClick={onClick}
    >
      {transferState === 'transferring' ? (
        <><LoadingSpinner size="sm" /> Moving…</>
      ) : transferState === 'error' ? (
        'Could not transfer — try again'
      ) : (
        <><RotateCcw className="w-4 h-4" /> Transfer back to learning?</>
      )}
    </Button>
  )
}

// ─── Add button states ────────────────────────────────────────────────────────

function AddButton({ addState, onClick }: { addState: AddState; onClick: () => void }) {
  const states: Record<AddState, { label: ReactNode; variant: 'primary' | 'secondary'; disabled: boolean }> = {
    idle:      { label: <><BookPlus className="w-4 h-4" /> Add to Word Bank</>,      variant: 'primary',   disabled: false },
    adding:    { label: <><LoadingSpinner size="sm" /> Adding…</>,                   variant: 'secondary', disabled: true },
    added:     { label: <><Check className="w-4 h-4" /> Added!</>,                   variant: 'secondary', disabled: true },
    duplicate: { label: <><Check className="w-4 h-4" /> Already in Word Bank</>,     variant: 'secondary', disabled: true },
    error:     { label: 'Could not add — try again',                                 variant: 'secondary', disabled: false },
  }

  const s = states[addState]

  return (
    <Button
      fullWidth
      variant={s.variant}
      disabled={s.disabled}
      onClick={onClick}
      className={cn(addState === 'added' || addState === 'duplicate'
        ? 'text-emerald-700 border-emerald-200 bg-emerald-50'
        : ''
      )}
    >
      {s.label}
    </Button>
  )
}
