import { useEffect, useState, type FormEvent } from 'react'
import { getAccountProfile, saveAccountProfile, type Profile } from '../lib/api'
import { requestPasswordReset, signIn, signOut, signUp, type AuthSession } from '../lib/auth'
import { getStudentId } from '../lib/session'
import './Progress.css'

const GOALS = [
  { id: 10, label: 'Casual · 10 XP' },
  { id: 20, label: 'Regular · 20 XP' },
  { id: 30, label: 'Serious · 30 XP' },
  { id: 50, label: 'Intense · 50 XP' },
]

type SettingsProps = {
  session: AuthSession | null
  onSession: (session: AuthSession | null) => void
}

export function Settings({ session, onSession }: SettingsProps) {
  const [mode, setMode] = useState<'login' | 'signup' | 'reset'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [displayName, setDisplayName] = useState('')
  const [username, setUsername] = useState('')
  const [dailyGoal, setDailyGoal] = useState(20)

  useEffect(() => {
    if (!session) {
      setProfile(null)
      return
    }
    void getAccountProfile(session.access_token)
      .then((saved) => {
        setProfile(saved)
        if (saved) {
          setDisplayName(saved.display_name)
          setUsername(saved.username)
          setDailyGoal(saved.daily_goal)
        } else {
          const metadataName = session.user.user_metadata?.username
          setUsername(typeof metadataName === 'string' ? metadataName : '')
          setDisplayName(typeof metadataName === 'string' ? metadataName : '')
        }
      })
      .catch(() => setMessage('Could not load your profile.'))
  }, [session])

  async function submitAuth(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setMessage('')
    try {
      if (mode === 'reset') {
        await requestPasswordReset(email.trim())
        setMessage('Check your email for a reset link.')
        return
      }
      if (mode === 'login') {
        const next = await signIn(email.trim(), password)
        onSession(next)
        setMessage('You are signed in.')
      } else {
        const result = await signUp(email.trim(), password)
        if (!result.session) {
          setMessage('Check your email to confirm your account, then log in.')
        } else {
          onSession(result.session)
          setMessage('Your account is ready.')
        }
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not continue.')
    } finally {
      setBusy(false)
    }
  }

  async function saveProfile(event: FormEvent) {
    event.preventDefault()
    if (!session) return
    setBusy(true)
    setMessage('')
    try {
      const saved = await saveAccountProfile(session.access_token, {
        username: username.toLowerCase(),
        display_name: displayName,
        guest_id: getStudentId(),
        daily_goal: dailyGoal,
      })
      setProfile(saved)
      setMessage('Profile saved. Guest progress is claimed at most once.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not save your profile.')
    } finally {
      setBusy(false)
    }
  }

  function logout() {
    signOut()
    onSession(null)
    setMessage('Signed out. You can keep using Bindit as a guest.')
  }

  return (
    <section className="board">
      <h1>Settings</h1>
      <p>
        {session
          ? `Signed in as ${session.user.email ?? 'your Bindit account'}.`
          : 'Create an account to keep XP, streaks, and notes across devices.'}
      </p>
      {!session ? (
        <form className="account-form" onSubmit={submitAuth}>
          <label>
            Email
            <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required autoComplete="email" />
          </label>
          {mode !== 'reset' ? (
            <label>
              Password
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
                minLength={8}
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              />
            </label>
          ) : null}
          <button type="submit" disabled={busy}>
            {busy ? 'One moment…' : mode === 'login' ? 'Log in' : mode === 'signup' ? 'Create account' : 'Send reset email'}
          </button>
          {message ? <p className="account-form__status">{message}</p> : null}
          <div className="account-form__links">
            <button type="button" onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setMessage('') }}>
              {mode === 'login' ? 'New here? Create an account' : 'Already have an account? Log in'}
            </button>
            <button type="button" onClick={() => { setMode('reset'); setMessage('') }}>Forgot password</button>
          </div>
        </form>
      ) : (
        <form className="account-form" onSubmit={saveProfile}>
          <label>
            Display name
            <input value={displayName} onChange={(event) => setDisplayName(event.target.value)} required maxLength={40} />
          </label>
          <label>
            Username
            <input
              value={username}
              onChange={(event) => setUsername(event.target.value.replace(/[^a-zA-Z0-9_]/g, ''))}
              required
              minLength={3}
              maxLength={24}
            />
          </label>
          <label>
            Daily goal
            <select value={dailyGoal} onChange={(event) => setDailyGoal(Number(event.target.value))}>
              {GOALS.map((goal) => <option key={goal.id} value={goal.id}>{goal.label}</option>)}
            </select>
          </label>
          {profile ? <p className="account-form__status">Friend code {profile.friend_code}</p> : null}
          <button type="submit" disabled={busy}>{busy ? 'Saving…' : profile ? 'Update profile' : 'Save profile and claim guest progress'}</button>
          <button type="button" onClick={logout}>Sign out</button>
          {message ? <p className="account-form__status">{message}</p> : null}
        </form>
      )}
    </section>
  )
}
