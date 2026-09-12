import { useEffect, useState } from 'react'
import { getAccountProfile, getProgress, type Profile as ProfileData, type Progress as ProgressData } from '../lib/api'
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
            <h2>Friends</h2>
            <div className="profile-friends__row">
              <span className="profile-friends__avatar is-empty" aria-hidden="true" />
              <span className="profile-friends__avatar is-empty" aria-hidden="true" />
              <span className="profile-friends__avatar is-empty" aria-hidden="true" />
            </div>
            {!session || !profile?.friend_code ? (
              <p className="profile-friends__hint">Add friends with your tag in Settings</p>
            ) : (
              <p className="profile-friends__hint">Share tag {profile.friend_code}</p>
            )}
          </section>

          <div className="profile-records__streak">
            <span className="profile-records__streak-icon" aria-hidden="true">🔥</span>
            <span>Streak: {loginStreak}</span>
          </div>
        </div>

        <aside className="profile-panels">
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
