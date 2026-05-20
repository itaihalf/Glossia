import { UserPlus, UserCheck, Loader2 } from 'lucide-react'
import { getLanguageFlag, getLanguageName } from '@/lib/utils'
import { cn } from '@/lib/utils'
import type { PublicProfile } from '@/lib/types'

interface UserCardProps {
  user: PublicProfile
  isFollowing: boolean
  isPending: boolean
  onFollow: () => void
  onUnfollow: () => void
}

export function UserCard({ user, isFollowing, isPending, onFollow, onUnfollow }: UserCardProps) {
  const isStudent = user.account_type === 'student'
  const langDisplay = isStudent && user.current_learning_language
    ? `${getLanguageFlag(user.current_learning_language)} Learning ${getLanguageName(user.current_learning_language)}`
    : !isStudent && user.teaching_languages.length > 0
      ? `Teaching ${user.teaching_languages.map(l => getLanguageName(l)).join(', ')}`
      : null

  return (
    <div className="flex items-center gap-3 py-3">
      {/* Avatar */}
      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-100 to-brand-200 flex items-center justify-center text-xl shrink-0">
        {user.avatar_emoji}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-sm text-gray-900 truncate">{user.nickname}</p>
        {langDisplay && (
          <p className="text-xs text-gray-400 truncate">{langDisplay}</p>
        )}
      </div>

      {/* Follow / Unfollow */}
      <button
        disabled={isPending}
        onClick={isFollowing ? onUnfollow : onFollow}
        className={cn(
          'shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold',
          'transition-all duration-150 active:scale-95',
          isPending && 'opacity-50 cursor-not-allowed',
          isFollowing
            ? 'border border-gray-200 bg-white text-gray-500 hover:border-red-200 hover:text-red-500 hover:bg-red-50'
            : 'bg-brand-500 text-white hover:bg-brand-600 shadow-sm shadow-brand-500/20',
        )}
      >
        {isPending ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : isFollowing ? (
          <><UserCheck className="w-3.5 h-3.5" />Following</>
        ) : (
          <><UserPlus className="w-3.5 h-3.5" />Follow</>
        )}
      </button>
    </div>
  )
}
