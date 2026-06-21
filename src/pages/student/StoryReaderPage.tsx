import { useState, useRef, useCallback, useMemo, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, CheckCircle, Volume2, VolumeX } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useStory, useCompleteStory, type CompletionResult } from '@/hooks/useStories'
import { useUpdateReadingStats } from '@/hooks/useClasses'
import { useAddWord, useWordBankItems, useUpdateWordStatus } from '@/hooks/useWordBank'
import { normalizeWord, type NormalizedWord } from '@/lib/ai'
import { WordPopupSheet, type WordLookupState, type AddState, type TransferState } from '@/components/stories/WordPopupSheet'
import { FinishedReadingSheet } from '@/components/stories/FinishedReadingSheet'
import { FlashcardSession } from '@/components/review/FlashcardSession'
import { Button } from '@/components/ui/Button'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { cn } from '@/lib/utils'
import { getLevelLabel, getLanguageName, isRTLLanguage } from '@/lib/utils'
import { fetchStoryAudio, stopStoryAudio } from '@/lib/tts'

// ─── Translation mode ─────────────────────────────────────────────────────────

type TranslationMode = 'original' | 'translation' | 'both'

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function StoryReaderPage() {
  const { storyId } = useParams<{ storyId: string }>()
  const navigate = useNavigate()
  const { profile, refreshProfile } = useAuth()

  const { data: story, isLoading } = useStory(storyId)
  const { mutateAsync: completeStory,     isPending: isCompleting }  = useCompleteStory()
  const { mutateAsync: updateReadingStats, isPending: isUpdating }   = useUpdateReadingStats()
  const { mutateAsync: addWord } = useAddWord()
  const { mutateAsync: updateWordStatus } = useUpdateWordStatus()

  // Fetch learning and known words for this story's language
  const { data: learningWords } = useWordBankItems(profile?.id, story?.language ?? '', 'learning')
  const { data: knownWords }    = useWordBankItems(profile?.id, story?.language ?? '', 'known')

  // Practice word set — highlighted in the reader
  const practiceSet = useMemo(() => {
    const set = new Set<string>()
    for (const entry of learningWords ?? []) {
      set.add(entry.base_form.toLowerCase())
      for (const form of entry.encountered_forms ?? []) {
        set.add(form.toLowerCase())
      }
    }
    return set
  }, [learningWords])

  // Map of base_form → { id, status } for all saved words
  const wordBankMap = useMemo(() => {
    const map = new Map<string, { id: string; status: 'learning' | 'known' }>()
    for (const entry of learningWords ?? []) map.set(entry.base_form.toLowerCase(), { id: entry.id, status: 'learning' })
    for (const entry of knownWords ?? [])    map.set(entry.base_form.toLowerCase(), { id: entry.id, status: 'known' })
    return map
  }, [learningWords, knownWords])

  // TTS reading state — the component owns the active browser Audio object
  const [isReading, setIsReading] = useState(false)
  const [isAudioLoading, setIsAudioLoading] = useState(false)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  const stopReading = useCallback(() => {
    stopStoryAudio(audioRef.current)
    audioRef.current = null
    setIsReading(false)
  }, [])

  const handleReadStory = useCallback(async () => {
    if (!story || isAudioLoading) return

    // Already playing → stop directly via the stored Audio object
    if (isReading) {
      stopReading()
      return
    }

    setIsAudioLoading(true)
    try {
      const audio = await fetchStoryAudio(story.content, story.language)
      audioRef.current = audio
      audio.onended = () => {
        if (audioRef.current === audio) stopReading()
      }
      audio.onerror = () => {
        if (audioRef.current === audio) stopReading()
      }
      setIsReading(true)
      await audio.play()
    } catch {
      stopReading()
    } finally {
      setIsAudioLoading(false)
    }
  }, [isReading, isAudioLoading, story, stopReading])

  // Stop any in-progress playback when leaving the page
  useEffect(() => stopReading, [stopReading])

  // Translation mode
  const [mode, setMode] = useState<TranslationMode>('original')

  // Word popup state
  const [activeWord, setActiveWord]     = useState<string | null>(null)
  const [popupState, setPopupState]     = useState<WordLookupState>({ phase: 'closed' })
  const [addState, setAddState]         = useState<AddState>('idle')
  const [transferState, setTransferState] = useState<TransferState>('idle')
  const wordCache = useRef<Map<string, NormalizedWord>>(new Map())

  // Existing bank entry for the word currently shown in the popup
  const existingWordEntry = useMemo(() => {
    if (popupState.phase !== 'result') return null
    return wordBankMap.get(popupState.baseForm.toLowerCase()) ?? null
  }, [popupState, wordBankMap])

  // Completion state — finishedOpen is derived so it's always in sync with the result
  const [completionResult, setCompletionResult] = useState<CompletionResult | null>(null)
  const finishedOpen = completionResult !== null
  const [completeError, setCompleteError]       = useState<string | null>(null)
  const [flashcardOpen, setFlashcardOpen]       = useState(false)

  // ── Word click handler ──────────────────────────────────────────────────────

  const handleWordClick = useCallback(async (word: string, contextText: string) => {
    if (!story) return
    setActiveWord(word)
    setAddState('idle')
    setTransferState('idle')

    // Serve from cache if available
    const cached = wordCache.current.get(word)
    if (cached) {
      setPopupState({
        phase: 'result',
        word,
        baseForm: cached.base_form,
        translation: cached.translation,
        pos: cached.part_of_speech,
        example: cached.example_sentence,
      })
      return
    }

    setPopupState({ phase: 'loading', word })

    try {
      const result = await normalizeWord(word, story.language, contextText)
      wordCache.current.set(word, result)
      setPopupState({
        phase: 'result',
        word,
        baseForm: result.base_form,
        translation: result.translation,
        pos: result.part_of_speech,
        example: result.example_sentence,
      })
    } catch (err) {
      setPopupState({
        phase: 'error',
        word,
        message: err instanceof Error ? err.message : 'Could not look up this word.',
      })
    }
  }, [story])

  // ── Add to word bank ────────────────────────────────────────────────────────

  const handleAddToWordBank = useCallback(async () => {
    if (popupState.phase !== 'result' || !profile || !story) return
    setAddState('adding')
    try {
      await addWord({
        user_id: profile.id,
        language: story.language,
        word: popupState.baseForm,
        base_form: popupState.baseForm,
        translation: popupState.translation,
        example_sentence: popupState.example || null,
        encountered_forms:
          popupState.baseForm !== popupState.word ? [popupState.word] : [],
      })
      setAddState('added')
    } catch (err) {
      setAddState(err instanceof Error && err.message === 'DUPLICATE' ? 'duplicate' : 'error')
    }
  }, [popupState, profile, story, addWord])

  // ── Transfer known → learning ───────────────────────────────────────────────

  const handleTransferToLearning = useCallback(async () => {
    if (!existingWordEntry || !profile || !story) return
    setTransferState('transferring')
    try {
      await updateWordStatus({
        id: existingWordEntry.id,
        userId: profile.id,
        language: story.language,
        status: 'learning',
      })
      setTransferState('transferred')
    } catch {
      setTransferState('error')
    }
  }, [existingWordEntry, profile, story, updateWordStatus])

  const closePopup = useCallback(() => {
    setPopupState({ phase: 'closed' })
    setActiveWord(null)
    setAddState('idle')
    setTransferState('idle')
  }, [])

  // ── Finish reading ──────────────────────────────────────────────────────────

  const isTeacherPreview = profile?.account_type === 'teacher'

  // A class story belongs to the teacher, not the student — update stats only
  const isOwnStory = !story?.class_id || story?.user_id === profile?.id

  const handleFinishedReading = async () => {
    console.log('[Glossia] handleFinishedReading called', { hasStory: !!story, hasProfile: !!profile })
    if (!story || !profile) return
    setCompleteError(null)
    try {
      let result: CompletionResult
      if (isOwnStory) {
        result = await completeStory({ storyId: story.id, profile })
      } else {
        result = await updateReadingStats({ profile, language: story.language })
      }
      console.log("Complete Story Result:", result)
      setCompletionResult(result)
      await refreshProfile()
    } catch (err) {
      setCompleteError(err instanceof Error ? err.message : 'Could not mark story as complete.')
    }
  }

  const handleReview = () => {
    console.log('[Glossia] handleReview called')
    setCompletionResult(null)
    setFlashcardOpen(true)
  }

  const handleSkip = () => {
    setCompletionResult(null)
    navigate('/student/stories')
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-dvh gap-3">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  if (!story) {
    return (
      <div className="px-4 pt-10 text-center">
        <p className="text-gray-500">Story not found.</p>
        <button
          onClick={() => navigate('/student/stories')}
          className="mt-4 text-brand-600 font-medium text-sm"
        >
          Back to Stories
        </button>
      </div>
    )
  }

  const langName = getLanguageName(story.language)

  console.log('[Glossia] render — FlashcardSession gate:', { flashcardOpen, hasProfile: !!profile, hasStory: !!story })

  return (
    <div className="min-h-dvh">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="sticky top-0 z-20 bg-white/95 backdrop-blur-sm border-b border-gray-100 px-4 py-3">
        <div className="flex items-center gap-3 mb-3">
          <button
            onClick={() => navigate(-1)}
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="font-bold text-gray-900 text-base truncate">{story.title}</h1>
            <p className="text-xs text-gray-400">
              {langName} · {getLevelLabel(story.level)}
            </p>
          </div>
          <button
            onClick={handleReadStory}
            disabled={isAudioLoading}
            className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors shrink-0 disabled:opacity-60 disabled:cursor-wait"
            title={isAudioLoading ? 'Loading audio…' : isReading ? 'Stop reading' : 'Read story aloud'}
          >
            {isAudioLoading
              ? <LoadingSpinner size="sm" />
              : isReading
                ? <VolumeX className="w-5 h-5 text-brand-600" />
                : <Volume2 className="w-5 h-5 text-gray-500" />}
          </button>
          {story.completed && (
            <CheckCircle className="w-5 h-5 text-emerald-500 shrink-0" />
          )}
        </div>

        {/* Translation toggle */}
        {story.translation && (
          <div className="flex gap-0.5 bg-gray-100 p-0.5 rounded-xl text-xs">
            {(['original', 'translation', 'both'] as TranslationMode[]).map(m => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={cn(
                  'flex-1 py-1.5 rounded-lg font-semibold capitalize transition-all duration-100',
                  mode === m
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700',
                )}
              >
                {m}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── Story content ───────────────────────────────────────────────────── */}
      <div className="px-5 pt-6 pb-nav space-y-6">
        <StoryContent
          story={story}
          mode={mode}
          activeWord={activeWord}
          practiceSet={practiceSet}
          onWordClick={handleWordClick}
        />

        {/* Tap hint */}
        {mode !== 'translation' && (
          <p className="text-xs text-center text-gray-400">
            Tap any word to see its translation
          </p>
        )}

        {/* Complete error */}
        {completeError && (
          <div className="text-sm text-red-600 text-center">{completeError}</div>
        )}

        {/* Finished reading button */}
        {isTeacherPreview ? (
          <Button
            fullWidth
            size="lg"
            variant="secondary"
            onClick={() => navigate(-1)}
            leftIcon={<ArrowLeft className="w-5 h-5" />}
          >
            Done Previewing
          </Button>
        ) : (!story.completed || !isOwnStory) ? (
          <Button
            fullWidth
            size="lg"
            onClick={handleFinishedReading}
            loading={isCompleting || isUpdating}
            leftIcon={<CheckCircle className="w-5 h-5" />}
          >
            Finished Reading
          </Button>
        ) : (
          <div className="flex flex-col items-center gap-3">
            <div className="flex items-center gap-2 text-emerald-600 font-semibold">
              <CheckCircle className="w-5 h-5" />
              <span>Story completed</span>
            </div>
            <button
              onClick={() => navigate('/student/stories')}
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              Back to Stories
            </button>
          </div>
        )}
      </div>

      {/* ── Word popup ──────────────────────────────────────────────────────── */}
      <WordPopupSheet
        state={popupState}
        addState={addState}
        onClose={closePopup}
        onAddToWordBank={handleAddToWordBank}
        existingStatus={existingWordEntry?.status ?? null}
        transferState={transferState}
        onTransferToLearning={handleTransferToLearning}
        lang={story.language}
      />

      {/* ── Finished sheet ──────────────────────────────────────────────────── */}
      {profile && (
        <FinishedReadingSheet
          open={finishedOpen}
          result={completionResult}
          profile={profile}
          onReview={handleReview}
          onSkip={handleSkip}
        />
      )}

      {/* ── Inline flashcard review ─────────────────────────────────────────── */}
      {profile && story && (
        <FlashcardSession
          storyId={story.id}
          userId={profile.id}
          wordIds={(story.words_used_from_bank ?? []) as string[]}
          open={flashcardOpen}
          onDone={() => {
            setFlashcardOpen(false)
            navigate('/student/stories')
          }}
        />
      )}
    </div>
  )
}

// ─── Story content renderer ───────────────────────────────────────────────────

function StoryContent({
  story,
  mode,
  activeWord,
  practiceSet,
  onWordClick,
}: {
  story: { content: string; translation: string | null; language: string }
  mode: TranslationMode
  activeWord: string | null
  practiceSet: Set<string>
  onWordClick: (word: string, contextText: string) => void
}) {
  const origParas  = story.content.split('\n\n').filter(p => p.trim())
  const transParas = (story.translation ?? '').split('\n\n').filter(p => p.trim())
  const rtl = isRTLLanguage(story.language)
  const dir = rtl ? 'rtl' : 'ltr'

  if (mode === 'translation') {
    return (
      <div className="space-y-5" dir={dir}>
        {transParas.map((para, i) => (
          <p key={i} className={cn('text-gray-700 leading-relaxed text-base', rtl && 'text-right')}>{para}</p>
        ))}
      </div>
    )
  }

  if (mode === 'original') {
    return (
      <div className="space-y-5" dir={dir}>
        {origParas.map((para, i) => (
          <StoryParagraph
            key={i}
            text={para}
            rtl={rtl}
            activeWord={activeWord}
            practiceSet={practiceSet}
            onWordClick={onWordClick}
          />
        ))}
      </div>
    )
  }

  // Both: interleave
  return (
    <div className="space-y-6">
      {origParas.map((para, i) => (
        <div key={i} className="space-y-2">
          <StoryParagraph
            text={para}
            rtl={rtl}
            activeWord={activeWord}
            practiceSet={practiceSet}
            onWordClick={onWordClick}
          />
          {transParas[i] && (
            <p
              dir={dir}
              className={cn(
                'text-sm text-gray-400 italic leading-relaxed border-gray-100',
                rtl ? 'text-right pr-3 border-r-2' : 'pl-3 border-l-2',
              )}
            >
              {transParas[i]}
            </p>
          )}
        </div>
      ))}
    </div>
  )
}

// ─── Paragraph with tappable words ───────────────────────────────────────────

// Matches any sequence that contains at least one Unicode letter
const WORD_RE = /[\p{L}\p{N}]/u

function cleanWord(chunk: string): string {
  return chunk.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '')
}

function StoryParagraph({
  text,
  rtl,
  activeWord,
  practiceSet,
  onWordClick,
}: {
  text: string
  rtl: boolean
  activeWord: string | null
  practiceSet: Set<string>
  onWordClick: (word: string, contextText: string) => void
}) {
  const chunks = text.split(/(\s+)/u).filter(c => c.length > 0)

  return (
    <p dir={rtl ? 'rtl' : 'ltr'} className={cn('leading-relaxed text-gray-800 text-lg font-serif', rtl && 'text-right')}>
      {chunks.map((chunk, i) => {
        if (/^\s+$/.test(chunk)) return <span key={i}> </span>

        const clean = cleanWord(chunk)
        if (!clean || !WORD_RE.test(clean)) return <span key={i}>{chunk}</span>

        const isActive   = activeWord === clean
        const isPractice = practiceSet.has(clean.toLowerCase())

        return (
          <button
            key={i}
            onClick={() => onWordClick(clean, text)}
            className={cn(
              'inline transition-colors duration-100 cursor-pointer',
              isActive
                ? 'bg-brand-200 text-brand-900 rounded px-1'
                : [
                    isPractice && 'bg-blue-100/80 rounded px-1',
                    'hover:bg-brand-50 hover:text-brand-800 active:bg-brand-100 hover:rounded hover:px-0.5',
                  ],
            )}
          >
            {chunk}
          </button>
        )
      })}
    </p>
  )
}
