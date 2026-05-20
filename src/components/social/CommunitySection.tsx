import { useState } from 'react'
import { Users } from 'lucide-react'
import { useFollowing, useUnfollow } from '@/hooks/useFollow'
import { FindPeopleSheet } from '@/components/social/FindPeopleSheet'
import { UserCard } from '@/components/social/UserCard'
import { Button } from '@/components/ui/Button'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import type { PublicProfile } from '@/lib/types'

interface CommunitySectionProps {
  profileId: string
}

export function CommunitySection({ profileId }: CommunitySectionProps) {
  const [findOpen, setFindOpen]   = useState(false)
  const [pendingId, setPendingId] = useState<string | null>(null)

  const { data: following = [], isLoading } = useFollowing(profileId)
  const { mutateAsync: unfollow }            = useUnfollow()

  const handleUnfollow = async (user: PublicProfile) => {
    setPendingId(user.id)
    try {
      await unfollow({ followerId: profileId, followedId: user.id })
    } finally {
      setPendingId(null)
    }
  }

  return (
    <>
      {/* Section card */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-4 py-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-brand-500" />
            <p className="text-xs font-medium text-gray-500">
              Following
              {following.length > 0 && (
                <span className="ml-1 bg-brand-100 text-brand-700 text-[10px] font-semibold px-1.5 py-0.5 rounded-full">
                  {following.length}
                </span>
              )}
            </p>
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setFindOpen(true)}
          >
            Find People
          </Button>
        </div>

        {isLoading && (
          <div className="flex justify-center py-4">
            <LoadingSpinner size="sm" />
          </div>
        )}

        {!isLoading && following.length === 0 && (
          <p className="text-sm text-gray-400 text-center py-3">
            You&apos;re not following anyone yet.
          </p>
        )}

        {!isLoading && following.length > 0 && (
          <div className="divide-y divide-gray-50">
            {following.map(user => (
              <UserCard
                key={user.id}
                user={user}
                isFollowing={true}
                isPending={pendingId === user.id}
                onFollow={() => { /* already following */ }}
                onUnfollow={() => handleUnfollow(user)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Find People sheet */}
      <FindPeopleSheet
        open={findOpen}
        onClose={() => setFindOpen(false)}
        myProfileId={profileId}
      />
    </>
  )
}
