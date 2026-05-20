import { useState, useEffect } from 'react'
import { Search, AlertCircle } from 'lucide-react'
import { useFollowing, useSearchUsers, useFollow, useUnfollow } from '@/hooks/useFollow'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { UserCard } from '@/components/social/UserCard'
import type { PublicProfile } from '@/lib/types'

interface FindPeopleSheetProps {
  open: boolean
  onClose: () => void
  myProfileId: string
}

export function FindPeopleSheet({ open, myProfileId, onClose }: FindPeopleSheetProps) {
  const [query, setQuery]               = useState('')
  const [debouncedQuery, setDebounced]  = useState('')
  const [pendingId, setPendingId]       = useState<string | null>(null)

  // Debounce: wait 400 ms after the user stops typing
  useEffect(() => {
    const t = setTimeout(() => setDebounced(query), 400)
    return () => clearTimeout(t)
  }, [query])

  // Reset on close
  useEffect(() => {
    if (!open) { setQuery(''); setDebounced('') }
  }, [open])

  const { data: following = [] }                                 = useFollowing(myProfileId)
  const { data: results, isLoading, isError, isFetching }       = useSearchUsers(debouncedQuery, myProfileId)
  const { mutateAsync: follow }                                   = useFollow()
  const { mutateAsync: unfollow }                                 = useUnfollow()

  const followingIds = new Set(following.map(u => u.id))
  const hasQuery     = debouncedQuery.trim().length >= 2
  const showSpinner  = hasQuery && (isLoading || isFetching)
  const showResults  = hasQuery && !isLoading && !isFetching && !isError
  const showEmpty    = showResults && (results ?? []).length === 0
  const showError    = hasQuery && isError

  const handleToggle = async (user: PublicProfile) => {
    setPendingId(user.id)
    try {
      if (followingIds.has(user.id)) {
        await unfollow({ followerId: myProfileId, followedId: user.id })
      } else {
        await follow({ followerId: myProfileId, followedId: user.id })
      }
    } finally {
      setPendingId(null)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Find People" className="pb-6">
      <Input
        value={query}
        onChange={e => setQuery(e.target.value)}
        placeholder="Search by nickname or email…"
        autoFocus
        leftIcon={<Search className="w-4 h-4" />}
      />

      <div className="mt-4 min-h-[80px]">
        {/* Spinner */}
        {showSpinner && (
          <div className="flex justify-center py-6">
            <LoadingSpinner size="md" />
          </div>
        )}

        {/* Prompt */}
        {!hasQuery && (
          <p className="text-sm text-gray-400 text-center py-4">
            Type at least 2 characters to search.
          </p>
        )}

        {/* Error */}
        {showError && (
          <div className="flex items-start gap-2 text-sm text-red-600 bg-red-50 rounded-xl px-4 py-3 border border-red-100">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            Could not search users. Please try again.
          </div>
        )}

        {/* Empty */}
        {showEmpty && (
          <p className="text-sm text-gray-500 text-center py-4">
            No users found for &ldquo;{debouncedQuery}&rdquo;.
          </p>
        )}

        {/* Results */}
        {showResults && (results ?? []).length > 0 && (
          <div className="divide-y divide-gray-50">
            {(results ?? []).map(user => (
              <UserCard
                key={user.id}
                user={user}
                isFollowing={followingIds.has(user.id)}
                isPending={pendingId === user.id}
                onFollow={() => handleToggle(user)}
                onUnfollow={() => handleToggle(user)}
              />
            ))}
          </div>
        )}
      </div>
    </Modal>
  )
}
