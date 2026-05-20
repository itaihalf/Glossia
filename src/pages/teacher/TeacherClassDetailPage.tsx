import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, UserPlus, Plus, BookOpen, Trash2, CheckCircle } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import {
  useClassDetail, useClassMembers, useRemoveMember,
  useClassVocabLists, useClassStories, useClassAssignments,
} from '@/hooks/useClasses'
import { InviteStudentSheet } from '@/components/classes/InviteStudentSheet'
import { CreateVocabListSheet } from '@/components/classes/CreateVocabListSheet'
import { TeacherStorySheet } from '@/components/classes/TeacherStorySheet'
import { CreateAssignmentSheet } from '@/components/classes/CreateAssignmentSheet'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { cn } from '@/lib/utils'
import { getLanguageFlag, getLanguageName, getLevelLabel, formatDate } from '@/lib/utils'
import type { MemberWithProfile } from '@/hooks/useClasses'

type Tab = 'members' | 'vocabulary' | 'stories' | 'assignments'

export default function TeacherClassDetailPage() {
  const { classId }  = useParams<{ classId: string }>()
  const navigate     = useNavigate()
  const { profile }  = useAuth()

  const [tab, setTab]               = useState<Tab>('members')
  const [inviteOpen, setInviteOpen] = useState(false)
  const [vocabOpen, setVocabOpen]   = useState(false)
  const [storyOpen, setStoryOpen]   = useState(false)
  const [assignOpen, setAssignOpen] = useState(false)

  const { data: cls, isLoading: clsLoading }     = useClassDetail(classId)
  const { data: members, isLoading: membLoading } = useClassMembers(classId)
  const { data: vocabLists = [], isLoading: vLoading } = useClassVocabLists(classId)
  const { data: stories = [],    isLoading: sLoading }  = useClassStories(classId)
  const { data: assignments = [], isLoading: aLoading } = useClassAssignments(classId)
  const { mutateAsync: removeMember, isPending: removing } = useRemoveMember()

  if (!profile) return null
  if (clsLoading) return <div className="flex justify-center py-20"><LoadingSpinner size="lg" /></div>
  if (!cls) return <p className="text-center text-gray-500 pt-20">Class not found.</p>

  const TABS: { id: Tab; label: string }[] = [
    { id: 'members',     label: 'Members' },
    { id: 'vocabulary',  label: 'Vocabulary' },
    { id: 'stories',     label: 'Stories' },
    { id: 'assignments', label: 'Assignments' },
  ]

  return (
    <div className="min-h-dvh">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-white/95 backdrop-blur-sm border-b border-gray-100 px-4 pt-12 pb-0">
        <div className="flex items-center gap-3 mb-3">
          <button onClick={() => navigate('/teacher/classes')}
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="font-bold text-gray-900 truncate">{cls.name}</h1>
            <p className="text-xs text-gray-400">
              {getLanguageFlag(cls.language)} {getLanguageName(cls.language)} · {getLevelLabel(cls.level)}
            </p>
          </div>
        </div>
        {/* Tabs */}
        <div className="flex gap-0 overflow-x-auto">
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={cn(
                'px-4 py-2.5 text-sm font-semibold whitespace-nowrap border-b-2 transition-colors',
                tab === t.id
                  ? 'border-brand-500 text-brand-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700',
              )}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <div className="px-4 py-5 pb-nav space-y-4">

        {/* ── Members ──────────────────────────────────────────────────────── */}
        {tab === 'members' && (
          <>
            <Button size="sm" leftIcon={<UserPlus className="w-4 h-4" />} onClick={() => setInviteOpen(true)}>
              Invite Student
            </Button>
            {membLoading && <div className="flex justify-center py-8"><LoadingSpinner /></div>}
            {!membLoading && (
              <>
                {(members?.accepted ?? []).length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-gray-500 mb-2">
                      Students ({members?.accepted.length})
                    </p>
                    <div className="space-y-2">
                      {(members?.accepted ?? []).map(m => (
                        <MemberRow key={m.id} member={m}
                          onRemove={() => removeMember({ membershipId: m.id, classId: cls.id })}
                          removing={removing} />
                      ))}
                    </div>
                  </div>
                )}
                {(members?.pending ?? []).length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-gray-500 mb-2">
                      Pending invites ({members?.pending.length})
                    </p>
                    <div className="space-y-2">
                      {(members?.pending ?? []).map(m => (
                        <MemberRow key={m.id} member={m} isPending
                          onRemove={() => removeMember({ membershipId: m.id, classId: cls.id })}
                          removing={removing} />
                      ))}
                    </div>
                  </div>
                )}
                {(members?.accepted ?? []).length === 0 && (members?.pending ?? []).length === 0 && (
                  <EmptySection emoji="👥" text="No students yet. Invite some above." />
                )}
              </>
            )}
          </>
        )}

        {/* ── Vocabulary ───────────────────────────────────────────────────── */}
        {tab === 'vocabulary' && (
          <>
            <Button size="sm" leftIcon={<Plus className="w-4 h-4" />} onClick={() => setVocabOpen(true)}>
              Create Vocab List
            </Button>
            {vLoading && <div className="flex justify-center py-8"><LoadingSpinner /></div>}
            {!vLoading && vocabLists.length === 0 && <EmptySection emoji="📚" text="No vocabulary lists yet." />}
            {!vLoading && vocabLists.map(vl => (
              <div key={vl.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                <p className="font-semibold text-gray-900 mb-2">{vl.title}</p>
                <div className="flex flex-wrap gap-1.5">
                  {(vl.words as Array<{ word: string; translation: string }>).map((w, i) => (
                    <span key={i} className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded-full">
                      {w.word} — {w.translation}
                    </span>
                  ))}
                </div>
                <p className="text-xs text-gray-400 mt-2">{formatDate(vl.created_at)}</p>
              </div>
            ))}
          </>
        )}

        {/* ── Stories ──────────────────────────────────────────────────────── */}
        {tab === 'stories' && (
          <>
            <Button size="sm" leftIcon={<Plus className="w-4 h-4" />} onClick={() => setStoryOpen(true)}>
              Create Story
            </Button>
            {sLoading && <div className="flex justify-center py-8"><LoadingSpinner /></div>}
            {!sLoading && stories.length === 0 && <EmptySection emoji="📖" text="No class stories yet." />}
            {!sLoading && stories.map((s: { id: string; title: string; level: string; created_at: string }) => (
              <div key={s.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-center gap-3">
                <BookOpen className="w-5 h-5 text-brand-400 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm text-gray-900 truncate">{s.title}</p>
                  <p className="text-xs text-gray-400">{getLevelLabel(s.level)} · {formatDate(s.created_at)}</p>
                </div>
              </div>
            ))}
          </>
        )}

        {/* ── Assignments ───────────────────────────────────────────────────── */}
        {tab === 'assignments' && (
          <>
            <Button size="sm" leftIcon={<Plus className="w-4 h-4" />} onClick={() => setAssignOpen(true)}>
              Create Assignment
            </Button>
            {aLoading && <div className="flex justify-center py-8"><LoadingSpinner /></div>}
            {!aLoading && assignments.length === 0 && <EmptySection emoji="📋" text="No assignments yet." />}
            {!aLoading && assignments.map(a => (
              <div key={a.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-center gap-3">
                <CheckCircle className="w-5 h-5 text-brand-400 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm text-gray-900">{a.title}</p>
                  <div className="flex gap-2 mt-1">
                    <Badge variant="default">{a.type}</Badge>
                    {a.due_date && <span className="text-xs text-gray-400">Due {formatDate(a.due_date)}</span>}
                  </div>
                </div>
              </div>
            ))}
          </>
        )}
      </div>

      {/* Sheets */}
      <InviteStudentSheet open={inviteOpen} onClose={() => setInviteOpen(false)} classId={cls.id} teacherProfileId={profile.id} />
      <CreateVocabListSheet open={vocabOpen} onClose={() => setVocabOpen(false)} classId={cls.id} teacherId={profile.id} language={cls.language} />
      <TeacherStorySheet open={storyOpen} onClose={() => setStoryOpen(false)} classId={cls.id} teacherId={profile.id} classLanguage={cls.language} classLevel={cls.level} />
      <CreateAssignmentSheet open={assignOpen} onClose={() => setAssignOpen(false)} classId={cls.id} teacherId={profile.id} />
    </div>
  )
}

function MemberRow({ member, onRemove, removing, isPending }: { member: MemberWithProfile; onRemove: () => void; removing: boolean; isPending?: boolean }) {
  return (
    <div className="flex items-center gap-3 bg-white rounded-xl border border-gray-100 px-3 py-2.5">
      <span className="text-xl">{member.profile?.avatar_emoji ?? '😊'}</span>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm text-gray-900 truncate">{member.profile?.nickname ?? 'Unknown'}</p>
        <p className="text-xs text-gray-400 truncate">{member.profile?.email ?? ''}</p>
      </div>
      {isPending && <Badge variant="warning">Pending</Badge>}
      <button onClick={onRemove} disabled={removing}
        className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
        <Trash2 className="w-4 h-4" />
      </button>
    </div>
  )
}

function EmptySection({ emoji, text }: { emoji: string; text: string }) {
  return (
    <div className="text-center py-10 bg-white rounded-2xl border border-dashed border-gray-200">
      <p className="text-3xl mb-2">{emoji}</p>
      <p className="text-sm text-gray-400">{text}</p>
    </div>
  )
}
