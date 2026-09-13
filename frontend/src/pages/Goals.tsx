import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { getFriends, getProgress, startFriendQuest, type FriendQuest, type Progress as ProgressData } from '../lib/api'
import type { AuthSession } from '../lib/auth'
import { loadUnitAttempts } from '../lib/progress'
import {
  goalProgress,
  loadGoals,
  loadQuests,
  offerQuests,
  pruneQuests,
  questProgress,
  saveGoals,
  saveQuests,
  settleQuests,
  startQuest,
  type GoalKind,
  type PersonalGoal,
  type QuestOffer,
  type QuestStats,
} from '../lib/quests'
import { getStudentId, loadNotebook, withCourseTones } from '../lib/session'
import './Goals.css'

type Panel = 'board' | 'goals'

export function Goals({ session }: { session: AuthSession | null }) {
  const [panel, setPanel] = useState<Panel>('board')
  const [notebook] = useState(() => {
    const loaded = loadNotebook()
    return { ...loaded, courses: withCourseTones(loaded.courses) }
  })
  const [quests, setQuests] = useState(() => pruneQuests(loadQuests()))
  const [goals, setGoals] = useState(() => loadGoals())
  const [stats, setStats] = useState<ProgressData | null>(null)
  const [friendQuests, setFriendQuests] = useState<FriendQuest[]>([])
  const [friendName, setFriendName] = useState('')
  const [friendId, setFriendId] = useState('')
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')
  const [title, setTitle] = useState('')
  const [kind, setKind] = useState<GoalKind>('custom')
  const [target, setTarget] = useState(3)
  const [due, setDue] = useState('')
  const [course, setCourse] = useState(notebook.activeCourse || notebook.courses[0]?.name || '')
  const studentId = session?.user.id ?? getStudentId()

  const snapshot: QuestStats = useMemo(
    () => ({
      xp: stats?.total_xp ?? 0,
      loginStreak: stats?.login_streak ?? 0,
      deposits: notebook.deposits,
      attempts: loadUnitAttempts(),
    }),
    [notebook.deposits, stats],
  )

  const offers = useMemo(() => {
    const liveIds = new Set(quests.filter((item) => !item.doneAt).map((item) => item.id))
    return offerQuests(notebook.courses, notebook.deposits, snapshot.attempts, 20).filter(
      (item) => !liveIds.has(item.id),
    )
  }, [notebook.courses, notebook.deposits, quests, snapshot.attempts])

  const live = quests.filter((item) => !item.doneAt)
  const done = quests.filter((item) => item.doneAt)

  useEffect(() => {
    void getProgress(studentId, session?.access_token)
      .then(setStats)
      .catch(() => setStats(null))
  }, [studentId, session?.access_token])

  useEffect(() => {
    if (!session) return
    void getFriends(session.access_token)
      .then((hub) => {
        setFriendQuests(hub.quests)
        const pal = hub.friends[0]
        setFriendName(pal?.display_name ?? '')
        setFriendId(pal?.student_id ?? '')
      })
      .catch(() => undefined)
  }, [session])

  useEffect(() => {
    const next = settleQuests(quests, snapshot)
    if (JSON.stringify(next) !== JSON.stringify(quests)) {
      setQuests(next)
      saveQuests(next)
    }
  }, [quests, snapshot])

  function pinQuest(offer: QuestOffer) {
    const next = startQuest(offer, snapshot, quests)
    setQuests(next)
    saveQuests(next)
    setNotice(`Pinned “${offer.title}”.`)
  }

  function dropQuest(id: string) {
    const next = quests.filter((item) => item.id !== id)
    setQuests(next)
    saveQuests(next)
  }

  function addGoal(event: FormEvent) {
    event.preventDefault()
    const name = title.trim()
    if (!name) return
    const goal: PersonalGoal = {
      id: crypto.randomUUID(),
      title: name,
      kind,
      target: Math.max(1, Math.round(target)),
      due,
      course: kind === 'custom' ? '' : course,
      createdAt: Date.now(),
      baseline: kind === 'xp' ? snapshot.xp : 0,
      done: false,
    }
    const next = [goal, ...goals]
    setGoals(next)
    saveGoals(next)
    setTitle('')
    setNotice(`Goal set: ${name}`)
  }

  function toggleGoal(id: string) {
    const next = goals.map((item) => (item.id === id ? { ...item, done: !item.done } : item))
    setGoals(next)
    saveGoals(next)
  }

  function removeGoal(id: string) {
    const next = goals.filter((item) => item.id !== id)
    setGoals(next)
    saveGoals(next)
  }

  async function beginFriendQuest() {
    if (!session || !friendId) return
    setBusy(true)
    try {
      const quest = await startFriendQuest(friendId, session.access_token)
      setFriendQuests((current) => [quest, ...current])
      setNotice(`Quest started with ${friendName}.`)
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Could not start that friend quest.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="quest-page">
      <header className="quest-page__head">
        <p className="quest-page__kicker">Quest board</p>
        <h1>Quests</h1>
        <p>
          Bindet pins missions from your courses, notes, and XP. Write your own goals when you want something
          specific.
        </p>
      </header>

      <nav className="quest-dir" aria-label="Quests and goals">
        <button className={panel === 'board' ? 'is-on' : ''} type="button" onClick={() => setPanel('board')}>
          Quest board
        </button>
        <button className={panel === 'goals' ? 'is-on' : ''} type="button" onClick={() => setPanel('goals')}>
          My goals
        </button>
      </nav>

      {panel === 'board' ? (
        <div className="quest-layout">
          <section className="quest-col">
            <h2>Take a ticket</h2>
            <p>These refresh with your binder. Pin up to four at a time.</p>
            {offers.length === 0 ? (
              <p className="quest-empty">Every ticket on today’s board is already pinned.</p>
            ) : (
              <ul className="quest-offers">
                {offers.map((offer) => (
                  <li key={offer.id} style={{ ['--quest-tone' as string]: offer.tone }}>
                    <span className="quest-tab" aria-hidden="true" />
                    <div>
                      <small>{offer.window === 'day' ? 'Today' : offer.window === 'week' ? 'This week' : 'Open'}</small>
                      <h3>{offer.title}</h3>
                      <p>{offer.hint}</p>
                    </div>
                    <button type="button" onClick={() => pinQuest(offer)} disabled={live.length >= 4}>
                      Pin
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="quest-col">
            <h2>On the binder</h2>
            <p>
              {stats
                ? `${stats.total_xp} XP · ${stats.login_streak}-day login streak`
                : 'Progress will fill in as you study.'}
            </p>
            {live.length === 0 && done.length === 0 ? (
              <p className="quest-empty">Pin a ticket and it will track from this moment.</p>
            ) : (
              <ul className="quest-live">
                {live.map((item) => {
                  const value = Math.min(item.target, questProgress(item, snapshot))
                  return (
                    <li key={item.id} style={{ ['--quest-tone' as string]: item.tone }}>
                      <span className="quest-tab" aria-hidden="true" />
                      <div>
                        <small>
                          {value} / {item.target}
                          {item.kind === 'xp' ? ' XP' : item.kind === 'quiz' ? ' answers' : item.kind === 'notes' ? ' notes' : ' days'}
                        </small>
                        <h3>{item.title}</h3>
                        <div className="quest-bar" aria-hidden="true">
                          <span style={{ width: `${Math.min(100, (value / item.target) * 100)}%` }} />
                        </div>
                      </div>
                      <button type="button" onClick={() => dropQuest(item.id)}>
                        Drop
                      </button>
                    </li>
                  )
                })}
                {done.map((item) => (
                  <li key={item.id} className="is-done" style={{ ['--quest-tone' as string]: item.tone }}>
                    <span className="quest-tab" aria-hidden="true" />
                    <div>
                      <small>Cleared</small>
                      <h3>{item.title}</h3>
                    </div>
                  </li>
                ))}
              </ul>
            )}

            {session ? (
              <div className="quest-friends">
                <h3>Friend quests</h3>
                {friendQuests.map((item) => (
                  <p key={item.id}>
                    You + {item.friend_name}: {item.progress_xp} / {item.target_xp} XP
                  </p>
                ))}
                {friendId ? (
                  <button type="button" disabled={busy} onClick={() => void beginFriendQuest()}>
                    Start 100 XP with {friendName}
                  </button>
                ) : (
                  <p>Add a friend on Profile to run a shared XP quest.</p>
                )}
              </div>
            ) : null}
          </section>
        </div>
      ) : (
        <div className="quest-layout">
          <form className="quest-goal-form" onSubmit={addGoal}>
            <h2>Set a goal</h2>
            <p>Your own target. Bindet will count XP, notes, or quizzes if you pick those kinds.</p>
            <label>
              Goal
              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Finish chapter 4, 30 quiz answers…"
                required
              />
            </label>
            <div className="quest-goal-row">
              <label>
                Kind
                <select value={kind} onChange={(event) => setKind(event.target.value as GoalKind)}>
                  <option value="custom">Check off yourself</option>
                  <option value="xp">XP</option>
                  <option value="notes">Notes</option>
                  <option value="quiz">Quiz answers</option>
                </select>
              </label>
              <label>
                Target
                <input
                  type="number"
                  min={1}
                  max={1000}
                  value={target}
                  onChange={(event) => setTarget(Number(event.target.value))}
                />
              </label>
            </div>
            <div className="quest-goal-row">
              {kind !== 'custom' && notebook.courses.length > 0 ? (
                <label>
                  Course
                  <select value={course} onChange={(event) => setCourse(event.target.value)}>
                    <option value="">Any course</option>
                    {notebook.courses.map((item) => (
                      <option key={item.name} value={item.name}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
              <label>
                Due
                <input type="date" value={due} onChange={(event) => setDue(event.target.value)} />
              </label>
            </div>
            <button type="submit">Save goal</button>
          </form>

          <section className="quest-col">
            <h2>Your list</h2>
            {goals.length === 0 ? (
              <p className="quest-empty">No personal goals yet. Set one on the left.</p>
            ) : (
              <ul className="quest-live">
                {goals.map((item) => {
                  const value = Math.min(item.target, goalProgress(item, snapshot))
                  const met = item.done || value >= item.target
                  return (
                    <li key={item.id} className={met ? 'is-done' : ''} style={{ ['--quest-tone' as string]: '#e0a045' }}>
                      <span className="quest-tab" aria-hidden="true" />
                      <div>
                        <small>
                          {item.kind === 'custom' ? (item.done ? 'Done' : 'Open') : `${value} / ${item.target}`}
                          {item.due ? ` · due ${item.due}` : ''}
                          {item.course ? ` · ${item.course}` : ''}
                        </small>
                        <h3>{item.title}</h3>
                        {item.kind !== 'custom' ? (
                          <div className="quest-bar" aria-hidden="true">
                            <span style={{ width: `${Math.min(100, (value / item.target) * 100)}%` }} />
                          </div>
                        ) : null}
                      </div>
                      {item.kind === 'custom' ? (
                        <button type="button" onClick={() => toggleGoal(item.id)}>
                          {item.done ? 'Undo' : 'Done'}
                        </button>
                      ) : (
                        <button type="button" onClick={() => removeGoal(item.id)}>
                          Remove
                        </button>
                      )}
                    </li>
                  )
                })}
              </ul>
            )}
          </section>
        </div>
      )}

      {notice ? (
        <p className="notice" role="status">
          {notice}
        </p>
      ) : null}
    </section>
  )
}
