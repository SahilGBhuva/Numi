import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { answerFriendRequest, blockSocialUser, getAccountProfile, getFriends, getProgress, reactToActivity, readSocialNotifications, removeFriend, reportSocialUser, saveSocialPrivacy, searchFriends, sendFriendRequest, startFriendQuest, type FriendsHub, type PersonSuggestion, type Profile as ProfileData, type Progress as ProgressData } from '../lib/api'
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
  const [peopleQuery, setPeopleQuery] = useState('')
  const [peopleResults, setPeopleResults] = useState<PersonSuggestion[]>([])
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
    if (!session) return
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

  async function findPeople(event: FormEvent) {
    event.preventDefault()
    if (!session || peopleQuery.trim().length < 2) return
    setSocialBusy(true)
    try {
      setPeopleResults(await searchFriends(peopleQuery, session.access_token))
    } finally {
      setSocialBusy(false)
    }
  }

  async function addSuggested(person: PersonSuggestion) {
    if (!session) return
    setSocialBusy(true)
    try {
      await sendFriendRequest(person.friend_code, session.access_token)
      setPeopleResults((current) => current.filter((item) => item.student_id !== person.student_id))
      setSocialMessage(`Friend request sent to ${person.display_name}.`)
      await refreshFriends()
    } finally {
      setSocialBusy(false)
    }
  }

  async function shareFriendId() {
    if (!profile?.friend_code) return
    const share = { title: 'Add me on bindet', text: `Add me on bindet with friend ID ${profile.friend_code}`, url: window.location.origin }
    try {
      if (navigator.share) await navigator.share(share)
      else {
        await navigator.clipboard.writeText(`${share.text} — ${share.url}`)
        setSocialMessage('Friend ID copied. Paste it into Messages, Instagram, or any app.')
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return
      setSocialMessage('Could not open sharing. You can copy the ID above.')
    }
  }

  async function celebrate(eventId: number) {
    if (!session) return
    await reactToActivity(eventId, session.access_token)
    await refreshFriends()
  }

  async function markNotificationsRead() {
    if (!session) return
    await readSocialNotifications(session.access_token)
    await refreshFriends()
  }

  async function togglePrivacy(field: 'discoverable' | 'allow_friend_requests') {
    if (!session || !profile) return
    const discoverable = field === 'discoverable' ? !profile.discoverable : profile.discoverable
    const requests = field === 'allow_friend_requests' ? !profile.allow_friend_requests : profile.allow_friend_requests
    await saveSocialPrivacy(discoverable, requests, session.access_token)
    setProfile({ ...profile, discoverable, allow_friend_requests: requests })
  }

  async function blockFriend(friendId: string) {
    if (!session || !window.confirm('Block this person? They will be removed and unable to find or contact you.')) return
    await blockSocialUser(friendId, session.access_token)
    setSocialMessage('Person blocked.')
    await refreshFriends()
  }

  async function reportFriend(friendId: string) {
    if (!session || !window.confirm('Send a safety report about this person?')) return
    await reportSocialUser(friendId, session.access_token)
    setSocialMessage('Report sent. Thank you for helping keep bindet safe.')
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
            <h2>Friends <span>{social?.friends.length ?? 0}</span></h2>
            {profile?.friend_code ? (
              <div className="friend-id-card">
                <span><small>Your friend ID</small><strong>{profile.friend_code}</strong></span>
                <button type="button" onClick={() => void shareFriendId()}>Share ID</button>
              </div>
            ) : null}
            {session ? (
              <>
                <form className="friend-add" onSubmit={findPeople}>
                  <input value={peopleQuery} onChange={(event) => setPeopleQuery(event.target.value)} placeholder="Search name or username" maxLength={40} aria-label="Search people" />
                  <button disabled={socialBusy || peopleQuery.trim().length < 2}>Search</button>
                </form>
                <form className="friend-add friend-add--code" onSubmit={addFriend}>
                  <input value={friendCode} onChange={(event) => setFriendCode(event.target.value.toUpperCase())} placeholder="Or enter friend ID" maxLength={12} aria-label="Friend ID" />
                  <button disabled={socialBusy || !friendCode.trim()}>Add</button>
                </form>
              </>
            ) : null}
            {(peopleResults.length ? peopleResults : social?.suggestions ?? []).slice(0, 4).map((person) => (
              <div className="person-result" key={person.student_id}>
                <span className="friend-face">{person.display_name.slice(0, 1).toUpperCase()}</span>
                <span><strong>{person.display_name}</strong><small>@{person.username}</small></span>
                <button onClick={() => void addSuggested(person)} disabled={socialBusy}>Add</button>
              </div>
            ))}
            {social?.requests.map((request) => (
              <div className="friend-request" key={request.request_id}>
                <span><strong>{request.display_name}</strong><small>@{request.username}</small></span>
                <button onClick={() => void answerRequest(request.request_id, true)} disabled={socialBusy}>Accept</button>
                <button className="is-quiet" onClick={() => void answerRequest(request.request_id, false)} disabled={socialBusy}>×</button>
              </div>
            ))}
            <div className="profile-friends__row">
              {social?.friends.slice(0, 5).map((friend) => (
                <span className="profile-friends__avatar" key={friend.student_id} title={friend.display_name}>{friend.display_name.slice(0, 1).toUpperCase()}</span>
              ))}
              {!social?.friends.length ? <span className="profile-friends__avatar is-empty" aria-hidden="true">+</span> : null}
            </div>
            {social?.friends.map((friend) => (
              <div className="friend-mini" key={friend.student_id}>
                <span><strong>{friend.display_name}</strong><small>{friend.friend_streak} day friend streak · {friend.weekly_xp} XP this week</small></span>
                <button onClick={() => void beginQuest(friend.student_id)} disabled={socialBusy}>Quest</button>
                <details className="friend-menu"><summary aria-label={`Options for ${friend.display_name}`}>•••</summary><div><button onClick={() => void unfriend(friend.student_id)}>Remove</button><button onClick={() => void reportFriend(friend.student_id)}>Report</button><button className="is-danger" onClick={() => void blockFriend(friend.student_id)}>Block</button></div></details>
              </div>
            ))}
            {!session || !profile?.friend_code ? (
              <p className="profile-friends__hint">Add friends with your tag in Settings</p>
            ) : (
              <p className="profile-friends__hint">Use Share ID to send it with your phone’s share menu.</p>
            )}
            {socialMessage ? <p className="profile-social-message" role="status">{socialMessage}</p> : null}
          </section>

          <div className="profile-records__streak">
            <span className="profile-records__streak-icon" aria-hidden="true">🔥</span>
            <span>Streak: {loginStreak}</span>
          </div>
        </div>

        <aside className="profile-panels">
          <section className="profile-panel-section social-league">
            <div className="panel-heading"><h2>Weekly League</h2><span>Resets Monday</span></div>
            {!social?.leaderboard.length ? <p className="profile-panel__empty">Add a friend to start your weekly competition.</p> : (
              <ol className="friend-leaderboard">
                {social.leaderboard.map((friend, index) => (
                  <li key={friend.student_id} className={friend.student_id === studentId ? 'is-me' : ''}>
                    <span className="friend-rank">{index + 1}</span>
                    <span className="friend-face">{friend.display_name.slice(0, 1).toUpperCase()}</span>
                    <span className="friend-name"><strong>{friend.student_id === studentId ? 'You' : friend.display_name}</strong><small>{friend.active_today ? 'Active today' : `${friend.streak} day study streak`}</small></span>
                    <strong className="friend-xp">{friend.weekly_xp} XP</strong>
                  </li>
                ))}
              </ol>
            )}
          </section>

          <section className="profile-panel-section social-activity">
            <h2>Friend Activity</h2>
            {social?.activity.slice(0, 6).map((event) => (
              <article className="activity-item" key={event.id}>
                <span className="friend-face">{event.display_name.slice(0, 1).toUpperCase()}</span>
                <p><strong>{event.student_id === studentId ? 'You' : event.display_name}</strong> earned {event.xp} XP<small>{new Date(event.created_at).toLocaleDateString()}</small></p>
                {event.student_id !== studentId ? <button className={event.reacted ? 'is-reacted' : ''} onClick={() => void celebrate(event.id)} aria-label="Celebrate this activity">High five{event.reaction_count ? ` · ${event.reaction_count}` : ''}</button> : null}
              </article>
            ))}
            {!social?.activity.length ? <p className="profile-panel__empty">Study activity from you and your friends will appear here.</p> : null}
          </section>

          <section className="profile-panel-section social-notifications">
            <div className="panel-heading"><h2>Notifications</h2>{social?.notifications.some((item) => !item.is_read) ? <button onClick={() => void markNotificationsRead()}>Mark read</button> : null}</div>
            {social?.notifications.slice(0, 5).map((item) => <p className={item.is_read ? '' : 'is-unread'} key={item.id}>{item.message}</p>)}
            {!social?.notifications.length ? <p className="profile-panel__empty">You’re all caught up.</p> : null}
          </section>

          {profile ? <section className="profile-panel-section social-privacy">
            <h2>Social Privacy</h2>
            <label><span><strong>Appear in search</strong><small>Let learners find your profile.</small></span><input type="checkbox" checked={profile.discoverable} onChange={() => void togglePrivacy('discoverable')} /></label>
            <label><span><strong>Friend requests</strong><small>Allow new people to add you.</small></span><input type="checkbox" checked={profile.allow_friend_requests} onChange={() => void togglePrivacy('allow_friend_requests')} /></label>
          </section> : null}

          <section className="profile-panel-section friend-quests">
            <h2>Friend Quests</h2>
            {social?.quests.map((quest) => (
              <div className="friend-quest" key={quest.id}>
                <div><strong>You + {quest.friend_name}</strong><span>{quest.progress_xp} / {quest.target_xp} XP</span></div>
                <div className="profile-bar"><span style={{ width: `${Math.min(100, quest.progress_xp / quest.target_xp * 100)}%` }} /></div>
              </div>
            ))}
            {!social?.quests.length && social?.friends.length ? (
              <button className="quest-start" disabled={socialBusy} onClick={() => void beginQuest(social.friends[0].student_id)}>Start a 100 XP quest with {social.friends[0].display_name}</button>
            ) : null}
            {!social?.friends.length ? <p className="profile-panel__empty">Friend Quests unlock after you add a friend.</p> : null}
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
