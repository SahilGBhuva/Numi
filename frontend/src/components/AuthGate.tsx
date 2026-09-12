import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { loadAuthSession, refreshAuthSession, signIn, signOut, signUp, type AuthSession } from '../lib/auth'
import './AuthGate.css'

export function AuthGate({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<AuthSession | null>(loadAuthSession())
  const [loading, setLoading] = useState(Boolean(session))
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!session) return setLoading(false)
    void refreshAuthSession(session).then((next) => {
      setSession(next)
      setLoading(false)
    })
  }, [])

  if (loading) return <div className="auth-screen"><p>Loading Bindit…</p></div>

  if (!session) {
    async function submit(event: FormEvent) {
      event.preventDefault()
      setBusy(true)
      setError('')
      setMessage('')
      try {
        if (mode === 'login') {
          setSession(await signIn(email.trim(), password))
        } else {
          const result = await signUp(email.trim(), password)
          if (result.session) setSession(result.session)
          else setMessage('Check your email to confirm your account, then log in.')
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Account request failed.')
      } finally {
        setBusy(false)
      }
    }

    return (
      <main className="auth-screen">
        <form className="auth-card" onSubmit={submit}>
          <h1>Bindit</h1>
          <p>{mode === 'login' ? 'Welcome back.' : 'Create your account.'}</p>
          <label>Email<input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></label>
          <label>Password<input type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} minLength={6} required value={password} onChange={(e) => setPassword(e.target.value)} /></label>
          {error ? <p className="auth-error">{error}</p> : null}
          {message ? <p className="auth-message">{message}</p> : null}
          <button type="submit" disabled={busy}>{busy ? 'Working…' : mode === 'login' ? 'Log in' : 'Sign up'}</button>
          <button className="auth-switch" type="button" onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setError(''); setMessage('') }}>
            {mode === 'login' ? 'Need an account? Sign up' : 'Already have an account? Log in'}
          </button>
        </form>
      </main>
    )
  }

  return <>{children}<button className="auth-logout" type="button" onClick={() => { signOut(); setSession(null) }}>Log out</button></>
}
