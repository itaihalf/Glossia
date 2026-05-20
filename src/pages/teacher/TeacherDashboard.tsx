import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { GraduationCap, Users, Plus, ClipboardList } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { getLanguageFlag, getLanguageName } from '@/lib/utils'

// ─── Class count query ───────────────────────────────────────────────────────

function useClassCount(profileId: string | undefined) {
  return useQuery({
    queryKey: ['class-count', profileId],
    enabled: !!profileId,
    queryFn: async () => {
      const { count } = await supabase
        .from('classes')
        .select('*', { count: 'exact', head: true })
        .eq('teacher_user_id', profileId!)
      return count ?? 0
    },
  })
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

export default function TeacherDashboard() {
  const { profile, signOut } = useAuth()
  const navigate = useNavigate()
  const { data: classCount = 0 } = useClassCount(profile?.id)

  if (!profile) return null

  const hour = new Date().getHours()
  const greeting =
    hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'

  const teachingLangs = profile.teaching_languages ?? []

  return (
    <div className="px-4 pt-12 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-500">{greeting},</p>
          <h1 className="text-2xl font-bold text-gray-900">
            {profile.nickname} {profile.avatar_emoji}
          </h1>
        </div>
        <button
          onClick={signOut}
          className="text-xs text-gray-400 hover:text-gray-600 px-2 py-1 rounded-lg hover:bg-gray-100"
        >
          Sign out
        </button>
      </div>

      {/* Teaching languages */}
      {teachingLangs.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {teachingLangs.map(code => (
            <span
              key={code}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white border border-gray-200 text-sm font-medium text-gray-700"
            >
              {getLanguageFlag(code)} {getLanguageName(code)}
            </span>
          ))}
        </div>
      ) : (
        <p className="text-sm text-gray-400">No teaching languages set yet</p>
      )}

      {/* Quick stats */}
      <Card padding="md">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-brand-50 flex items-center justify-center">
            <GraduationCap className="w-6 h-6 text-brand-600" />
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900">{classCount}</p>
            <p className="text-sm text-gray-500">
              {classCount === 1 ? 'Class' : 'Classes'}
            </p>
          </div>
        </div>
      </Card>

      {/* Action buttons */}
      <div className="grid grid-cols-2 gap-3">
        <Button
          variant="primary"
          size="md"
          fullWidth
          leftIcon={<Plus className="w-4 h-4" />}
          onClick={() => navigate('/teacher/classes')}
        >
          New Class
        </Button>
        <Button
          variant="secondary"
          size="md"
          fullWidth
          leftIcon={<ClipboardList className="w-4 h-4" />}
          onClick={() => navigate('/teacher/assignments')}
        >
          Assignments
        </Button>
      </div>

      {/* My Classes */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-gray-800">My Classes</h2>
          <button
            onClick={() => navigate('/teacher/classes')}
            className="text-sm text-brand-600 font-medium"
          >
            See all
          </button>
        </div>
        {classCount === 0 ? (
          <Card padding="lg" className="text-center border-dashed">
            <p className="text-3xl mb-2">🏫</p>
            <p className="font-semibold text-gray-700 mb-1">No classes yet</p>
            <p className="text-sm text-gray-400 mb-4">
              Create a class to start inviting students and assigning stories.
            </p>
            <Button
              variant="primary"
              size="sm"
              leftIcon={<Plus className="w-4 h-4" />}
              onClick={() => navigate('/teacher/classes')}
            >
              Create first class
            </Button>
          </Card>
        ) : (
          <ClassList profileId={profile.id} />
        )}
      </div>

      {/* Recent activity */}
      <div>
        <h2 className="font-semibold text-gray-800 mb-3">Recent Activity</h2>
        <div className="bg-white rounded-2xl border border-dashed border-gray-200 px-6 py-8 text-center">
          <p className="text-3xl mb-2">📋</p>
          <p className="font-semibold text-gray-700 mb-1">No recent activity</p>
          <p className="text-sm text-gray-400">Student activity will appear here.</p>
        </div>
      </div>

      <div className="h-2" />
    </div>
  )
}

// ─── Inline class list ────────────────────────────────────────────────────────

function ClassList({ profileId }: { profileId: string }) {
  const navigate = useNavigate()
  const { data: classes = [] } = useQuery({
    queryKey: ['classes-preview', profileId],
    queryFn: async () => {
      const { data } = await supabase
        .from('classes')
        .select('id, name, language, level')
        .eq('teacher_user_id', profileId)
        .order('created_at', { ascending: false })
        .limit(3)
      return data ?? []
    },
  })

  return (
    <div className="space-y-2.5">
      {classes.map((cls: { id: string; name: string; language: string; level: string }) => (
        <Card
          key={cls.id}
          interactive
          padding="md"
          onClick={() => navigate('/teacher/classes')}
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-brand-50 flex items-center justify-center text-xl">
              {getLanguageFlag(cls.language)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-gray-900 truncate">{cls.name}</p>
              <p className="text-xs text-gray-500">
                {getLanguageName(cls.language)} · {cls.level.replace(/_/g, ' ')}
              </p>
            </div>
            <Users className="w-4 h-4 text-gray-300 shrink-0" />
          </div>
        </Card>
      ))}
    </div>
  )
}
