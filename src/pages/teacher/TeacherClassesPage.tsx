import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Users, ChevronRight } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useTeacherClasses } from '@/hooks/useClasses'
import { CreateClassSheet } from '@/components/classes/CreateClassSheet'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { getLanguageFlag, getLanguageName, getLevelLabel } from '@/lib/utils'
import type { ClassWithCount } from '@/hooks/useClasses'

export default function TeacherClassesPage() {
  const { profile } = useAuth()
  const navigate    = useNavigate()
  const [createOpen, setCreateOpen] = useState(false)

  const { data: classes = [], isLoading } = useTeacherClasses(profile?.id)

  if (!profile) return null

  const handleCreated = (classId: string) => navigate(`/teacher/classes/${classId}`)

  return (
    <div className="px-4 pt-10 space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">My Classes</h1>
        <button onClick={() => setCreateOpen(true)}
          className="w-9 h-9 rounded-xl bg-brand-500 text-white flex items-center justify-center hover:bg-brand-600 active:scale-95 transition-all shadow-sm shadow-brand-500/30">
          <Plus className="w-5 h-5" />
        </button>
      </div>

      {isLoading && <div className="flex justify-center py-12"><LoadingSpinner size="lg" /></div>}

      {!isLoading && classes.length === 0 && (
        <div className="bg-white rounded-2xl border border-dashed border-gray-200 p-10 text-center">
          <p className="text-4xl mb-3">🏫</p>
          <p className="font-semibold text-gray-700 mb-2">No classes yet</p>
          <p className="text-sm text-gray-400 mb-5">Create your first class to start inviting students.</p>
          <Button size="sm" leftIcon={<Plus className="w-4 h-4" />} onClick={() => setCreateOpen(true)}>
            Create first class
          </Button>
        </div>
      )}

      {!isLoading && classes.length > 0 && (
        <div className="space-y-3 pb-4">
          {classes.map(cls => <ClassCard key={cls.id} cls={cls} onClick={() => navigate(`/teacher/classes/${cls.id}`)} />)}
        </div>
      )}

      <CreateClassSheet
        open={createOpen} onClose={() => setCreateOpen(false)}
        teacherId={profile.id}
        teachingLanguages={profile.teaching_languages ?? []}
        onCreated={handleCreated}
      />
    </div>
  )
}

function ClassCard({ cls, onClick }: { cls: ClassWithCount; onClick: () => void }) {
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
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="flex items-center gap-1 text-xs text-gray-400">
            <Users className="w-3.5 h-3.5" />{cls.member_count}
          </span>
          <ChevronRight className="w-4 h-4 text-gray-300" />
        </div>
      </div>
    </Card>
  )
}
