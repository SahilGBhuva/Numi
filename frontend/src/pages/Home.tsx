import { useEffect, useMemo, useState } from 'react'
import { getAccountProfile, getFriends, getProgress, type FriendsHub, type Profile, type Progress } from '../lib/api'
import type { AuthSession } from '../lib/auth'
import { getStudentId, loadNotebook } from '../lib/session'
import './HomeScreen.css'

const QUOTES = [
  ['The beginning is the most important part of the work.', 'Plato'],
  ['Learning never exhausts the mind.', 'Leonardo da Vinci'],
  ['Nothing in life is to be feared, it is only to be understood.', 'Marie Curie'],
] as const

export function Home({ session }: { session: AuthSession | null }) {
  const [stats, setStats] = useState<Progress | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [social, setSocial] = useState<FriendsHub | null>(null)
  const notebook = useMemo(() => loadNotebook(), [])
  const studentId = session?.user.id ?? getStudentId()
  const accessToken = session?.access_token
  const quote = QUOTES[new Date().getDate() % QUOTES.length]

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

  return (
    <section className="dashboard" aria-label="Home dashboard">
      <header className="dash-welcome">
        <div><p className="dash-eyebrow">TODAY’S STUDY PLAN</p><h1>Ready to learn, {name}?</h1><p>Keep your streak moving with one focused session.</p></div>
        <div className="dash-streak" aria-label={`${streak} day streak`}><span>🔥</span><strong>{streak}</strong><small>day streak</small></div>
      </header>

      <div className="dash-grid">
        <section className="dash-primary">
          <div className="daily-card">
            <div className="daily-card__top"><span className="daily-orbit" aria-hidden="true">◎</span><div><p>Daily goal</p><h2>{todayXp} of {dailyGoal} XP</h2></div><strong>{Math.round(goalProgress)}%</strong></div>
            <div className="dash-progress"><span style={{ width: `${goalProgress}%` }} /></div>
            <a className="dash-cta" href="#tools">Continue learning <span>→</span></a>
          </div>

          <div className="quick-grid" aria-label="Quick actions">
            <a href="#tools" className="quick-card is-purple"><span>⚡</span><strong>Quick quiz</strong><small>Test this unit</small></a>
            <a href="#tools" className="quick-card is-blue"><span>▤</span><strong>Review cards</strong><small>Practice recall</small></a>
            <a href="#tools" className="quick-card is-coral"><span>⌁</span><strong>Scan notes</strong><small>Turn pages into practice</small></a>
          </div>

          <section className="continue-card">
            <div className="continue-head"><div><p>CONTINUE STUDYING</p><h2>{activeCourse || 'Start your first course'}</h2></div><a href="#tools">Open course</a></div>
            {activeCourse ? <div className="course-overview"><div className="course-badge">{activeCourse.slice(0, 2).toUpperCase()}</div><div><strong>{unitCount} unit{unitCount === 1 ? '' : 's'} ready</strong><span>{noteCount} uploaded note{noteCount === 1 ? '' : 's'} · {accuracy}% quiz accuracy</span></div></div> : <p className="empty-copy">Add a course and upload notes to get a personalized study path.</p>}
          </section>

          <section className="topic-card">
            <div className="section-title"><div><p>YOUR PROGRESS</p><h2>Skills to strengthen</h2></div><a href="#progress">See all</a></div>
            <div className="skill-list">
              {(stats?.topics ?? []).slice(0, 3).map((topic) => <div className="skill-row" key={topic.topic}><span>{topic.topic.replaceAll('_', ' ')}</span><div><i style={{ width: `${topic.accuracy}%` }} /></div><strong>{topic.accuracy}%</strong></div>)}
              {!stats?.topics.length ? <p className="empty-copy">Take a quiz and your strongest and weakest skills will appear here.</p> : null}
            </div>
          </section>
        </section>

        <aside className="dash-side">
          <section className="stat-strip"><div><span>⚡</span><strong>{xp}</strong><small>Total XP</small></div><div><span>🎯</span><strong>{accuracy}%</strong><small>Accuracy</small></div><div><span>📚</span><strong>{notebook.courses.length}</strong><small>Courses</small></div></section>
          <section className="league-card">
            <div className="section-title"><div><p>FRIENDS LEAGUE</p><h2>This week</h2></div><a href="#profile">View</a></div>
            <ol>{(social?.leaderboard ?? []).slice(0, 4).map((friend, index) => <li key={friend.student_id} className={friend.student_id === studentId ? 'is-you' : ''}><b>{index + 1}</b><span>{friend.display_name.slice(0, 1)}</span><div><strong>{friend.student_id === studentId ? 'You' : friend.display_name}</strong><small>{friend.active_today ? 'Learning today' : `🔥 ${friend.streak}`}</small></div><em>{friend.total_xp} XP</em></li>)}</ol>
            {!social?.leaderboard.length ? <p className="empty-copy">Add friends to unlock your private league.</p> : null}
          </section>
          <section className="quest-card"><span className="quest-icon">🏆</span><div><p>FRIEND QUEST</p><h2>{social?.quests[0] ? `You + ${social.quests[0].friend_name}` : 'Learn better together'}</h2><small>{social?.quests[0] ? `${social.quests[0].progress_xp} / ${social.quests[0].target_xp} shared XP` : 'Start a shared XP goal from your profile.'}</small></div><a href="#profile">→</a></section>
          <figure className="wisdom-card"><blockquote>“{quote[0]}”</blockquote><figcaption>— {quote[1]}</figcaption></figure>
        </aside>
      </div>
    </section>
  )
}
