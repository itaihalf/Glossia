import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell, Users, ChevronRight } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useStudentClasses, usePendingInvites } from '@/hooks/useClasses'
import { InvitationsModal } from '@/components/classes/InvitationsModal'
import { Card } from '@/components/ui/Card'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { getLanguageFlag, getLanguageName, getLevelLabel } from '@/lib/utils'
import type { StudentClass } from '@/hooks/useClasses'

export default function ClassesPage() {
  const { profile }  = useAuth()
  const navigate     = useNavigate()
  const [invitesOpen, setInvitesOpen] = useState(false)

  const { data: classes = [],  isLoading: classLoading } = useStudentClasses(profile?.id)
  const { data: invites = [],  isLoading: inviteLoading } = usePendingInvites(profile?.id)

  if (!profile) return null

  const inviteCount = invites.length

  return (
    <div className="px-4 pt-10 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">My Classes</h1>
        <button onClick={() => setInvitesOpen(true)}
          className="relative p-2 rounded-xl hover:bg-gray-100 text-gray-500 transition-colors"
          title="Class invitations">
          <Bell className="w-5 h-5" />
          {!inviteLoading && inviteCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 w-5 h-5 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
              {inviteCount}
            </span>
          )}
        </button>
      </div>

      {/* Loading */}
      {classLoading && <div className="flex justify-center py-12"><LoadingSpinner size="lg" /></div>}

      {/* Empty */}
      {!classLoading && classes.length === 0 && (
        <div className="bg-white rounded-2xl border border-dashed border-gray-200 p-10 text-center">
          <p className="text-4xl mb-3">🏫</p>
          <p className="font-semibold text-gray-700 mb-2">No classes yet</p>
          <p className="text-sm text-gray-400">
            Ask your teacher to invite you, or tap the bell icon to check pending invitations.
          </p>
        </div>
      )}

      {/* Class list */}
      {!classLoading && classes.length > 0 && (
        <div className="space-y-3 pb-4">
          {classes.map(cls => (
            <ClassCard key={cls.id} cls={cls}
              onClick={() => navigate(`/student/classes/${cls.id}`)} />
          ))}
        </div>
      )}

      {/* Invitations modal */}
      <InvitationsModal
        open={invitesOpen}
        onClose={() => setInvitesOpen(false)}
        studentId={profile.id}
      />
    </div>
  )
}

function ClassCard({ cls, onClick }: { cls: StudentClass; onClick: () => void }) {
  return (
    <Card interactive padding="md" onClick={onClick}>
      <div className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-xl bg-brand-50 flex items-center justify-center text-2xl shrink-0">
          {getLanguageFlag(cls.language)}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-gray-900">{cls.name}</p>
          <p className="text-xs text-gray-500">
            {getLanguageName(cls.language)} · {getLevelLabel(cls.level)}
          </p>
          {cls.teacher && (
            <p className="text-xs text-gray-400 mt-0.5">
              {cls.teacher.avatar_emoji} {cls.teacher.nickname}
            </p>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Users className="w-4 h-4 text-gray-300" />
          <ChevronRight className="w-4 h-4 text-gray-300" />
        </div>
      </div>
    </Card>
  )
}
