import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react'
import { consumeAuthRedirectSession, loadAuthSession, refreshAuthSession, signIn, signUp, type AuthSession } from '../lib/auth'
import { AuthContext } from '../lib/AuthContext'
import './AuthGate.css'
import './GuestAuth.css'
import '../Brand.css'

type Mode = 'login' | 'signup'
const GUEST_KEY = 'bindit-guest-mode'

function BrandMark() {
  return (
    <div className="auth-brand-mark" aria-hidden="true">
      <img src="/bindit-mascot.webp" alt="" />
    </div>
  )
}

export function AuthGate({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<AuthSession | null>(() => consumeAuthRedirectSession() ?? loadAuthSession())
  const [loading, setLoading] = useState(Boolean(session))
  const [guestMode, setGuestMode] = useState(() => localStorage.getItem(GUEST_KEY) === '1')
  const [mode, setMode] = useState<Mode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  const passwordScore = useMemo(() => {
    let score = 0
    if (password.length >= 8) score += 1
    if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score += 1
    if (/\d/.test(password)) score += 1
    if (/[^A-Za-z0-9]/.test(password)) score += 1
    return score
  }, [password])

  useEffect(() => {
    if (!session) {
      setLoading(false)
      return
    }
    void refreshAuthSession(session).then((next) => {
      setSession(next)
      setLoading(false)
    })
  }, [])

  function switchMode(nextMode: Mode) {
    setMode(nextMode)
    setError('')
    setMessage('')
    setPassword('')
    setShowPassword(false)
  }

  function continueAsGuest() {
    localStorage.setItem(GUEST_KEY, '1')
    setGuestMode(true)
    setError('')
    setMessage('')
  }

  if (loading) {
    return (
      <main className="auth-screen auth-loading-screen">
        <div className="auth-loading-orb" aria-hidden="true" />
        <p>Opening Bindit…</p>
      </main>
    )
  }

  if (!session && !guestMode) {
    async function submit(event: FormEvent) {
      event.preventDefault()
      setBusy(true)
      setError('')
      setMessage('')
      try {
        if (mode === 'login') {
          setSession(await signIn(email.trim(), password))
        } else {
          if (password.length < 8) {
            setError('Use at least 8 characters for your password.')
            return
          }
          const result = await signUp(email.trim(), password)
          if (result.session) setSession(result.session)
          else setMessage('Check your inbox and press “Confirm your email.” We’ll bring you straight back to Bindit and sign you in.')
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'We couldn’t complete that request. Try again.')
      } finally {
        setBusy(false)
      }
    }

    return (
      <main className="auth-screen">
        <section className="auth-shell">
          <aside className="auth-story">
            <div className="auth-brand-row"><BrandMark /><span>Bindit</span></div>
            <div className="auth-story-copy">
              <span className="auth-eyebrow">Study smarter, consistently.</span>
              <h1>Turn scattered studying into connected understanding.</h1>
              <p>Build momentum, connect ideas, and keep everything you learn in one place.</p>
            </div>
            <div className="auth-preview-card auth-preview-card--brand">
              <img className="auth-preview-mascot" src="/bindit-mascot.webp" alt="Bindit otter mascot" />
              <div className="auth-preview-content">
                <div className="auth-preview-top"><span className="auth-preview-dot" /><span>Today’s progress</span></div>
                <strong>3 concepts connected</strong>
                <div className="auth-progress-track"><span /></div>
                <div className="auth-preview-tags"><span>Functions</span><span>Vectors</span><span>Biology</span></div>
              </div>
            </div>
          </aside>

          <section className="auth-panel">
            <div className="auth-mobile-brand"><BrandMark /><span>Bindit</span></div>
            <div className="auth-panel-inner">
              <div className="auth-heading">
                <span className="auth-kicker">{mode === 'login' ? 'Welcome back' : 'Start your learning system'}</span>
                <h2>{mode === 'login' ? 'Log in to Bindit' : 'Create your account'}</h2>
                <p>{mode === 'login' ? 'Pick up right where you left off.' : 'A few seconds now, a much better study flow later.'}</p>
              </div>

              <div className="auth-segmented" role="tablist" aria-label="Authentication mode">
                <button type="button" role="tab" aria-selected={mode === 'login'} className={mode === 'login' ? 'active' : ''} disabled={busy} onClick={() => switchMode('login')}>Log in</button>
                <button type="button" role="tab" aria-selected={mode === 'signup'} className={mode === 'signup' ? 'active' : ''} disabled={busy} onClick={() => switchMode('signup')}>Sign up</button>
              </div>

              <form className="auth-form" onSubmit={submit}>
                <label>
                  <span>Email</span>
                  <input type="email" inputMode="email" autoComplete="email" placeholder="you@example.com" required disabled={busy} value={email} onChange={(event) => setEmail(event.target.value)} />
                </label>
                <label>
                  <span>Password</span>
                  <div className="auth-password-wrap">
                    <input type={showPassword ? 'text' : 'password'} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} minLength={mode === 'signup' ? 8 : 6} placeholder={mode === 'signup' ? 'At least 8 characters' : 'Enter your password'} required disabled={busy} value={password} onChange={(event) => setPassword(event.target.value)} />
                    <button className="auth-show-password" type="button" disabled={busy} aria-label={showPassword ? 'Hide password' : 'Show password'} onClick={() => setShowPassword((value) => !value)}>{showPassword ? 'Hide' : 'Show'}</button>
                  </div>
                </label>

                {mode === 'signup' && password ? (
                  <div className="auth-strength" aria-live="polite">
                    <div className="auth-strength-bars">{[0, 1, 2, 3].map((index) => <span key={index} className={index < passwordScore ? 'filled' : ''} />)}</div>
                    <small>{passwordScore <= 1 ? 'Make it stronger' : passwordScore === 2 ? 'Good password' : 'Strong password'}</small>
                  </div>
                ) : null}

                {error ? <div className="auth-feedback auth-error" role="alert">{error}</div> : null}
                {message ? <div className="auth-feedback auth-message" role="status">{message}</div> : null}
                <button className="auth-primary" type="submit" disabled={busy}>{busy ? <><span className="auth-spinner" aria-hidden="true" />Working…</> : mode === 'login' ? 'Log in' : 'Create account'}</button>
                <p className="auth-terms">{mode === 'signup' ? 'By creating an account, you agree to use Bindit responsibly.' : 'Your progress stays connected to your account.'}</p>
              </form>

              <div className="auth-guest-separator"><span>or</span></div>
              <button className="auth-guest-button" type="button" disabled={busy} onClick={continueAsGuest}>Continue as guest</button>
              <p className="auth-guest-copy">Guest mode is temporary. Sign in to save progress, use AI notes, and connect with friends.</p>

              <p className="auth-switch-copy">
                {mode === 'login' ? 'New to Bindit?' : 'Already have an account?'}{' '}
                <button type="button" disabled={busy} onClick={() => switchMode(mode === 'login' ? 'signup' : 'login')}>{mode === 'login' ? 'Create an account' : 'Log in'}</button>
              </p>
            </div>
          </section>
        </section>
      </main>
    )
  }

  return <AuthContext.Provider value={{ session, setSession }}>{children}</AuthContext.Provider>
}
