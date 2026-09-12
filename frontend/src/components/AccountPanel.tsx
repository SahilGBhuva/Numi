import { useEffect, useState } from 'react'
import { getAccountProfile, listImages, saveAccountProfile, uploadImage } from '../lib/api'
import type { Profile, UploadedImage } from '../lib/api'
import { saveAuthSession, signIn, signOut, signUp } from '../lib/auth'
import type { AuthSession } from '../lib/auth'
import './AccountPanel.css'

type Props = {
  session: AuthSession | null
  guestId: string
  onSession: (session: AuthSession | null) => void
  onProfileSaved: () => void
  onClose: () => void
}

export function AccountPanel({ session, guestId, onSession, onProfileSaved, onClose }: Props) {
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [images, setImages] = useState<UploadedImage[]>([])
  const [profile, setProfile] = useState<Profile | null | undefined>(undefined)
  const [displayName, setDisplayName] = useState('')
  const [username, setUsername] = useState('')

  useEffect(() => {
    if (session) {
      void listImages(session.access_token).then(setImages).catch(() => setMessage('Could not load your images.'))
      void getAccountProfile(session.access_token).then((savedProfile) => {
        setProfile(savedProfile)
        if (savedProfile) {
          setDisplayName(savedProfile.display_name)
          setUsername(savedProfile.username)
        }
      }).catch(() => setMessage('Could not load your profile.'))
    }
  }, [session])

  async function saveProfile(event: React.FormEvent) {
    event.preventDefault(); if (!session) return
    setBusy(true); setMessage('')
    try {
      const saved = await saveAccountProfile(session.access_token, {
        username: username.toLowerCase(), display_name: displayName, guest_id: guestId,
      })
      setProfile(saved); onProfileSaved(); setMessage('Profile saved and progress connected!')
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Could not save your profile.') }
    finally { setBusy(false) }
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setMessage('')
    try {
      const next = mode === 'login' ? await signIn(email, password) : await signUp(email, password)
      if (!next.access_token) {
        setMessage('Check your email to confirm your account, then log in.')
      } else {
        saveAuthSession(next); onSession(next); setMessage('You are signed in!')
      }
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Could not continue.') }
    finally { setBusy(false) }
  }

  async function chooseImage(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file || !session) return
    setBusy(true); setMessage('Uploading…')
    try {
      const image = await uploadImage(file, session.access_token)
      setImages((current) => [image, ...current]); setMessage('Image saved privately.')
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Upload failed.') }
    finally { setBusy(false); event.target.value = '' }
  }

  function logout() { signOut(); onSession(null); setImages([]); setMessage('Signed out.') }

  return <div className="account-backdrop" role="presentation" onMouseDown={onClose}>
    <section className="account-panel" role="dialog" aria-modal="true" aria-label="Your Bindit account" onMouseDown={(event) => event.stopPropagation()}>
      <button className="account-close" onClick={onClose} aria-label="Close">×</button>
      <span className="eyebrow">YOUR BINDIT SPACE</span>
      {session ? <>
        <h2>Welcome back.</h2><p className="account-email">{session.user.email}</p>
        {profile === undefined ? <p className="empty-gallery">Loading your profile…</p> : !profile ? <form className="auth-form profile-form" onSubmit={saveProfile}>
          <p>Finish your profile to protect your progress and unlock friends.</p>
          <label>Display name<input value={displayName} onChange={(event) => setDisplayName(event.target.value)} required minLength={1} maxLength={40} autoComplete="name" placeholder="What should friends call you?"/></label>
          <label>Username<input value={username} onChange={(event) => setUsername(event.target.value.replace(/[^a-zA-Z0-9_]/g, ''))} required minLength={3} maxLength={24} autoComplete="username" placeholder="letters_numbers_only"/></label>
          <button disabled={busy}>{busy ? 'Saving…' : 'Save my profile'}</button>
        </form> : <div className="profile-summary"><div><small>PROFILE</small><strong>{profile.display_name}</strong><span>@{profile.username}</span></div><div><small>FRIEND CODE</small><strong>{profile.friend_code}</strong><span>Share this with friends</span></div></div>}
        <label className={`upload-card ${busy ? 'disabled' : ''}`}>
          <span>＋</span><strong>Add a study image</strong><small>JPG, PNG, WebP or GIF · max 5 MB</small>
          <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={chooseImage} disabled={busy}/>
        </label>
        {message && <p className="account-message">{message}</p>}
        <div className="image-grid">{images.map((image) => <a href={image.url} target="_blank" rel="noreferrer" key={image.id}><img src={image.url} alt={image.original_name}/><span>{image.original_name}</span></a>)}</div>
        {!images.length && !busy && <p className="empty-gallery">Your private study gallery is ready.</p>}
        <button className="text-button" onClick={logout}>Sign out</button>
      </> : <>
        <h2>{mode === 'login' ? 'Welcome back.' : 'Create your account.'}</h2>
        <p>Save your XP, streak, friends, and study images across every device.</p>
        <form className="auth-form" onSubmit={submit}>
          <label>Email<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required autoComplete="email"/></label>
          <label>Password<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} required minLength={8} autoComplete={mode === 'login' ? 'current-password' : 'new-password'}/></label>
          <button disabled={busy}>{busy ? 'One moment…' : mode === 'login' ? 'Log in' : 'Create account'}</button>
        </form>
        {message && <p className="account-message">{message}</p>}
        <button className="text-button" onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setMessage('') }}>{mode === 'login' ? 'New here? Create an account' : 'Already have an account? Log in'}</button>
      </>}
    </section>
  </div>
}
