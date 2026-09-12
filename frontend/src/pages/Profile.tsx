import { useState, type FormEvent } from 'react'
import { AvatarControl } from '../lib/AvatarControl'
import { useAuth } from '../lib/AuthContext'
import { updateUsername } from '../lib/auth'
import './Progress.css'

type ProfileProps = {
  onError?: (message: string) => void
}

const USERNAME_PATTERN = /^[a-zA-Z0-9_]{3,20}$/

function currentUsername(session: ReturnType<typeof useAuth>['session']): string {
  const stored = session?.user.user_metadata?.username
  if (typeof stored === 'string' && stored.trim()) return stored
  return session?.user.email?.split('@')[0] ?? ''
}

export function Profile({ onError }: ProfileProps) {
  const { session, setSession } = useAuth()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(() => currentUsername(session))
  const [saving, setSaving] = useState(false)

  const name = currentUsername(session)

  function startEditing() {
    setDraft(name)
    setEditing(true)
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    const trimmed = draft.trim()
    if (!USERNAME_PATTERN.test(trimmed)) {
      onError?.('Usernames need 3-20 characters: letters, numbers, or underscores.')
      return
    }
    if (!session) return
    setSaving(true)
    try {
      setSession(await updateUsername(session, trimmed))
      setEditing(false)
    } catch (err) {
      onError?.(err instanceof Error ? err.message : 'Could not update your username.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="board">
      <h1>Profile</h1>
      <p>Tap the avatar to set your photo. Stats will connect later.</p>
      <div className="board__grid">
        <article>
          <h2>Avatar</h2>
          <div className="board__avatar">
            <AvatarControl onError={onError} />
          </div>
        </article>
        <article>
          <h2>Username</h2>
          {editing ? (
            <form onSubmit={submit} className="board__username-form">
              <input
                type="text"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                autoFocus
                disabled={saving}
                minLength={3}
                maxLength={20}
                placeholder="your_username"
              />
              <div className="board__username-actions">
                <button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
                <button type="button" disabled={saving} onClick={() => setEditing(false)}>Cancel</button>
              </div>
            </form>
          ) : (
            <div className="board__username-display">
              <p>{name || '—'}</p>
              <button type="button" onClick={startEditing}>Change</button>
            </div>
          )}
        </article>
        <article>
          <h2>Level</h2>
          <p>—</p>
        </article>
      </div>
    </section>
  )
}
