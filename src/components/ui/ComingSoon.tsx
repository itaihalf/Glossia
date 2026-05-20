interface ComingSoonProps {
  title: string
  phase: number
  description: string
  emoji?: string
}

export function ComingSoon({ title, phase, description, emoji = '🚧' }: ComingSoonProps) {
  return (
    <div className="px-4 pt-10">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">{title}</h1>
      <p className="text-sm text-gray-400 mb-8">Arriving in Phase {phase}</p>

      <div className="bg-white rounded-2xl border border-dashed border-gray-200 px-6 py-12 text-center">
        <p className="text-4xl mb-3">{emoji}</p>
        <p className="font-semibold text-gray-700 mb-2">Coming Soon</p>
        <p className="text-sm text-gray-400 max-w-xs mx-auto">{description}</p>
      </div>
    </div>
  )
}
