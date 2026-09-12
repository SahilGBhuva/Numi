import { createContext, useContext } from 'react'
import type { AuthSession } from './auth'

export type AuthContextValue = {
  session: AuthSession | null
  setSession: (session: AuthSession | null) => void
}

export const AuthContext = createContext<AuthContextValue | null>(null)

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext)
  if (!value) throw new Error('useAuth must be used within an AuthGate')
  return value
}
