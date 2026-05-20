import { LoadingSpinner } from './LoadingSpinner'

export function LoadingScreen() {
  return (
    <div className="min-h-dvh flex flex-col items-center justify-center gap-3 bg-slate-50">
      <span className="text-3xl">📖</span>
      <LoadingSpinner size="md" />
    </div>
  )
}
