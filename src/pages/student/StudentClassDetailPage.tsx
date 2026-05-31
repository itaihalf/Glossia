import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, BookOpen, CheckCircle, Clock, LogOut } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import {
  useClassDetail, useStudentClasses,
  useClassVocabLists, useClassStories, useStudentAssignments,
  useImportVocabToWordBank, useLeaveClass, useMarkAssignmentComplete,
} from '@/hooks/useClasses'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { getLanguageFlag, getLanguageName, getLevelLabel, formatDate } from '@/lib/utils'
import type { VocabularyList } from '@/lib/types'

export default function StudentClassDetailPage() {
  const { classId }  = useParams<{ classId: string }>()
  const navigate     = useNavigate()
  const { profile }  = useAuth()

  const { data: cls }           = useClassDetail(classId)
  const { data: myClasses = [] } = useStudentClasses(profile?.id)
  const { data: vocabLists = [], isLoading: vLoad } = useClassVocabLists(classId)
  const { data: stories = [],    isLoading: sLoad }  = useClassStories(classId)

  // Assignments for this specific class
  const myClassIds = myClasses.map(c => c.id)
  const { data: assignments = [], isLoading: aLoad } = useStudentAssignments(profile?.id, myClassIds)
  const classAssignments = assignments.filter((a: { class_id: string }) => a.class_id === classId)

  const { mutateAsync: importVocab, isPending: importing } = useImportVocabToWordBank()
  const { mutateAsync: leave,       isPending: leaving }    = useLeaveClass()
  const { mutateAsync: complete,    isPending: completing } = useMarkAssignmentComplete()

  const [importedIds, setImportedIds]     = useState<Set<string>>(new Set())
  const [importResult, setImportResult]   = useState<{ added: number; total: number } | null>(null)
  const [completingId, setCompletingId]   = useState<string | null>(null)

  if (!profile) return null
  if (!cls) return <div className="flex justify-center py-20"><LoadingSpinner size="lg" /></div>

  const membership = myClasses.find(c => c.id === classId)

  const handleImportVocab = async (vocabList: VocabularyList) => {
    try {
      const result = await importVocab({ vocabList, profileId: profile.id })
      setImportedIds(s => new Set([...s, vocabList.id]))
      setImportResult(result)
      setTimeout(() => setImportResult(null), 4000)
    } catch { /* silently fail */ }
  }

  const handleLeaveClass = async () => {
    if (!membership?.membershipId) return
    await leave({ membershipId: membership.membershipId, studentId: profile.id })
    navigate('/student/classes')
  }

  const handleComplete = async (assignmentId: string) => {
    setCompletingId(assignmentId)
    try { await complete({ assignmentId, studentId: profile.id }) }
    finally { setCompletingId(null) }
  }

  return (
    <div className="min-h-dvh">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white/95 backdrop-blur-sm border-b border-gray-100 px-4 pt-12 pb-3">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/student/classes')}
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
      </div>

      <div className="px-4 py-5 pb-nav space-y-6">
        {/* Import result toast */}
        {importResult && (
          <div className="bg-emerald-50 rounded-xl border border-emerald-100 px-4 py-3 text-sm text-emerald-700">
            ✓ Added {importResult.added} word{importResult.added !== 1 ? 's' : ''} to your word bank
            {importResult.total - importResult.added > 0 && ` (${importResult.total - importResult.added} already in bank)`}
          </div>
        )}

        {/* Vocabulary lists */}
        <section>
          <h2 className="font-semibold text-gray-800 mb-3">Vocabulary Lists</h2>
          {vLoad && <div className="flex justify-center py-4"><LoadingSpinner /></div>}
          {!vLoad && vocabLists.length === 0 && (
            <p className="text-sm text-gray-400">No vocabulary lists yet.</p>
          )}
          {!vLoad && vocabLists.map(vl => (
            <div key={vl.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 mb-3">
              <div className="flex items-start justify-between gap-3 mb-2">
                <p className="font-semibold text-gray-900">{vl.title}</p>
                <Button size="sm" variant="secondary"
                  loading={importing && !importedIds.has(vl.id)}
                  disabled={importedIds.has(vl.id)}
                  onClick={() => handleImportVocab(vl)}>
                  {importedIds.has(vl.id) ? '✓ Added' : 'Add to Word Bank'}
                </Button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {(vl.words as Array<{ word: string; translation: string }>).map((w, i) => (
                  <span key={i} className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded-full">
                    {w.word}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </section>

        {/* Class stories */}
        <section>
          <h2 className="font-semibold text-gray-800 mb-3">Stories</h2>
          {sLoad && <div className="flex justify-center py-4"><LoadingSpinner /></div>}
          {!sLoad && stories.length === 0 && (
            <p className="text-sm text-gray-400">No stories assigned yet.</p>
          )}
          {!sLoad && stories.map((s: { id: string; title: string; level: string; created_at: string; due_date?: string | null }) => {
            const overdue = s.due_date && new Date(s.due_date) < new Date()
            return (
              <button key={s.id}
                onClick={() => navigate(`/student/stories/${s.id}`)}
                className="w-full flex items-center gap-3 bg-white rounded-2xl border border-gray-100 shadow-sm p-4 mb-3 text-left hover:border-brand-200 transition-colors">
                <BookOpen className="w-5 h-5 text-brand-400 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm text-gray-900 truncate">{s.title}</p>
                  <p className="text-xs text-gray-400">{getLevelLabel(s.level)} · {formatDate(s.created_at)}</p>
                  {s.due_date && (
                    <div className={`flex items-center gap-1 mt-0.5 text-xs ${overdue ? 'text-red-500' : 'text-gray-400'}`}>
                      <Clock className="w-3 h-3" />
                      Due {formatDate(s.due_date)}
                    </div>
                  )}
                </div>
              </button>
            )
          })}
        </section>

        {/* Assignments */}
        <section>
          <h2 className="font-semibold text-gray-800 mb-3">Assignments</h2>
          {aLoad && <div className="flex justify-center py-4"><LoadingSpinner /></div>}
          {!aLoad && classAssignments.length === 0 && (
            <p className="text-sm text-gray-400">No assignments yet.</p>
          )}
          {!aLoad && classAssignments.map((a: { id: string; title: string; type: string; due_date: string | null; studentCompleted: boolean }) => (
            <div key={a.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 mb-3 flex items-center gap-3">
              <CheckCircle className={`w-5 h-5 shrink-0 ${a.studentCompleted ? 'text-emerald-500' : 'text-gray-300'}`} />
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm text-gray-900">{a.title}</p>
                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                  <Badge variant="default">{a.type}</Badge>
                  {a.due_date && (
                    <span className="flex items-center gap-1 text-xs text-gray-400">
                      <Clock className="w-3 h-3" />Due {formatDate(a.due_date)}
                    </span>
                  )}
                </div>
              </div>
              {!a.studentCompleted && (
                <Button size="sm" variant="secondary"
                  loading={completingId === a.id && completing}
                  onClick={() => handleComplete(a.id)}>
                  Mark done
                </Button>
              )}
            </div>
          ))}
        </section>

        {/* Leave class */}
        <button onClick={handleLeaveClass} disabled={leaving}
          className="w-full flex items-center justify-center gap-2 py-3 text-sm text-gray-400 hover:text-red-500 transition-colors">
          <LogOut className="w-4 h-4" /> Leave this class
        </button>
      </div>
    </div>
  )
}
