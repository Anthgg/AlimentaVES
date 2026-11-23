import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { api } from '../lib/api'
import { clearSessionToken, getSessionToken, saveSessionToken } from '../lib/session-token'
import type { User } from '../types'

interface AuthContextValue {
  user: User | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<User>
  signUp: (email: string, password: string) => Promise<User>
  signOut: () => Promise<void>
  reloadUser: () => Promise<User | null>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  const reloadUser = useCallback(async () => {
    if (!getSessionToken()) {
      setUser(null)
      setLoading(false)
      return null
    }
    setLoading(true)
    try {
      const current = await api.me()
      setUser(current)
      return current
    } catch (error) {
      clearSessionToken()
      setUser(null)
      throw error
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!getSessionToken()) {
      setLoading(false)
      return
    }
    void reloadUser().catch(() => undefined)
  }, [reloadUser])

  const signIn = useCallback(async (email: string, password: string) => {
    const token = await api.login(email.trim(), password)
    saveSessionToken(token.access_token)
    try {
      const current = await api.me()
      setUser(current)
      return current
    } catch (error) {
      clearSessionToken()
      setUser(null)
      throw error
    }
  }, [])

  const signUp = useCallback((email: string, password: string) => api.register(email.trim(), password), [])

  const signOut = useCallback(async () => {
    try {
      if (getSessionToken()) await api.logout()
    } finally {
      clearSessionToken()
      setUser(null)
    }
  }, [])

  const value = useMemo(() => ({ user, loading, signIn, signUp, signOut, reloadUser }), [user, loading, signIn, signUp, signOut, reloadUser])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth debe usarse dentro de AuthProvider')
  return context
}
