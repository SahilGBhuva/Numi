import { useEffect, useState, type FormEvent } from 'react'
import {
  answerFriendRequest,
  getAccountProfile,
  getFriends,
  getProgress,
  removeFriend,
  sendFriendRequest,
  startFriendQuest,
  type FriendsHub,
  type Profile as ProfileData,
  type Progress as ProgressData,
} from '../lib/api'
import type { AuthSession } from '../lib/auth'
import { getStudentId, loadNotebook } from '../lib/session'
import type { Course } from '../lib/types'
import { AvatarControl } from '../lib/AvatarControl'
import './Progress.css'
import './Profile.css'

const XP_PER_LEVEL = 100

function xpLevel(totalXp: number) {
  const level = Math.floor(totalXp / XP_PER_LEVEL) + 1
  const inLevel = totalXp % XP_PER_LEVEL
  return { level, inLevel, toNext: XP_PER_LEVEL - inLevel }
}

function formatTopic(topic: string) {
  return topic.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase())
}

type ProfileProps = {
  session: AuthSession | null
  onError?: (message: string) => void
}

export function Profile({ session, onError }: ProfileProps) {
  const [profile, setProfile] = useState<ProfileData | null>(null)
  const [stats, setStats] = useState<ProgressData | null>(null)
  const [courses, setCourses] = useState<Course[]>(() => loadNotebook().courses)
  const [activeCourse, setActiveCourse] = useState(() => loadNotebook().activeCourse)
  const [social, setSocial] = useState<FriendsHub | null>(null)
  const [friendCode, setFriendCode] = useState('')
  const [socialBusy, setSocialBusy] = useState(false)
  const [socialMessage, setSocialMessage] = useState('')
  const studentId = session?.user.id ?? getStudentId()

  useEffect(() => {
    void getProgress(studentId, session?.access_token)
      .then(setStats)
      .catch(() => setStats(null))
  }, [studentId, session?.access_token])

  useEffect(() => {
    if (!session) {
      setProfile(null)
      return
    }
    void getAccountProfile(session.access_token)
      .then(setProfile)
      .catch(() => onError?.('Could not load your profile.'))
  }, [session, onError])

  async function refreshFriends() {
    if (!session) {
      setSocial(null)
      return
    }
    try {
      setSocial(await getFriends(session.access_token))
    } catch {
      onError?.('Could not load friends right now.')
    }
  }

  useEffect(() => {
    void refreshFriends()
  }, [session?.access_token])

  async function addFriend(event: FormEvent) {
    event.preventDefault()
    if (!session || !friendCode.trim()) return
    setSocialBusy(true)
    setSocialMessage('')
    try {
      await sendFriendRequest(friendCode.trim(), session.access_token)
      setFriendCode('')
      setSocialMessage('Friend request sent!')
      await refreshFriends()
    } catch (error) {
      setSocialMessage(error instanceof Error ? error.message : 'Could not send that request.')
    } finally {
      setSocialBusy(false)
    }
  }

  async function answerRequest(requestId: number, accept: boolean) {
    if (!session) return
    setSocialBusy(true)
    try {
      await answerFriendRequest(requestId, accept, session.access_token)
      setSocialMessage(accept ? 'You are friends now!' : 'Request declined.')
      await refreshFriends()
    } finally {
      setSocialBusy(false)
    }
  }

  async function beginQuest(friendId: string) {
    if (!session) return
    setSocialBusy(true)
    try {
      await startFriendQuest(friendId, session.access_token)
      setSocialMessage('Friend Quest started — earn 100 XP together this week!')
      await refreshFriends()
    } finally {
      setSocialBusy(false)
    }
  }

  async function unfriend(friendId: string) {
    if (!session || !window.confirm('Remove this friend?')) return
    setSocialBusy(true)
    try {
      await removeFriend(friendId, session.access_token)
      setSocialMessage('Friend removed.')
      await refreshFriends()
    } finally {
      setSocialBusy(false)
    }
  }

  useEffect(() => {
    const syncNotebook = () => {
      const notebook = loadNotebook()
      setCourses(notebook.courses)
      setActiveCourse(notebook.activeCourse)
    }
    syncNotebook()
    window.addEventListener('storage', syncNotebook)
    window.addEventListener('hashchange', syncNotebook)
    return () => {
      window.removeEventListener('storage', syncNotebook)
      window.removeEventListener('hashchange', syncNotebook)
    }
  }, [])

  const totalXp = profile?.total_xp ?? stats?.total_xp ?? 0
  const { level, inLevel, toNext } = xpLevel(totalXp)
  const loginStreak = profile?.login_streak ?? stats?.login_streak ?? 0
  const unitStats = stats?.topics ?? []
  const username = profile?.username ?? 'Guest'
  const tag = profile?.friend_code ?? '—'

  return (
    <section className="board profile-page">
      {!session ? (
        <p className="profile-guest-note">Log in from Settings to save your progress and get a friend code.</p>
      ) : null}

      <div className="profile-layout">
        <div className="profile-main">
          <div className="profile-hero">
            <a className="profile-hero__settings" href="#settings" aria-label="Open settings">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path
                  fill="currentColor"
                  d="M12 8.4a3.6 3.6 0 1 0 0 7.2 3.6 3.6 0 0 0 0-7.2zm8.2 4.8a9.4 9.4 0 0 0-.1-1.6l2-1.6-2-3.4-2.4 1a7.6 7.6 0 0 0-2.8-1.6l-.4-2.6H9.5l-.4 2.6a7.6 7.6 0 0 0-2.8 1.6l-2.4-1-2 3.4 2 1.6a9.4 9.4 0 0 0-.1 1.6c0 .5 0 1.1.1 1.6l-2 1.6 2 3.4 2.4-1a7.6 7.6 0 0 0 2.8 1.6l.4 2.6h4.8l.4-2.6a7.6 7.6 0 0 0 2.8-1.6l2.4 1 2-3.4-2-1.6c.1-.5.1-1 .1-1.6z"
                />
              </svg>
            </a>
            <div className="profile-hero__avatar">
              <AvatarControl onError={onError} />
            </div>
          </div>

          <div className="profile-identity">
            <p className="profile-identity__name">{profile?.display_name ?? username}</p>
            <p className="profile-identity__tag">{tag}</p>
            <div className="profile-identity__level">
              <p className="profile-identity__level-label">Level {level}</p>
              <div
                className="profile-bar"
                role="progressbar"
                aria-valuenow={inLevel}
                aria-valuemin={0}
                aria-valuemax={XP_PER_LEVEL}
                aria-label={`${inLevel} of ${XP_PER_LEVEL} XP toward level ${level + 1}`}
              >
                <span style={{ width: `${(inLevel / XP_PER_LEVEL) * 100}%` }} />
              </div>
              <p className="profile-bar__hint">{totalXp} XP · {toNext} to next</p>
            </div>
          </div>

          <section className="profile-friends">
            <h2>
              Friends <span>{social?.friends.length ?? 0}</span>
            </h2>
            {session && profile?.friend_code ? (
              <form className="friend-add" onSubmit={addFriend}>
                <input
                  value={friendCode}
                  onChange={(event) => setFriendCode(event.target.value.toUpperCase())}
                  placeholder="Friend code"
                  maxLength={12}
                  aria-label="Friend code"
                />
                <button type="submit" disabled={socialBusy || !friendCode.trim()}>
                  Add
                </button>
              </form>
            ) : null}
            {social?.requests.map((request) => (
              <div className="friend-request" key={request.request_id}>
                <span>
                  <strong>{request.display_name}</strong>
                  <small>@{request.username}</small>
                </span>
                <button type="button" onClick={() => void answerRequest(request.request_id, true)} disabled={socialBusy}>
                  Accept
                </button>
                <button
                  className="is-quiet"
                  type="button"
                  onClick={() => void answerRequest(request.request_id, false)}
                  disabled={socialBusy}
                >
                  ×
                </button>
              </div>
            ))}
            <div className="profile-friends__row">
              {social?.friends.slice(0, 5).map((friend) => (
                <span className="profile-friends__avatar" key={friend.student_id} title={friend.display_name}>
                  {friend.display_name.slice(0, 1).toUpperCase()}
                </span>
              ))}
              {!social?.friends.length ? (
                <span className="profile-friends__avatar is-empty" aria-hidden="true">
                  +
                </span>
              ) : null}
            </div>
            {social?.friends.map((friend) => (
              <div className="friend-mini" key={friend.student_id}>
                <span>
                  <strong>{friend.display_name}</strong>
                  <small>
                    🔥 {friend.streak} · {friend.total_xp} XP
                  </small>
                </span>
                <button type="button" onClick={() => void beginQuest(friend.student_id)} disabled={socialBusy}>
                  Quest
                </button>
                <button
                  className="is-remove"
                  type="button"
                  onClick={() => void unfriend(friend.student_id)}
                  disabled={socialBusy}
                  aria-label={`Remove ${friend.display_name}`}
                >
                  ×
                </button>
              </div>
            ))}
            {!session || !profile?.friend_code ? (
              <p className="profile-friends__hint">Add friends with your tag in Settings</p>
            ) : (
              <p className="profile-friends__hint">Share tag {profile.friend_code}</p>
            )}
            {socialMessage ? (
              <p className="profile-social-message" role="status">
                {socialMessage}
              </p>
            ) : null}
          </section>

          <div className="profile-records__streak">
            <span className="profile-records__streak-icon" aria-hidden="true">🔥</span>
            <span>Streak: {loginStreak}</span>
          </div>
        </div>

        <aside className="profile-panels">
          <section className="profile-panel-section social-league">
            <h2>Friends League</h2>
            {!social?.leaderboard.length ? (
              <p className="profile-panel__empty">Add a friend to start your weekly competition.</p>
            ) : (
              <ol className="friend-leaderboard">
                {social.leaderboard.map((friend, index) => (
                  <li key={friend.student_id} className={friend.student_id === studentId ? 'is-me' : ''}>
                    <span className="friend-rank">{index + 1}</span>
                    <span className="friend-face">{friend.display_name.slice(0, 1).toUpperCase()}</span>
                    <span className="friend-name">
                      <strong>{friend.student_id === studentId ? 'You' : friend.display_name}</strong>
                      <small>{friend.active_today ? 'Active today' : `🔥 ${friend.streak} day streak`}</small>
                    </span>
                    <strong className="friend-xp">{friend.total_xp} XP</strong>
                  </li>
                ))}
              </ol>
            )}
          </section>

          <section className="profile-panel-section friend-quests">
            <h2>Friend Quests</h2>
            {social?.quests.map((quest) => (
              <div className="friend-quest" key={quest.id}>
                <div>
                  <strong>You + {quest.friend_name}</strong>
                  <span>
                    {quest.progress_xp} / {quest.target_xp} XP
                  </span>
                </div>
                <div className="profile-bar">
                  <span style={{ width: `${Math.min(100, (quest.progress_xp / quest.target_xp) * 100)}%` }} />
                </div>
              </div>
            ))}
            {!social?.quests.length && social?.friends.length ? (
              <button
                className="quest-start"
                type="button"
                disabled={socialBusy}
                onClick={() => void beginQuest(social.friends[0].student_id)}
              >
                Start a 100 XP quest with {social.friends[0].display_name}
              </button>
            ) : null}
            {!social?.friends.length ? (
              <p className="profile-panel__empty">Friend Quests unlock after you add a friend.</p>
            ) : null}
          </section>

          <section className="profile-panel-section">
            <h2>Currently Studying</h2>
            {courses.length === 0 ? (
              <p className="profile-panel__empty">Add courses in Tools to see them here.</p>
            ) : (
              <div className="profile-courses">
                {courses.map((course) => (
                  <span
                    key={course.name}
                    className={`profile-course ${course.name === activeCourse ? 'is-active' : ''}`}
                    style={course.name === activeCourse && course.tone ? { background: course.tone, borderColor: course.tone } : undefined}
                  >
                    {course.name}
                  </span>
                ))}
              </div>
            )}
          </section>

          <section className="profile-panel-section">
            <h2>Record</h2>
            {unitStats.length === 0 ? (
              <p className="profile-panel__empty">Take a quiz in Tools to track unit accuracy here.</p>
            ) : (
              <ul className="profile-records__units">
                {unitStats.map((unit) => (
                  <li key={unit.topic} className="profile-records__unit">
                    <div className="profile-records__unit-head">
                      <strong>{formatTopic(unit.topic)}</strong>
                      <span>{unit.accuracy}%</span>
                    </div>
                    <div
                      className="profile-bar profile-bar--unit"
                      role="progressbar"
                      aria-valuenow={unit.accuracy}
                      aria-valuemin={0}
                      aria-valuemax={100}
                    >
                      <span style={{ width: `${unit.accuracy}%` }} />
                    </div>
                    <p className="profile-bar__hint">
                      {unit.correct_answers} of {unit.attempts} correct
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </aside>
      </div>
    </section>
  )
}
