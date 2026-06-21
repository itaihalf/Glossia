import { useMemo } from 'react'
import { Modal } from '@/components/ui/Modal'
import { getLanguageFlag, getLanguageName } from '@/lib/utils'

interface StoriesCompletedModalProps {
  open: boolean
  onClose: () => void
  byLanguage: Record<string, number>
  total: number
}

export function StoriesCompletedModal({ open, onClose, byLanguage, total }: StoriesCompletedModalProps) {
  // Drop empty buckets and sort most-completed first.
  const rows = useMemo(
    () =>
      Object.entries(byLanguage ?? {})
        .filter(([, count]) => count > 0)
        .sort((a, b) => b[1] - a[1]),
    [byLanguage],
  )

  const max = rows.length > 0 ? rows[0][1] : 0

  return (
    <Modal open={open} onClose={onClose} title="Stories Completed">
      <div className="flex items-baseline gap-2 mb-5">
        <span className="text-3xl font-bold text-gray-900">{total}</span>
        <span className="text-sm text-gray-400">all-time total</span>
      </div>

      {rows.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-3xl mb-2">📚</p>
          <p className="text-sm text-gray-500">
            No completed stories yet. Finish a story to see your breakdown here.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map(([code, count]) => (
            <div key={code} className="flex items-center gap-3">
              <span className="text-xl shrink-0">{getLanguageFlag(code)}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-semibold text-gray-800 truncate">
                    {getLanguageName(code)}
                  </span>
                  <span className="text-sm font-bold text-gray-900 shrink-0 ml-2">{count}</span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-amber-400 rounded-full transition-all duration-500"
                    style={{ width: `${(count / Math.max(max, 1)) * 100}%` }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </Modal>
  )
}
