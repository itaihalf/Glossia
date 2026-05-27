import { createContext, useContext, useEffect, useState, useCallback, useRef, type ReactNode } from 'react'
import type { User, Session } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import type { UserProfile } from '@/lib/types'

interface AuthContextValue {
  user: User | null
  session: Session | null
  profile: UserProfile | null
  loading: boolean
  profileLoading: boolean
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [profileLoading, setProfileLoading] = useState(false)
  // Ref so the auth callback (created once) can read the current user ID without
  // a stale closure — avoids re-registering the listener on every user change.
  const currentUserIdRef = useRef<string | null>(null)

  useEffect(() => { console.log('[Auth] loading →', loading) }, [loading])
  useEffect(() => { console.log('[Auth] profileLoading →', profileLoading) }, [profileLoading])
  useEffect(() => { currentUserIdRef.current = user?.id ?? null }, [user?.id])

  const fetchProfile = useCallback(async (authUserId: string) => {
    setProfileLoading(true)
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('auth_user_id', authUserId)
        .maybeSingle()

      if (error) throw error
      setProfile(data as UserProfile | null)
    } catch {
      setProfile(null)
    } finally {
      setProfileLoading(false)
    }
  }, [])

  const refreshProfile = useCallback(async () => {
    if (user) await fetchProfile(user.id)
  }, [user, fetchProfile])

  useEffect(() => {
    // Never await inside onAuthStateChange — doing so blocks Supabase's internal
    // auth queue. On hard reload, SIGNED_IN fires before any async work can
    // complete, causing fetchProfile to hang and loading to stay true forever.
    // Profile fetching is handled by the separate useEffect below.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, s) => {
      console.log('[Auth] onAuthStateChange event:', event, '— session:', !!s)
      // TOKEN_REFRESHED only rotates the JWT — user identity and profile are unchanged.
      if (event === 'TOKEN_REFRESHED') return
      // Supabase can re-emit SIGNED_IN for an already-active session (e.g. after
      // navigation). If the user identity hasn't changed, ignore it: processing it
      // would call setProfileLoading(true) but the user?.id effect won't re-run
      // (same value), so profileLoading would never be cleared.
      if (event === 'SIGNED_IN' && s?.user?.id && s.user.id === currentUserIdRef.current) {
        console.log('[Auth] Ignoring redundant SIGNED_IN — user identity unchanged')
        return
      }
      setSession(s)
      setUser(s?.user ?? null)
      if (s?.user) {
        // Mark profile as loading immediately so guards don't evaluate with
        // loading=false + profileLoading=false + profile=null before the
        // fetchProfile useEffect has had a chance to run.
        setProfileLoading(true)
      } else {
        setProfile(null)
      }
      setLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [])

  // Fetch profile whenever the authenticated user changes.
  // Keeping async work out of the auth callback prevents queue stalls.
  useEffect(() => {
    if (!user) return
    fetchProfile(user.id)
  }, [user?.id, fetchProfile])

  const signOut = async () => {
    await supabase.auth.signOut()
    setProfile(null)
  }

  return (
    <AuthContext.Provider value={{ user, session, profile, loading, profileLoading, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
