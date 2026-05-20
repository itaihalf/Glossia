import { useState, useEffect } from 'react'
import { Search, UserPlus, Check, AlertCircle } from 'lucide-react'
import { useSearchUsers } from '@/hooks/useFollow'
import { useInviteStudent, useClassMembers } from '@/hooks/useClasses'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { cn } from '@/lib/utils'
import type { PublicProfile } from '@/lib/types'

interface InviteStudentSheetProps {
  open: boolean
  onClose: () => void
  classId: string
  teacherProfileId: string
}

export function InviteStudentSheet({ open, onClose, classId, teacherProfileId }: InviteStudentSheetProps) {
  const [query, setQuery]        = useState('')
  const [debounced, setDebounced] = useState('')
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [invitedIds, setInvitedIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query), 400)
    return () => clearTimeout(t)
  }, [query])

  useEffect(() => { if (!open) { setQuery(''); setDebounced(''); setInvitedIds(new Set()) } }, [open])

  const { data: searchResults, isLoading, isError, isFetching } = useSearchUsers(debounced, teacherProfileId)
  const { data: members } = useClassMembers(classId)
  const { mutateAsync: invite } = useInviteStudent()

  // Already invited or accepted members
  const existingIds = new Set([
    ...(members?.accepted ?? []).map(m => m.student_user_id),
    ...(members?.pending  ?? []).map(m => m.student_user_id),
  ])

  const students = (searchResults ?? []).filter(u => u.account_type === 'student')
  const hasQuery = debounced.trim().length >= 2

  const handleInvite = async (user: PublicProfile) => {
    setPendingId(user.id)
    try {
      await invite({ class_id: classId, student_user_id: user.id, invited_by_teacher_id: teacherProfileId })
      setInvitedIds(s => new Set([...s, user.id]))
    } finally {
      setPendingId(null)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Invite a Student">
      <Input
        value={query} onChange={e => setQuery(e.target.value)}
        placeholder="Search student by nickname or email…"
        autoFocus leftIcon={<Search className="w-4 h-4" />}
      />

      <div className="mt-4 min-h-[80px]">
        {(isLoading || isFetching) && hasQuery && (
          <div className="flex justify-center py-6"><LoadingSpinner size="md" /></div>
        )}
        {!hasQuery && <p className="text-sm text-gray-400 text-center py-4">Type at least 2 characters.</p>}
        {hasQuery && isError && (
          <div className="flex items-start gap-2 text-sm text-red-600 bg-red-50 rounded-xl px-4 py-3 border border-red-100">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            Could not search students. Please try again.
          </div>
        )}
        {!isLoading && !isFetching && hasQuery && !isError && students.length === 0 && (
          <p className="text-sm text-gray-500 text-center py-4">No students found.</p>
        )}
        {!isLoading && !isFetching && students.length > 0 && (
          <div className="divide-y divide-gray-50">
            {students.map(user => {
              const alreadyIn = existingIds.has(user.id)
              const justInvited = invitedIds.has(user.id)
              const loading = pendingId === user.id
              return (
                <div key={user.id} className="flex items-center gap-3 py-3">
                  <div className="w-9 h-9 rounded-xl bg-brand-100 flex items-center justify-center text-lg shrink-0">
                    {user.avatar_emoji}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm text-gray-900 truncate">{user.nickname}</p>
                    <p className="text-xs text-gray-400 truncate">{user.email}</p>
                  </div>
                  <button
                    disabled={alreadyIn || justInvited || loading}
                    onClick={() => handleInvite(user)}
                    className={cn(
                      'shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all',
                      alreadyIn || justInvited
                        ? 'bg-gray-100 text-gray-400 cursor-default'
                        : 'bg-brand-500 text-white hover:bg-brand-600 active:scale-95',
                      loading && 'opacity-50 cursor-not-allowed',
                    )}
                  >
                    {loading ? <LoadingSpinner size="sm" /> :
                     alreadyIn ? <><Check className="w-3.5 h-3.5" />In class</> :
                     justInvited ? <><Check className="w-3.5 h-3.5" />Invited</> :
                     <><UserPlus className="w-3.5 h-3.5" />Invite</>}
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </Modal>
  )
}
