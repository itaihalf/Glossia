import { useState } from 'react'
import { ChevronDown, Trash2, CheckCircle, RotateCcw } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatTimeAgo } from '@/lib/utils'
import type { WordBankEntry, WordStatus } from '@/lib/types'

// ─── Card ─────────────────────────────────────────────────────────────────────

interface WordCardProps {
  entry: WordBankEntry
  onStatusChange: (id: string, newStatus: WordStatus) => void
  onDelete: (id: string) => void
  mutating?: boolean
}

export function WordCard({ entry, onStatusChange, onDelete, mutating = false }: WordCardProps) {
  const [expanded, setExpanded] = useState(false)

  const isLearning = entry.status === 'learning'

  return (
    <div
      className={cn(
        'bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden',
        'transition-shadow duration-150',
        expanded && 'shadow-md border-gray-200',
      )}
    >
      {/* Main row — always visible */}
      <button
        className="w-full flex items-center gap-3 p-4 text-left"
        onClick={() => setExpanded(e => !e)}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2 flex-wrap">
            <span className="font-bold text-gray-900 text-base">{entry.word}</span>
            <span className="text-gray-500 text-sm truncate">{entry.translation}</span>
          </div>
          <div className="flex items-center gap-3 mt-1.5">
            <span className="text-xs font-medium text-brand-600 bg-brand-50 px-2 py-0.5 rounded-full">
              🔥 {entry.streak_count} / 5
            </span>
            {entry.last_reviewed_at && (
              <span className="text-xs text-gray-300">{formatTimeAgo(entry.last_reviewed_at)}</span>
            )}
          </div>
        </div>

        <ChevronDown
          className={cn(
            'w-4 h-4 text-gray-300 shrink-0 transition-transform duration-200',
            expanded && 'rotate-180',
          )}
        />
      </button>

      {/* Expanded details */}
      {expanded && (
        <div className="px-4 pb-4 border-t border-gray-50 pt-3 space-y-3">
          {entry.example_sentence && (
            <p className="text-sm text-gray-600 italic leading-relaxed">
              &ldquo;{entry.example_sentence}&rdquo;
            </p>
          )}

          {entry.encountered_forms.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              <span className="text-xs text-gray-400">Also seen:</span>
              {entry.encountered_forms.map(f => (
                <span key={f} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                  {f}
                </span>
              ))}
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-2 pt-1">
            <button
              disabled={mutating}
              onClick={() => onStatusChange(entry.id, isLearning ? 'known' : 'learning')}
              className={cn(
                'flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold transition-all duration-150',
                isLearning
                  ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                  : 'bg-brand-50 text-brand-700 hover:bg-brand-100',
                mutating && 'opacity-50 cursor-not-allowed',
              )}
            >
              {isLearning
                ? <><CheckCircle className="w-3.5 h-3.5" /> Mark as Known</>
                : <><RotateCcw className="w-3.5 h-3.5" /> Back to Learning</>
              }
            </button>

            <button
              disabled={mutating}
              onClick={() => onDelete(entry.id)}
              className={cn(
                'p-2 rounded-xl text-gray-400 hover:text-red-500 hover:bg-red-50 transition-all duration-150',
                mutating && 'opacity-50 cursor-not-allowed',
              )}
              title="Delete word"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
