import { useNavigate } from 'react-router-dom'
import { BookOpen, Archive, Clock } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useTeacherAssignments } from '@/hooks/useClasses'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { formatDate } from '@/lib/utils'
import type { AssignmentWithClass } from '@/hooks/useClasses'

export default function AssignmentsPage() {
  const { profile } = useAuth()
  const navigate    = useNavigate()
  const { data: assignments = [], isLoading } = useTeacherAssignments(profile?.id)

  if (!profile) return null

  return (
    <div className="px-4 pt-10 space-y-5">
      <h1 className="text-2xl font-bold text-gray-900">Assignments</h1>
      <p className="text-sm text-gray-500 -mt-3">All assignments across your classes</p>

      {isLoading && <div className="flex justify-center py-12"><LoadingSpinner size="lg" /></div>}

      {!isLoading && assignments.length === 0 && (
        <div className="bg-white rounded-2xl border border-dashed border-gray-200 p-10 text-center">
          <p className="text-4xl mb-3">📋</p>
          <p className="font-semibold text-gray-700 mb-2">No assignments yet</p>
          <p className="text-sm text-gray-400 mb-5">Create assignments from inside a class.</p>
        </div>
      )}

      {!isLoading && assignments.length > 0 && (
        <div className="space-y-3 pb-4">
          {assignments.map(a => (
            <AssignmentRow key={a.id} assignment={a}
              onClick={() => navigate(`/teacher/classes/${a.class_id}`)} />
          ))}
        </div>
      )}
    </div>
  )
}

function AssignmentRow({ assignment, onClick }: { assignment: AssignmentWithClass; onClick: () => void }) {
  const Icon = assignment.type === 'story' ? BookOpen : Archive
  return (
    <Card interactive padding="md" onClick={onClick}>
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-xl bg-gray-100 flex items-center justify-center shrink-0">
          <Icon className="w-4 h-4 text-gray-500" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm text-gray-900 truncate">{assignment.title}</p>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            {assignment.className && (
              <Badge variant="default">{assignment.className}</Badge>
            )}
            <Badge variant={assignment.type === 'story' ? 'primary' : 'default'}>
              {assignment.type}
            </Badge>
          </div>
        </div>
        {assignment.due_date && (
          <div className="flex items-center gap-1 text-xs text-gray-400 shrink-0">
            <Clock className="w-3 h-3" />
            {formatDate(assignment.due_date)}
          </div>
        )}
      </div>
    </Card>
  )
}

