import { useState } from 'react'
import { Bell, Check, X } from 'lucide-react'
import { usePendingInvites, useRespondToInvite } from '@/hooks/useClasses'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { getLanguageFlag, getLanguageName, getLevelLabel } from '@/lib/utils'
import type { PendingInvite } from '@/hooks/useClasses'

interface InvitationsModalProps {
  open: boolean
  onClose: () => void
  studentId: string
}

export function InvitationsModal({ open, onClose, studentId }: InvitationsModalProps) {
  const { data: invites = [], isLoading } = usePendingInvites(studentId)
  const { mutateAsync: respond, isPending } = useRespondToInvite()
  const [pendingId, setPendingId] = useState<string | null>(null)

  const handleRespond = async (invite: PendingInvite, status: 'accepted' | 'rejected') => {
    setPendingId(invite.membershipId)
    try {
      await respond({ membershipId: invite.membershipId, status, studentId })
    } finally {
      setPendingId(null)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Class Invitations">
      {isLoading && <div className="flex justify-center py-8"><LoadingSpinner /></div>}

      {!isLoading && invites.length === 0 && (
        <div className="text-center py-8">
          <Bell className="w-8 h-8 text-gray-200 mx-auto mb-2" />
          <p className="text-sm text-gray-500">No pending invitations.</p>
        </div>
      )}

      {!isLoading && invites.length > 0 && (
        <div className="space-y-3">
          {invites.map(invite => (
            <div key={invite.membershipId}
              className="bg-gray-50 rounded-2xl p-4 border border-gray-100">
              <div className="flex items-center gap-3 mb-3">
                <span className="text-2xl">{invite.teacherAvatar}</span>
                <div>
                  <p className="font-semibold text-sm text-gray-900">{invite.className}</p>
                  <p className="text-xs text-gray-500">
                    {getLanguageFlag(invite.language)} {getLanguageName(invite.language)} ·{' '}
                    {getLevelLabel(invite.level)} · by {invite.teacherNickname}
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="secondary" size="sm" fullWidth
                  loading={pendingId === invite.membershipId && isPending}
                  disabled={!!pendingId}
                  leftIcon={<X className="w-3.5 h-3.5" />}
                  onClick={() => handleRespond(invite, 'rejected')}>
                  Decline
                </Button>
                <Button size="sm" fullWidth
                  loading={pendingId === invite.membershipId && isPending}
                  disabled={!!pendingId}
                  leftIcon={<Check className="w-3.5 h-3.5" />}
                  onClick={() => handleRespond(invite, 'accepted')}>
                  Accept
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </Modal>
  )
}
