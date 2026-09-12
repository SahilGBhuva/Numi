import { useEffect, useState } from 'react'
import { getAccountProfile, type Profile } from '../lib/api'
import type { AuthSession } from '../lib/auth'
import { AvatarControl } from '../lib/AvatarControl'
import './Progress.css'

type ProfileProps = {
  session: AuthSession | null
  onError?: (message: string) => void
}

export function Profile({ session, onError }: ProfileProps) {
  const [profile, setProfile] = useState<Profile | null>(null)

  useEffect(() => {
    if (!session) {
      setProfile(null)
      return
    }
    void getAccountProfile(session.access_token)
      .then(setProfile)
      .catch(() => onError?.('Could not load your profile.'))
  }, [session, onError])

  if (!session) {
    return (
      <section className="board">
        <h1>Profile</h1>
        <p>Log in from Settings to see your username, friend code, and XP.</p>
      </section>
    )
  }

  return (
    <section className="board">
      <h1>Profile</h1>
      <p>{profile ? `@${profile.username}` : 'Finish your profile in Settings to unlock a friend code.'}</p>
      <div className="board__grid">
        <article>
          <h2>Avatar</h2>
          <div className="board__avatar">
            <AvatarControl onError={onError} />
          </div>
        </article>
        <article>
          <h2>Name</h2>
          <p>{profile?.display_name ?? '—'}</p>
        </article>
        <article>
          <h2>Friend code</h2>
          <p>{profile?.friend_code ?? '—'}</p>
        </article>
        <article>
          <h2>XP</h2>
          <p>{profile?.total_xp ?? 0}</p>
        </article>
        <article>
          <h2>Streak</h2>
          <p>{profile?.streak ?? 0}</p>
        </article>
        <article>
          <h2>Best streak</h2>
          <p>{profile?.best_streak ?? 0}</p>
        </article>
      </div>
    </section>
  )
}
