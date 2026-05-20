import { useState, useRef, useEffect } from 'react'
import { cn } from '@/lib/utils'
import type { WordBankEntry } from '@/lib/types'

interface FlashCardProps {
  entry: WordBankEntry
  index: number
  total: number
  isPending: boolean
  onRespond: (response: 'comfortable' | 'practice') => void
}

const SWIPE_THRESHOLD = 80   // px to count as a decisive swipe
const FLY_DISTANCE   = 600  // px for fly-off animation

export function FlashCard({ entry, index, total, isPending, onRespond }: FlashCardProps) {
  const [isRevealed, setIsRevealed] = useState(false)
  const [dragX, setDragX]           = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const [isFlying, setIsFlying]     = useState(false)
  const startX = useRef<number | null>(null)

  // Reset state when the entry changes (new card)
  useEffect(() => {
    setIsRevealed(false)
    setDragX(0)
    setIsDragging(false)
    setIsFlying(false)
  }, [entry.id])

  // ── Pointer drag (works for both touch and mouse) ─────────────────────────

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isRevealed || isPending) return
    startX.current = e.clientX
    setIsDragging(true)
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging || startX.current === null) return
    setDragX(e.clientX - startX.current)
  }

  const handlePointerUp = () => {
    if (!isDragging) return
    setIsDragging(false)
    startX.current = null

    if (Math.abs(dragX) >= SWIPE_THRESHOLD) {
      const dir = dragX > 0 ? 1 : -1
      setIsFlying(true)
      setDragX(dir * FLY_DISTANCE)
      // Wait for fly-off animation, then call parent
      setTimeout(() => onRespond(dir > 0 ? 'comfortable' : 'practice'), 300)
    } else {
      setDragX(0)
    }
  }

  // ── Button responses ──────────────────────────────────────────────────────

  const handleButton = (response: 'comfortable' | 'practice') => {
    if (isPending) return
    const dir = response === 'comfortable' ? 1 : -1
    setIsFlying(true)
    setDragX(dir * FLY_DISTANCE)
    setTimeout(() => onRespond(response), 300)
  }

  // ── Derived ───────────────────────────────────────────────────────────────

  const rotation      = dragX * 0.04
  const flyOpacity    = Math.max(0, 1 - Math.abs(dragX) / FLY_DISTANCE)
  const showComfort   = dragX > 30
  const showPractice  = dragX < -30

  return (
    <div className="flex flex-col items-center w-full select-none">
      {/* Progress */}
      <div className="flex items-center gap-3 mb-6 w-full max-w-sm">
        <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-brand-500 rounded-full transition-all duration-500"
            style={{ width: `${((index) / total) * 100}%` }}
          />
        </div>
        <span className="text-sm text-gray-400 tabular-nums shrink-0">{index + 1} / {total}</span>
      </div>

      {/* Card */}
      <div
        className="relative w-full max-w-sm cursor-grab active:cursor-grabbing"
        style={{
          transform: `translateX(${dragX}px) rotate(${rotation}deg)`,
          transition: isDragging ? 'none' : 'transform 0.3s ease, opacity 0.3s ease',
          opacity: isFlying ? flyOpacity : 1,
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onClick={() => { if (!isDragging && Math.abs(dragX) < 5) setIsRevealed(true) }}
      >
        {/* Swipe labels */}
        {showPractice && (
          <div className="absolute top-4 right-4 z-10 bg-orange-100 text-orange-700 px-3 py-1.5 rounded-full text-sm font-bold rotate-[10deg]">
            📚 Practice
          </div>
        )}
        {showComfort && (
          <div className="absolute top-4 left-4 z-10 bg-emerald-100 text-emerald-700 px-3 py-1.5 rounded-full text-sm font-bold rotate-[-10deg]">
            👍 Got it!
          </div>
        )}

        <div
          className={cn(
            'w-full min-h-[220px] rounded-3xl border-2 shadow-lg',
            'flex flex-col items-center justify-center p-8 gap-4',
            'transition-colors duration-200',
            isRevealed
              ? 'bg-white border-brand-200'
              : 'bg-white border-gray-200 hover:border-gray-300',
          )}
        >
          {/* Word */}
          <span className="text-4xl font-bold text-gray-900 text-center leading-tight">
            {entry.word}
          </span>

          {!isRevealed && (
            <span className="text-sm text-gray-400 animate-pulse mt-2">
              Tap to reveal
            </span>
          )}

          {isRevealed && (
            <>
              <div className="w-16 border-t-2 border-brand-200" />
              <span className="text-2xl font-semibold text-brand-700 text-center">
                {entry.translation}
              </span>
              {entry.example_sentence && (
                <p className="text-sm text-gray-500 italic text-center leading-relaxed mt-1 max-w-[200px]">
                  &ldquo;{entry.example_sentence}&rdquo;
                </p>
              )}
            </>
          )}
        </div>
      </div>

      {/* Swipe hint */}
      {isRevealed && !isFlying && (
        <p className="text-xs text-gray-400 mt-4">Swipe or tap a button</p>
      )}

      {/* Buttons */}
      {isRevealed && (
        <div className="flex gap-3 mt-5 w-full max-w-sm">
          <button
            disabled={isPending || isFlying}
            onClick={() => handleButton('practice')}
            className={cn(
              'flex-1 flex items-center justify-center gap-2 py-3.5 rounded-2xl',
              'border-2 border-orange-200 bg-orange-50 text-orange-700',
              'font-semibold text-sm transition-all duration-150',
              'hover:bg-orange-100 active:scale-95',
              (isPending || isFlying) && 'opacity-50 cursor-not-allowed',
            )}
          >
            😓 Need practice
          </button>

          <button
            disabled={isPending || isFlying}
            onClick={() => handleButton('comfortable')}
            className={cn(
              'flex-1 flex items-center justify-center gap-2 py-3.5 rounded-2xl',
              'border-2 border-emerald-200 bg-emerald-50 text-emerald-700',
              'font-semibold text-sm transition-all duration-150',
              'hover:bg-emerald-100 active:scale-95',
              (isPending || isFlying) && 'opacity-50 cursor-not-allowed',
            )}
          >
            👍 Comfortable
          </button>
        </div>
      )}
    </div>
  )
}
