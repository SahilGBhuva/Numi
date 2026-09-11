import { useEffect, useMemo, useState } from 'react'
import { analyzeAnswer, generateQuestion, getProgress } from '../lib/api'
import type { AnswerResult, GeneratedQuestion, Progress, Topic } from '../lib/api'
import { loadAuthSession, refreshAuthSession } from '../lib/auth'
import type { AuthSession } from '../lib/auth'
import { getStudentId } from '../lib/session'
import { AccountPanel } from '../components/AccountPanel'
import './Home.css'

const QUESTIONS_PER_LESSON = 5
const topics: { id: Topic; label: string; icon: string; color: string }[] = [
  { id: 'mixed', label: 'Daily mix', icon: '✦', color: '#7658ff' },
  { id: 'addition', label: 'Addition', icon: '+', color: '#00bfa6' },
  { id: 'subtraction', label: 'Subtract', icon: '−', color: '#ff8a4c' },
  { id: 'multiplication', label: 'Multiply', icon: '×', color: '#f14c8a' },
  { id: 'division', label: 'Division', icon: '÷', color: '#3b8cff' },
]

export function Home() {
  const [guestId] = useState(() => getStudentId())
  const [session, setSession] = useState<AuthSession | null>(() => loadAuthSession())
  const [accountOpen, setAccountOpen] = useState(false)
  const [topic, setTopic] = useState<Topic>('mixed')
  const [difficulty, setDifficulty] = useState(1)
  const [questionNumber, setQuestionNumber] = useState(1)
  const [question, setQuestion] = useState<GeneratedQuestion | null>(null)
  const [answer, setAnswer] = useState('')
  const [result, setResult] = useState<AnswerResult | null>(null)
  const [progress, setProgress] = useState<Progress | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const studentId = session?.user.id ?? guestId
  const accessToken = session?.access_token
  const activeTopic = useMemo(() => topics.find((item) => item.id === topic)!, [topic])

  async function loadQuestion(nextTopic = topic, nextDifficulty = difficulty, nextQuestionNumber = questionNumber) {
    setLoading(true); setError(null); setResult(null); setAnswer('')
    try {
      setQuestion(await generateQuestion(nextTopic, nextDifficulty))
      setQuestionNumber(nextQuestionNumber)
    }
    catch { setError('Start the backend to begin your lesson.') }
    finally { setLoading(false) }
  }

  useEffect(() => {
    // The initial API request intentionally seeds the first interactive challenge.
    // oxlint-disable-next-line react/set-state-in-effect
    void loadQuestion('mixed', 1)
  }, [])

  useEffect(() => {
    void getProgress(studentId, accessToken).then(setProgress).catch(() => undefined)
  }, [studentId, accessToken])

  useEffect(() => {
    if (session) void refreshAuthSession(session).then((refreshed) => {
      if (refreshed?.access_token !== session.access_token) {
        setProgress(null)
        setSession(refreshed)
      }
    })
  }, [session])

  function changeSession(nextSession: AuthSession | null) {
    setProgress(null)
    setSession(nextSession)
  }

  async function submitAnswer(event: React.FormEvent) {
    event.preventDefault()
    if (!question || result) return
    setLoading(true)
    try {
      const answerResult = await analyzeAnswer(question, answer, studentId, accessToken)
      setResult(answerResult)
      setProgress((current) => {
        const attempts = (current?.attempts ?? 0) + 1
        const correctAnswers = (current?.correct_answers ?? 0) + Number(answerResult.correct)
        return {
          student_id: studentId, total_xp: answerResult.total_xp, attempts,
          correct_answers: correctAnswers, accuracy: Math.round(correctAnswers / attempts * 1000) / 10,
          streak: answerResult.streak, best_streak: Math.max(current?.best_streak ?? 0, answerResult.streak),
          weak_topics: current?.weak_topics ?? [],
        }
      })
    } catch { setError('We could not reach the tutor. Check that the backend is running.') }
    finally { setLoading(false) }
  }

  function chooseTopic(next: Topic) { setTopic(next); void loadQuestion(next, difficulty, 1) }
  function chooseDifficulty(next: number) { setDifficulty(next); void loadQuestion(topic, next, 1) }
  function advanceQuestion() {
    const nextQuestionNumber = questionNumber === QUESTIONS_PER_LESSON ? 1 : questionNumber + 1
    void loadQuestion(topic, difficulty, nextQuestionNumber)
  }
  const xp = progress?.total_xp ?? result?.total_xp ?? 0
  const streak = progress?.streak ?? result?.streak ?? 0
  const accuracy = progress?.accuracy ?? 0

  return <main className="home">
    <header className="topbar">
      <a className="brand" href="#top"><span className="brand-mark">B</span><span>bindit</span></a>
      <div className="stats"><span><b>🔥</b> {streak}</span><span><b>⚡</b> {xp} XP</span><button className={`avatar ${session ? 'signed-in' : ''}`} onClick={() => setAccountOpen(true)} aria-label="Open account">{session?.user.email?.[0].toUpperCase() ?? 'S'}</button></div>
    </header>

    <section className="hero" id="top">
      <div><span className="eyebrow">YOUR DAILY MATH ADVENTURE</span><h1>Small steps.<br /><em>Big brain energy.</em></h1><p>Master math through quick challenges, smart hints, and a streak worth protecting.</p></div>
      <div className="mascot-card" aria-hidden="true"><div className="orbit orbit-one"/><div className="orbit orbit-two"/><div className="mascot">◕‿◕</div><span className="spark spark-one">✦</span><span className="spark spark-two">✦</span></div>
    </section>

    <section className="workspace">
      <aside className="path-panel">
        <div className="section-heading"><div><span className="eyebrow">CHOOSE A SKILL</span><h2>Your learning path</h2></div><span className="level-pill">Level {difficulty}</span></div>
        <div className="topic-list">{topics.map((item, index) => <button className={`topic-card ${topic === item.id ? 'active' : ''}`} key={item.id} onClick={() => chooseTopic(item.id)} style={{ '--topic-color': item.color } as React.CSSProperties}><span className="topic-icon">{item.icon}</span><span><strong>{item.label}</strong><small>{index === 0 ? 'A little of everything' : `Stage ${index} · 8 lessons`}</small></span><span className="topic-arrow">→</span></button>)}</div>
      </aside>

      <section className="lesson-card" style={{ '--topic-color': activeTopic.color } as React.CSSProperties}>
        <div className="lesson-top"><div><span className="lesson-label">{activeTopic.icon} {activeTopic.label}</span><span className="question-count">QUESTION {questionNumber} OF {QUESTIONS_PER_LESSON}</span></div><div className="difficulty">{[1,2,3].map((level) => <button key={level} className={difficulty === level ? 'active' : ''} onClick={() => chooseDifficulty(level)}>{level}</button>)}</div></div>
        <div className="progress-track"><span style={{ width: `${questionNumber / QUESTIONS_PER_LESSON * 100}%` }} /></div>
        <div className="question-area">
          {error ? <div className="empty-state"><span>🔌</span><h3>Almost ready!</h3><p>{error}</p><button onClick={() => loadQuestion()}>Try again</button></div> : loading && !question ? <div className="loader">Thinking up a good one…</div> : <>
            <span className="prompt-kicker">Solve this</span><h3>{question?.question}</h3>
            <form onSubmit={submitAnswer}><label htmlFor="answer">Your answer</label><div className="answer-row"><input id="answer" inputMode="decimal" autoComplete="off" value={answer} onChange={(event) => setAnswer(event.target.value)} placeholder="Type your answer" disabled={Boolean(result)} autoFocus/><button className="check-button" disabled={loading || !answer.trim() || Boolean(result)}>{loading ? 'Checking…' : 'Check answer'}</button></div></form>
            {result && <div className={`feedback ${result.correct ? 'correct' : 'incorrect'}`} role="status"><span className="feedback-icon">{result.correct ? '✓' : '↗'}</span><div><strong>{result.correct ? `Brilliant! +${result.xp_earned} XP` : 'Not quite—keep going.'}</strong><p>{result.correct ? result.explanation : result.hint}</p></div><button onClick={advanceQuestion}>{result.correct ? 'Next challenge' : 'Try another'} →</button></div>}
          </>}
        </div>
      </section>
    </section>

    <section className="progress-section">
      <div className="section-heading"><div><span className="eyebrow">YOUR MOMENTUM</span><h2>Today’s progress</h2></div><span className="sync-note"><i/> Saved to your profile</span></div>
      <div className="progress-grid"><article><span className="metric-icon purple">⚡</span><div><small>TOTAL XP</small><strong>{xp}</strong><p>Keep the energy going</p></div></article><article><span className="metric-icon orange">🔥</span><div><small>CURRENT STREAK</small><strong>{streak} {streak === 1 ? 'day' : 'days'}</strong><p>Come back tomorrow</p></div></article><article><span className="metric-icon teal">◎</span><div><small>ACCURACY</small><strong>{accuracy}%</strong><p>{progress?.attempts ?? 0} answers recorded</p></div></article></div>
    </section>
    {accountOpen && <AccountPanel
      session={session}
      onSession={changeSession}
      onClose={() => setAccountOpen(false)}
    />}
  </main>
}
