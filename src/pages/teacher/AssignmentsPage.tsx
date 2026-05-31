import { useNavigate } from 'react-router-dom'
import { BookOpen, Clock, X, Eye } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useTeacherOpenStories, useCloseStory } from '@/hooks/useClasses'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { getLanguageFlag, getLanguageName, getLevelLabel, formatDate } from '@/lib/utils'
import type { TeacherStoryAssignment } from '@/hooks/useClasses'

export default function AssignmentsPage() {
  const { profile } = useAuth()
  const navigate    = useNavigate()

  const { data: stories = [], isLoading } = useTeacherOpenStories(profile?.id)
  const { mutateAsync: closeStory, isPending: closing } = useCloseStory()

  if (!profile) return null

  const handleClose = async (storyId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    await closeStory({ storyId, teacherId: profile.id })
  }

  return (
    <div className="px-4 pt-10 pb-nav space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Assignments</h1>
        <p className="text-sm text-gray-500 mt-1">Active story assignments across all classes</p>
      </div>

      {isLoading && <div className="flex justify-center py-12"><LoadingSpinner size="lg" /></div>}

      {!isLoading && stories.length === 0 && (
        <div className="bg-white rounded-2xl border border-dashed border-gray-200 p-10 text-center">
          <p className="text-4xl mb-3">📖</p>
          <p className="font-semibold text-gray-700 mb-2">No active assignments</p>
          <p className="text-sm text-gray-400">
            Stories sent to a class with a due date appear here. Close them when complete.
          </p>
        </div>
      )}

      {!isLoading && stories.length > 0 && (
        <div className="space-y-3 pb-4">
          {stories.map(s => (
            <StoryAssignmentCard
              key={s.id}
              story={s}
              closing={closing}
              onClick={() => navigate(`/teacher/classes/${s.class_id}`)}
              onRead={() => navigate(`/teacher/stories/${s.id}`)}
              onClose={e => handleClose(s.id, e)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Card ─────────────────────────────────────────────────────────────────────

interface StoryAssignmentCardProps {
  story: TeacherStoryAssignment
  closing: boolean
  onClick: () => void
  onRead: () => void
  onClose: (e: React.MouseEvent) => void
}

function StoryAssignmentCard({ story, closing, onClick, onRead, onClose }: StoryAssignmentCardProps) {
  const overdue = story.due_date && new Date(story.due_date) < new Date()

  return (
    <Card interactive padding="md" onClick={onClick}>
      <div className="flex items-start gap-3">
        {/* Icon */}
        <div className="w-9 h-9 rounded-xl bg-brand-50 flex items-center justify-center shrink-0">
          <BookOpen className="w-4 h-4 text-brand-500" />
        </div>

        {/* Body */}
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm text-gray-900 truncate">{story.title}</p>

          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            {story.className && (
              <Badge variant="default">{story.className}</Badge>
            )}
            <span className="text-xs text-gray-400">
              {getLanguageFlag(story.language)} {getLanguageName(story.language)} · {getLevelLabel(story.level)}
            </span>
          </div>

          {story.due_date && (
            <div className={`flex items-center gap-1 mt-1.5 text-xs ${overdue ? 'text-red-500' : 'text-gray-400'}`}>
              <Clock className="w-3 h-3" />
              {overdue ? 'Overdue · ' : 'Due '}
              {formatDate(story.due_date)}
            </div>
          )}
        </div>

        {/* Read button */}
        <button
          onClick={e => { e.stopPropagation(); onRead() }}
          title="Read story"
          className="p-1.5 rounded-lg text-gray-400 hover:text-brand-600 hover:bg-brand-50 transition-colors shrink-0"
        >
          <Eye className="w-4 h-4" />
        </button>

        {/* Close button */}
        <button
          onClick={onClose}
          disabled={closing}
          title="Close assignment"
          className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors shrink-0 disabled:opacity-40"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </Card>
  )
}
