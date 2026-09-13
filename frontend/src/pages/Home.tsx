import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import {
  getAccountProfile,
  getFriends,
  getProgress,
  type FriendsHub,
  type Profile,
  type Progress as ProgressData,
} from '../lib/api'
import type { AuthSession } from '../lib/auth'
import { buildCoursePulse, loadUnitAttempts } from '../lib/progress'
import { getStudentId, loadNotebook, loadSession, saveNotebook } from '../lib/session'
import { isTutorialComplete, startTutorial } from '../lib/tutorial'
import './HomeScreen.css'

type SearchHit = {
  kind: 'course' | 'unit' | 'note'
  label: string
  meta: string
  course: string
  unit?: string
}

type GlyphName = 'notes' | 'quiz' | 'scan' | 'goal' | 'search' | 'bell' | 'spark' | 'arrow' | 'users'

function Glyph({ name }: { name: GlyphName }) {
  const common = {
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  }

  if (name === 'notes') {
    return <svg viewBox="0 0 24 24" aria-hidden="true"><path {...common} d="M6 3.5h8l4 4V20H6z" /><path {...common} d="M14 3.5V8h4M9 12h6M9 15.5h6" /></svg>
  }
  if (name === 'quiz') {
    return <svg viewBox="0 0 24 24" aria-hidden="true"><path {...common} d="m13.8 2.8-7.2 10h5.7l-2 8.4 7.1-10.8h-5.2z" /></svg>
  }
  if (name === 'scan') {
    return <svg viewBox="0 0 24 24" aria-hidden="true"><path {...common} d="M8 4H5a1 1 0 0 0-1 1v3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3" /><path {...common} d="M8 12h8" /></svg>
  }
  if (name === 'goal') {
    return <svg viewBox="0 0 24 24" aria-hidden="true"><circle {...common} cx="12" cy="12" r="7.5" /><circle {...common} cx="12" cy="12" r="3.3" /><path {...common} d="M12 4V2.5M20 12h1.5" /></svg>
  }
  if (name === 'search') {
    return <svg viewBox="0 0 24 24" aria-hidden="true"><circle {...common} cx="10.5" cy="10.5" r="6" /><path {...common} d="m15 15 4.8 4.8" /></svg>
  }
  if (name === 'bell') {
    return <svg viewBox="0 0 24 24" aria-hidden="true"><path {...common} d="M6.5 9.8c0-3.3 2.2-5.8 5.5-5.8s5.5 2.5 5.5 5.8v4.1l1.5 2.4H5l1.5-2.4zM9.5 19h5" /></svg>
  }
  if (name === 'spark') {
    return <svg viewBox="0 0 24 24" aria-hidden="true"><path {...common} d="m12 3 1.2 4.2L17 9l-3.8 1.8L12 15l-1.2-4.2L7 9l3.8-1.8zM18.5 15.5l.6 2.1 1.9.9-1.9.9-.6 2.1-.6-2.1-1.9-.9 1.9-.9z" /></svg>
  }
  if (name === 'users') {
    return <svg viewBox="0 0 24 24" aria-hidden="true"><circle {...common} cx="9" cy="9" r="3" /><circle {...common} cx="16.5" cy="10" r="2.4" /><path {...common} d="M3.5 19c.5-3.4 2.4-5.2 5.5-5.2 3.2 0 5.1 1.8 5.5 5.2M14 14.5c3.6-.5 5.7 1 6.2 4.5" /></svg>
  }
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path {...common} d="M5 12h13M14 8l4 4-4 4" /></svg>
}

function initials(value: string) {
  const parts = value.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return 'B'
  return parts.slice(0, 2).map((part) => part[0]?.toUpperCase()).join('')
}

function friendlyEmailName(email?: string) {
  const raw = email?.split('@')[0]?.replace(/[._-]+/g, ' ').trim() ?? ''
  if (!raw) return 'there'
  return raw.replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function courseInitials(name: string) {
  const words = name.trim().split(/\s+/).filter(Boolean)
  if (words.length > 1) return `${words[0][0] ?? ''}${words[1][0] ?? ''}`.toUpperCase()
  return name.slice(0, 2).toUpperCase()
}

export function Home({ session }: { session?: AuthSession | null }) {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [stats, setStats] = useState<ProgressData | null>(null)
  const [social, setSocial] = useState<FriendsHub | null>(null)
  const [tutorialComplete, setTutorialComplete] = useState(isTutorialComplete)
  const [query, setQuery] = useState('')
  const searchRef = useRef<HTMLInputElement>(null)
  const notebook = useMemo(() => loadNotebook(), [])
  const attempts = useMemo(() => loadUnitAttempts(), [])
  const studySession = useMemo(() => loadSession(), [])
  const studentId = session?.user.id ?? getStudentId()

  useEffect(() => {
    let live = true
    void getProgress(studentId, session?.access_token)
      .then((value) => { if (live) setStats(value) })
      .catch(() => { if (live) setStats(null) })

    if (session?.access_token) {
      void getAccountProfile(session.access_token)
        .then((value) => { if (live) setProfile(value) })
        .catch(() => { if (live) setProfile(null) })
      void getFriends(session.access_token)
        .then((value) => { if (live) setSocial(value) })
        .catch(() => { if (live) setSocial(null) })
    } else {
      setProfile(null)
      setSocial(null)
    }

    return () => { live = false }
  }, [studentId, session?.access_token])

  useEffect(() => {
    const onComplete = () => setTutorialComplete(true)
    window.addEventListener('bindet:tutorial-complete', onComplete)
    return () => window.removeEventListener('bindet:tutorial-complete', onComplete)
  }, [])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        searchRef.current?.focus()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  const pulses = useMemo(
    () => notebook.courses.map((course) => buildCoursePulse(course, notebook.deposits, attempts, stats?.topics ?? [])),
    [notebook, attempts, stats?.topics],
  )
  const activePulse = pulses.find((pulse) => pulse.course.name === notebook.activeCourse) ?? pulses[0] ?? null
  const focusPulse = pulses.find((pulse) => pulse.verdict === 'slipping' || pulse.verdict === 'stuck') ?? activePulse
  const focusUnit = focusPulse?.recommended || focusPulse?.course.units[0] || ''
  const displayName = profile?.display_name?.trim() || friendlyEmailName(session?.user.email)
  const dateLabel = new Intl.DateTimeFormat(undefined, { weekday: 'short', month: 'short', day: 'numeric' }).format(new Date())
  const totalXp = stats?.total_xp ?? profile?.total_xp ?? studySession?.xp ?? 0
  const accuracy = Math.round(stats?.accuracy ?? 0)
  const streak = stats?.login_streak ?? profile?.login_streak ?? 0
  const dailyGoal = Math.max(profile?.daily_goal ?? 20, 1)
  const sessionXp = Math.max(studySession?.xp ?? 0, 0)
  const goalProgress = Math.min(100, Math.round((sessionXp / dailyGoal) * 100))
  const pending = social?.requests.length ?? 0
  const circle = (social?.leaderboard?.length ? social.leaderboard : social?.friends ?? []).slice(0, 3)
  const friendQuest = social?.quests.find((quest) => quest.status === 'active') ?? social?.quests[0] ?? null

  const searchHits = useMemo<SearchHit[]>(() => {
    const needle = query.trim().toLowerCase()
    if (!needle) return []
    const hits: SearchHit[] = []
    for (const course of notebook.courses) {
      if (course.name.toLowerCase().includes(needle)) {
        hits.push({ kind: 'course', label: course.name, meta: `${course.units.length} units`, course: course.name })
      }
      for (const unit of course.units) {
        if (unit.toLowerCase().includes(needle)) {
          hits.push({ kind: 'unit', label: unit, meta: course.name, course: course.name, unit })
        }
      }
    }
    for (const note of notebook.deposits) {
      if (note.fileName.toLowerCase().includes(needle)) {
        hits.push({ kind: 'note', label: note.fileName, meta: `${note.course} · ${note.unit || 'Unsorted'}`, course: note.course, unit: note.unit })
      }
    }
    return hits.slice(0, 6)
  }, [notebook, query])

  function openCourse(courseName: string, unit?: string) {
    const course = notebook.courses.find((item) => item.name === courseName)
    const nextUnit = unit || course?.units[0] || ''
    saveNotebook({ ...notebook, activeCourse: courseName, activeUnit: nextUnit })
    window.location.hash = 'tools'
  }

  function openHit(hit: SearchHit) {
    setQuery('')
    openCourse(hit.course, hit.unit)
  }

  const quickActions: { label: string; hint: string; href: string; glyph: GlyphName; tone: string }[] = [
    { label: 'Add notes', hint: 'Turn class material into something usable.', href: '#tools', glyph: 'notes', tone: 'blue' },
    { label: 'Start a quiz', hint: 'Practice the unit that needs attention.', href: '#tools', glyph: 'quiz', tone: 'violet' },
    { label: 'Review progress', hint: 'See mastery, accuracy, and weak spots.', href: '#progress', glyph: 'scan', tone: 'green' },
    { label: 'Set a goal', hint: 'Make the next study win concrete.', href: '#goals', glyph: 'goal', tone: 'gold' },
  ]

  return (
    <section className="home-dashboard" aria-label="Home dashboard">
      <header className="home-dashboard__topbar">
        <div className="home-search">
          <Glyph name="search" />
          <input
            ref={searchRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Escape') setQuery('')
              if (event.key === 'Enter' && searchHits[0]) openHit(searchHits[0])
            }}
            placeholder="Search courses, units, or notes…"
            aria-label="Search courses, units, or notes"
          />
          <kbd>⌘ K</kbd>
          {query.trim() ? (
            <div className="home-search__results" role="listbox" aria-label="Search results">
              {searchHits.length ? searchHits.map((hit, index) => (
                <button key={`${hit.kind}-${hit.course}-${hit.unit ?? hit.label}-${index}`} type="button" onClick={() => openHit(hit)}>
                  <span className={`home-search__kind is-${hit.kind}`}>{hit.kind}</span>
                  <span className="home-search__result-copy">
                    <strong>{hit.label}</strong>
                    <small>{hit.meta}</small>
                  </span>
                  <span aria-hidden="true">↗</span>
                </button>
              )) : (
                <div className="home-search__empty">No matching course, unit, or note.</div>
              )}
            </div>
          ) : null}
        </div>

        <div className="home-dashboard__account">
          <a className="home-dashboard__notification" href="#profile" aria-label={pending ? `${pending} friend requests` : 'Profile notifications'}>
            <Glyph name="bell" />
            {pending ? <span>{pending}</span> : null}
          </a>
          <a className="home-dashboard__profile-chip" href="#profile">
            <span className="home-dashboard__avatar">{initials(displayName)}</span>
            <span>{displayName}</span>
            <span className="home-dashboard__chevron" aria-hidden="true">⌄</span>
          </a>
        </div>
      </header>

      <div className="home-dashboard__layout">
        <main className="home-dashboard__main">
          <section className="home-dashboard__welcome">
            <div>
              <p>Good {new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 18 ? 'afternoon' : 'evening'}, {displayName}</p>
              <h1>Let’s make <span>progress</span> today.</h1>
              <div className="home-dashboard__welcome-sub">Study smarter, stay organized, and keep your next move obvious.</div>
            </div>
            <div className="home-dashboard__date">{dateLabel}</div>
          </section>

          <section className="home-focus-card">
            <div className="home-focus-card__glow" aria-hidden="true" />
            <div className="home-focus-card__top">
              <div className="home-focus-card__goal-icon"><Glyph name="goal" /></div>
              <div className="home-focus-card__goal-copy">
                <span>Daily goal</span>
                <strong>{sessionXp} of {dailyGoal} XP</strong>
              </div>
              <strong className="home-focus-card__percent">{goalProgress}%</strong>
            </div>
            <div className="home-focus-card__bar" role="progressbar" aria-label="Daily XP goal" aria-valuemin={0} aria-valuemax={dailyGoal} aria-valuenow={Math.min(sessionXp, dailyGoal)}>
              <span style={{ width: `${goalProgress}%` }} />
            </div>
            <div className="home-focus-card__bottom">
              <div>
                <span className="home-focus-card__eyebrow">Suggested focus</span>
                <strong>{focusPulse ? focusPulse.course.name : 'Build your first course'}</strong>
                <small>{focusUnit ? `${focusUnit} · ${focusPulse?.mastery ?? 0}% course mastery` : 'Add notes and units to start your study map.'}</small>
              </div>
              <button type="button" onClick={() => focusPulse ? openCourse(focusPulse.course.name, focusUnit) : (window.location.hash = 'tools')}>
                {focusPulse ? 'Keep going' : 'Get started'}
                <Glyph name="arrow" />
              </button>
            </div>
          </section>

          <section className="home-quick-grid" aria-label="Quick actions">
            {quickActions.map((action) => (
              <a key={action.label} className={`home-quick-card is-${action.tone}`} href={action.href}>
                <span className="home-quick-card__icon"><Glyph name={action.glyph} /></span>
                <strong>{action.label}</strong>
                <p>{action.hint}</p>
                <span className="home-quick-card__arrow"><Glyph name="arrow" /></span>
              </a>
            ))}
          </section>

          <section className="home-courses-panel">
            <div className="home-panel-heading">
              <div>
                <span>Your courses</span>
                <small>{notebook.deposits.length} uploaded note{notebook.deposits.length === 1 ? '' : 's'} across {notebook.courses.length} course{notebook.courses.length === 1 ? '' : 's'}</small>
              </div>
              <a href="#tools">View workspace <span aria-hidden="true">→</span></a>
            </div>

            <div className="home-course-grid">
              {pulses.slice(0, 3).map((pulse) => {
                const tone = pulse.course.tone ?? '#7667f2'
                const notes = notebook.deposits.filter((note) => note.course === pulse.course.name).length
                return (
                  <button
                    key={pulse.course.name}
                    type="button"
                    className="home-course-card"
                    style={{ '--course-tone': tone } as CSSProperties}
                    onClick={() => openCourse(pulse.course.name, pulse.recommended)}
                  >
                    <span className="home-course-card__icon">{courseInitials(pulse.course.name)}</span>
                    <span className="home-course-card__name">{pulse.course.name}</span>
                    <span className="home-course-card__meta">{pulse.course.units.length} units · {notes} notes</span>
                    <span className="home-course-card__progress"><span style={{ width: `${pulse.mastery}%` }} /></span>
                    <span className="home-course-card__mastery">{pulse.mastery}% mastery</span>
                  </button>
                )
              })}
              <a className="home-course-card home-course-card--add" href="#tools">
                <span className="home-course-card__plus">+</span>
                <strong>Add course</strong>
                <small>Grow your workspace</small>
              </a>
            </div>
          </section>

          <a className="home-assistant-bar" href="#tools">
            <span className="home-assistant-bar__spark"><Glyph name="spark" /></span>
            <span><strong>Need help?</strong> Open bindit study tools.</span>
            <span className="home-assistant-bar__prompt">Explain a concept</span>
            <span className="home-assistant-bar__prompt">Make practice</span>
            <span className="home-assistant-bar__go"><Glyph name="arrow" /></span>
          </a>
        </main>

        <aside className="home-dashboard__side">
          <a className="home-streak-card" href="#progress">
            <span className="home-streak-card__fire">🔥</span>
            <span><strong>{streak} day streak</strong><small>{streak ? 'Keep the chain alive.' : 'Start your streak today.'}</small></span>
            <span aria-hidden="true">›</span>
          </a>

          <section className="home-side-card home-stats-card">
            <div className="home-side-card__head"><strong>Your stats</strong><a href="#progress">View all →</a></div>
            <div className="home-stats-card__grid">
              <div><span>⚡</span><strong>{totalXp}</strong><small>Total XP</small></div>
              <div><span>◎</span><strong>{accuracy}%</strong><small>Accuracy</small></div>
              <div><span>▤</span><strong>{notebook.courses.length}</strong><small>Courses</small></div>
            </div>
          </section>

          <section className="home-side-card home-circle-card">
            <div className="home-side-card__head"><strong>Your circle</strong><a href="#profile">View all →</a></div>
            {circle.length ? (
              <div className="home-circle-card__list">
                {circle.map((friend, index) => (
                  <div key={friend.student_id} className="home-circle-person">
                    <span className="home-circle-person__rank">{index + 1}</span>
                    <span className="home-circle-person__avatar">{initials(friend.display_name || friend.username)}</span>
                    <span className="home-circle-person__copy"><strong>{friend.display_name || friend.username}</strong><small>{friend.active_today ? 'Active today' : `${friend.streak} day streak`}</small></span>
                    <strong className="home-circle-person__xp">{friend.total_xp} XP</strong>
                  </div>
                ))}
              </div>
            ) : (
              <div className="home-circle-card__empty">
                <span className="home-circle-card__empty-icon"><Glyph name="users" /></span>
                <strong>{pending ? `${pending} request${pending === 1 ? '' : 's'} waiting` : 'Study is better together.'}</strong>
                <p>{pending ? 'Open your profile to respond.' : 'Add friends and compare progress without turning studying into a popularity contest.'}</p>
                <a href="#profile">{pending ? 'Review requests' : 'Add a friend'} →</a>
              </div>
            )}
          </section>

          <section className="home-together-card">
            <div className="home-together-card__icon"><Glyph name="users" /></div>
            <div>
              <span>{friendQuest ? 'Friend quest' : 'Study together'}</span>
              <strong>{friendQuest ? `With ${friendQuest.friend_name}` : 'Learn better together'}</strong>
              <p>{friendQuest ? `${friendQuest.progress_xp} of ${friendQuest.target_xp} shared XP` : 'Invite a friend, share a goal, and keep each other moving.'}</p>
            </div>
            {friendQuest ? (
              <div className="home-together-card__questbar"><span style={{ width: `${Math.min(100, Math.round((friendQuest.progress_xp / Math.max(friendQuest.target_xp, 1)) * 100))}%` }} /></div>
            ) : null}
            <a href="#profile">{friendQuest ? 'Open quest' : 'Invite friends'} <span aria-hidden="true">→</span></a>
          </section>

          {!tutorialComplete ? (
            <section className="home-tour-card">
              <span>New workspace</span>
              <strong>Take the 60-second tour.</strong>
              <p>See where notes, practice, progress, and goals live.</p>
              <button type="button" onClick={() => startTutorial()}>Start tutorial</button>
            </section>
          ) : null}
        </aside>
      </div>
    </section>
  )
}
