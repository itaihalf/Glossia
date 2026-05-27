import { createBrowserRouter, Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { LoadingScreen } from '@/components/ui/LoadingScreen'
import { StudentLayout } from '@/components/layout/StudentLayout'
import { TeacherLayout } from '@/components/layout/TeacherLayout'
import LoginPage from '@/pages/auth/LoginPage'
import SignupPage from '@/pages/auth/SignupPage'
import OnboardingPage from '@/pages/onboarding/OnboardingPage'
import StudentDashboard from '@/pages/student/StudentDashboard'
import StoriesPage from '@/pages/student/StoriesPage'
import StoryReaderPage from '@/pages/student/StoryReaderPage'
import ReviewPage from '@/pages/student/ReviewPage'
import WordBankPage from '@/pages/student/WordBankPage'
import ClassesPage from '@/pages/student/ClassesPage'
import StudentClassDetailPage from '@/pages/student/StudentClassDetailPage'
import ProfilePage from '@/pages/student/ProfilePage'
import TeacherDashboard from '@/pages/teacher/TeacherDashboard'
import TeacherClassesPage from '@/pages/teacher/TeacherClassesPage'
import TeacherClassDetailPage from '@/pages/teacher/TeacherClassDetailPage'
import AssignmentsPage from '@/pages/teacher/AssignmentsPage'
import TeacherProfilePage from '@/pages/teacher/TeacherProfilePage'

// ─── Route guards ──────────────────────────────────────────────────────────────

function RedirectIfAuth() {
  const { user, profile, loading, profileLoading } = useAuth()
  console.log('[Guard:RedirectIfAuth]', { loading, profileLoading, user: !!user, profile: !!profile, onboarding_complete: profile?.onboarding_complete })
  if (loading) return <LoadingScreen />
  if (!user) return <Outlet />
  // Only block on profileLoading if we have no profile yet — background refreshes
  // should not show a spinner when a profile object is already in memory.
  if (profileLoading && !profile) return <LoadingScreen />
  if (!profile || !profile.onboarding_complete) return <Navigate to="/onboarding" replace />
  const dest = profile.account_type === 'teacher' ? '/teacher/dashboard' : '/student/dashboard'
  return <Navigate to={dest} replace />
}

function RequireAuth() {
  const { user, loading } = useAuth()
  console.log('[Guard:RequireAuth]', { loading, user: !!user })
  if (loading) return <LoadingScreen />
  if (!user) return <Navigate to="/login" replace />
  return <Outlet />
}

function RequireOnboardingComplete() {
  const { profile, loading, profileLoading } = useAuth()
  console.log('[Guard:RequireOnboardingComplete]', { loading, profileLoading, profile: !!profile, onboarding_complete: profile?.onboarding_complete })
  if (loading || (profileLoading && !profile)) return <LoadingScreen />
  if (!profile || !profile.onboarding_complete) return <Navigate to="/onboarding" replace />
  return <Outlet />
}

function StudentRoutes() {
  const { profile, loading, profileLoading } = useAuth()
  console.log('[Guard:StudentRoutes]', { loading, profileLoading, profile: !!profile, account_type: profile?.account_type })
  if (loading || (profileLoading && !profile)) return <LoadingScreen />
  if (!profile) return <Navigate to="/login" replace />
  if (profile.account_type !== 'student') return <Navigate to="/teacher/dashboard" replace />
  return <StudentLayout />
}

function TeacherRoutes() {
  const { profile, loading, profileLoading } = useAuth()
  console.log('[Guard:TeacherRoutes]', { loading, profileLoading, profile: !!profile, account_type: profile?.account_type })
  if (loading || (profileLoading && !profile)) return <LoadingScreen />
  if (!profile) return <Navigate to="/login" replace />
  if (profile.account_type !== 'teacher') return <Navigate to="/student/dashboard" replace />
  return <TeacherLayout />
}

// ─── Router ────────────────────────────────────────────────────────────────────

export const router = createBrowserRouter([
  // Root → login (RedirectIfAuth on /login handles authed users)
  { path: '/', element: <Navigate to="/login" replace /> },

  // Public: redirect to dashboard if already authenticated + onboarded
  {
    element: <RedirectIfAuth />,
    children: [
      { path: '/login',  element: <LoginPage /> },
      { path: '/signup', element: <SignupPage /> },
    ],
  },

  // Protected: must be logged in
  {
    element: <RequireAuth />,
    children: [
      { path: '/onboarding', element: <OnboardingPage /> },

      // Protected: must have completed onboarding
      {
        element: <RequireOnboardingComplete />,
        children: [
          // Student section
          {
            element: <StudentRoutes />,
            children: [
              { path: '/student/dashboard',        element: <StudentDashboard /> },
              { path: '/student/stories',          element: <StoriesPage /> },
              { path: '/student/stories/:storyId',        element: <StoryReaderPage /> },
              { path: '/student/review/:storyId',         element: <ReviewPage /> },
              { path: '/student/words',                   element: <WordBankPage /> },
              { path: '/student/classes',          element: <ClassesPage /> },
              { path: '/student/classes/:classId', element: <StudentClassDetailPage /> },
              { path: '/student/profile',          element: <ProfilePage /> },
            ],
          },
          // Teacher section
          {
            element: <TeacherRoutes />,
            children: [
              { path: '/teacher/dashboard',   element: <TeacherDashboard /> },
              { path: '/teacher/classes',              element: <TeacherClassesPage /> },
              { path: '/teacher/classes/:classId',     element: <TeacherClassDetailPage /> },
              { path: '/teacher/assignments',          element: <AssignmentsPage /> },
              { path: '/teacher/profile',     element: <TeacherProfilePage /> },
            ],
          },
        ],
      },
    ],
  },

  // Catch-all
  { path: '*', element: <Navigate to="/login" replace /> },
])
