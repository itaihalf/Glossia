import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, BookOpen, CheckCircle, Clock } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useStories } from '@/hooks/useStories'
import { CreateStorySheet } from '@/components/stories/CreateStorySheet'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { getLanguageFlag, getLanguageName, getLevelLabel, formatDate } from '@/lib/utils'
import type { Story } from '@/lib/types'

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function StoriesPage() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [createOpen, setCreateOpen] = useState(false)

  const lang = profile?.current_learning_language ?? ''
  const { data: stories = [], isLoading } = useStories(profile?.id, lang)

  if (!profile) return null

  return (
    <div className="px-4 pt-10 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My Stories</h1>
          {lang && (
            <p className="text-sm text-gray-500 mt-0.5">
              {getLanguageFlag(lang)} {getLanguageName(lang)}
            </p>
          )}
        </div>
        <button
          onClick={() => setCreateOpen(true)}
          className="w-9 h-9 rounded-xl bg-brand-500 text-white flex items-center justify-center hover:bg-brand-600 active:scale-95 transition-all shadow-sm shadow-brand-500/30"
          title="Create story"
        >
          <Plus className="w-5 h-5" />
        </button>
      </div>

      {/* No language set */}
      {!lang && (
        <div className="bg-white rounded-2xl border border-dashed border-gray-200 p-10 text-center">
          <p className="text-4xl mb-3">🌍</p>
          <p className="font-semibold text-gray-700 mb-2">No learning language set</p>
          <p className="text-sm text-gray-400 mb-5">
            Set your learning language in Profile to start reading AI-generated stories.
          </p>
          <Button size="sm" onClick={() => navigate('/student/profile')}>Go to Profile</Button>
        </div>
      )}

      {/* Loading */}
      {lang && isLoading && (
        <div className="flex justify-center py-12">
          <LoadingSpinner size="lg" />
        </div>
      )}

      {/* Create story CTA (when no stories yet) */}
      {lang && !isLoading && stories.length === 0 && (
        <div className="bg-white rounded-2xl border border-dashed border-gray-200 p-10 text-center">
          <p className="text-4xl mb-3">✨</p>
          <p className="font-semibold text-gray-700 mb-2">No stories yet</p>
          <p className="text-sm text-gray-400 mb-5">
            Your AI-generated stories will appear here. Tap the + to create your first one.
          </p>
          <Button
            size="sm"
            leftIcon={<Plus className="w-4 h-4" />}
            onClick={() => setCreateOpen(true)}
          >
            Create first story
          </Button>
        </div>
      )}

      {/* Story list */}
      {lang && !isLoading && stories.length > 0 && (
        <div className="space-y-3 pb-4">
          {stories.map(story => (
            <StoryCard
              key={story.id}
              story={story}
              onClick={() => navigate(`/student/stories/${story.id}`)}
            />
          ))}
        </div>
      )}

      {/* Create Story Sheet */}
      <CreateStorySheet
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        profile={profile}
      />
    </div>
  )
}

// ─── Story card ───────────────────────────────────────────────────────────────

function StoryCard({ story, onClick }: { story: Story; onClick: () => void }) {
  const wordCount = story.content.split(/\s+/).length

  return (
    <Card interactive padding="md" onClick={onClick}>
      <div className="flex items-start gap-3">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
          story.completed ? 'bg-emerald-100' : 'bg-brand-100'
        }`}>
          {story.completed
            ? <CheckCircle className="w-5 h-5 text-emerald-600" />
            : <BookOpen className="w-5 h-5 text-brand-600" />
          }
        </div>

        <div className="flex-1 min-w-0">
          <p className="font-semibold text-gray-900 leading-tight mb-1">{story.title}</p>

          <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
            <Badge variant={story.completed ? 'success' : 'primary'}>
              {story.completed ? 'Completed' : 'Unread'}
            </Badge>
            <span className="text-xs text-gray-400">{getLevelLabel(story.level)}</span>
            <span className="text-xs text-gray-300">·</span>
            <span className="text-xs text-gray-400">{wordCount} words</span>
          </div>

          <div className="flex items-center gap-1 text-xs text-gray-400">
            <Clock className="w-3 h-3" />
            {formatDate(story.created_at)}
          </div>
        </div>
      </div>
    </Card>
  )
}
