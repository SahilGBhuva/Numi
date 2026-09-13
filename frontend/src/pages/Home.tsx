import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { getAccountProfile, getFriends, getProgress, type FriendsHub, type Profile, type Progress } from '../lib/api'
import type { AuthSession } from '../lib/auth'
import { getStudentId, loadNotebook } from '../lib/session'
import './HomeScreen.css'
import './HomeDashboard.css'

type HomeIconName = 'flame' | 'bolt' | 'cards' | 'scan' | 'target' | 'book' | 'trophy' | 'spark'

function HomeIcon({ name }: { name: HomeIconName }) {
  const paths: Record<HomeIconName, ReactNode> = {
    flame: <path d="M12 22c4.4 0 7-3 7-7.1 0-2.5-1.2-5.2-3.7-7.7.1 2-1 3.4-2 4.1.2-3.5-1.8-6.5-5.2-8.3.3 3-1.7 4.8-1.7 8.1C6.4 19 8.8 22 12 22Z" />,
    bolt: <path d="m13 2-8 12h6l-1 8 9-13h-6V2Z" />,
    cards: <><rect x="5" y="3" width="14" height="18" rx="2" /><path d="M9 8h6M9 12h6M9 16h4" /></>,
    scan: <path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3M7 12h10" />,
    target: <><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="3" /></>,
    book: <><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H11v16H6.5A2.5 2.5 0 0 0 4 21.5v-16ZM20 5.5A2.5 2.5 0 0 0 17.5 3H13v16h4.5a2.5 2.5 0 0 1 2.5 2.5v-16Z" /></>,
    trophy: <><path d="M8 4h8v5a4 4 0 0 1-8 0V4ZM12 13v5M8 21h8M9 18h6" /><path d="M8 6H4v2a4 4 0 0 0 4 4M16 6h4v2a4 4 0 0 1-4 4" /></>,
    spark: <path d="m12 3 1.4 5.6L19 10l-5.6 1.4L12 17l-1.4-5.6L5 10l5.6-1.4L12 3Z" />,
  }
  return <svg className="home-icon" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>
}

export function Home({ session }: { session: AuthSession | null }) {
  const [stats, setStats] = useState<Progress | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [social, setSocial] = useState<FriendsHub | null>(null)
  const notebook = useMemo(() => loadNotebook(), [])
  const studentId = session?.user.id ?? getStudentId()
  const accessToken = session?.access_token

  useEffect(() => {
    void getProgress(studentId, accessToken).then(setStats).catch(() => setStats(null))
    if (accessToken) {
      void getAccountProfile(accessToken).then(setProfile).catch(() => setProfile(null))
      void getFriends(accessToken).then(setSocial).catch(() => setSocial(null))
    }
  }, [studentId, accessToken])

  const xp = profile?.total_xp ?? stats?.total_xp ?? 0
  const streak = profile?.login_streak ?? stats?.login_streak ?? 0
  const dailyGoal = profile?.daily_goal ?? 20
  const todayXp = Math.min(xp, dailyGoal)
  const goalProgress = Math.min(100, (todayXp / dailyGoal) * 100)
  const activeCourse = notebook.activeCourse || notebook.courses[0]?.name
  const active = notebook.courses.find((course) => course.name === activeCourse)
  const unitCount = active?.units.length ?? 0
  const noteCount = notebook.deposits.filter((note) => note.course === activeCourse).length
  const accuracy = stats?.accuracy ?? 0
  const name = profile?.display_name?.split(' ')[0] ?? 'learner'
  const weakestTopic = stats?.topics.length
    ? [...stats.topics].sort((a, b) => a.accuracy - b.accuracy)[0]
    : null
  const recentNote = [...notebook.deposits]
    .filter((note) => note.course === activeCourse)
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))[0]
  const nextStep = weakestTopic
    ? { eyebrow: 'RECOMMENDED FOR YOU', title: `Strengthen ${weakestTopic.topic.replaceAll('_', ' ')}`, copy: `${weakestTopic.accuracy}% accuracy · a short quiz will target the gaps.`, href: '#tools', action: 'Practice now' }
    : noteCount
      ? { eyebrow: 'READY TO PRACTICE', title: 'Turn your newest notes into a quiz', copy: recentNote ? `${recentNote.fileName} is ready for grounded questions.` : 'Your notes are ready for grounded questions.', href: '#tools', action: 'Build a quiz' }
      : { eyebrow: 'START HERE', title: 'Add your first set of notes', copy: 'Scan a page or upload a file and Bindit will build your study path.', href: '#tools', action: 'Upload notes' }

  return (
    <section className="dashboard" aria-label="Home dashboard">
      <header className="dash-welcome">
        <div><p className="dash-eyebrow">Today</p><h1>Ready to learn, {name}?</h1><p>Pick up where you left off or start something new.</p></div>
        <div className="dash-streak" aria-label={`${streak} day streak`}><span><HomeIcon name="flame" /></span><strong>{streak}</strong><small>day streak</small></div>
      </header>

      <div className="dash-grid">
        <section className="dash-primary">
          <div className="daily-card">
            <div className="daily-card__top"><span className="daily-orbit" aria-hidden="true">◎</span><div><p>Daily goal</p><h2>{todayXp} of {dailyGoal} XP</h2></div><strong>{Math.round(goalProgress)}%</strong></div>
            <div className="dash-progress"><span style={{ width: `${goalProgress}%` }} /></div>
            <a className="dash-cta" href="#tools">Continue learning <span>→</span></a>
          </div>

          <section className="next-step-card">
            <div className="next-step-copy"><p>{nextStep.eyebrow}</p><h2>{nextStep.title}</h2><span>{nextStep.copy}</span></div>
            <a href={nextStep.href}>{nextStep.action}<span>→</span></a>
          </section>

          <div className="quick-grid" aria-label="Quick actions">
            <a href="#tools" className="quick-card is-purple"><span><HomeIcon name="bolt" /></span><strong>Quick quiz</strong><small>Test this unit</small></a>
            <a href="#tools" className="quick-card is-blue"><span><HomeIcon name="cards" /></span><strong>Review cards</strong><small>Practice recall</small></a>
            <a href="#tools" className="quick-card is-coral"><span><HomeIcon name="scan" /></span><strong>Scan notes</strong><small>Turn pages into practice</small></a>
          </div>

          <section className="continue-card">
            <div className="continue-head"><div><p>CONTINUE STUDYING</p><h2>{activeCourse || 'Start your first course'}</h2></div><a href="#tools">Open course</a></div>
            {activeCourse ? <div className="course-overview"><div className="course-badge">{activeCourse.slice(0, 2).toUpperCase()}</div><div><strong>{unitCount} unit{unitCount === 1 ? '' : 's'} ready</strong><span>{noteCount} uploaded note{noteCount === 1 ? '' : 's'} · {accuracy}% quiz accuracy</span></div></div> : <p className="empty-copy">Add a course and upload notes to get a personalized study path.</p>}
          </section>

        </section>

        <aside className="dash-side">
          <section className="stat-strip"><div><span><HomeIcon name="bolt" /></span><strong>{xp}</strong><small>Total XP</small></div><div><span><HomeIcon name="target" /></span><strong>{accuracy}%</strong><small>Accuracy</small></div><div><span><HomeIcon name="book" /></span><strong>{notebook.courses.length}</strong><small>Courses</small></div></section>
          <section className="league-card">
            <div className="section-title"><div><p>Your circle</p><h2>Friends this week</h2></div><a href="#profile">{social?.requests.length ? `${social.requests.length} new` : 'View all'}</a></div>
            <ol>{(social?.leaderboard ?? []).slice(0, 4).map((friend, index) => <li key={friend.student_id} className={friend.student_id === studentId ? 'is-you' : ''}><b>{index + 1}</b><span>{friend.display_name.slice(0, 1)}</span><div><strong>{friend.student_id === studentId ? 'You' : friend.display_name}</strong><small>{friend.active_today ? 'Learning today' : `🔥 ${friend.streak}`}</small></div><em>{friend.total_xp} XP</em></li>)}</ol>
            {!social?.leaderboard.length ? <p className="empty-copy">Add friends to unlock your private league.</p> : null}
          </section>
          <section className="quest-card"><span className="quest-icon"><HomeIcon name="trophy" /></span><div><p>Friend quest</p><h2>{social?.quests[0] ? `You + ${social.quests[0].friend_name}` : 'Learn better together'}</h2><small>{social?.quests[0] ? `${social.quests[0].progress_xp} / ${social.quests[0].target_xp} shared XP` : 'Start a shared goal from your profile.'}</small></div><a href="#profile" aria-label="Open friend quests">→</a></section>
        </aside>
      </div>
    </section>
  )
}
