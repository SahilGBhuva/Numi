import { FormEvent, useEffect, useState } from 'react'
import { analyzeAnswer, checkHealth, generateQuestion } from '../lib/api'
import type { AnswerAnalysis, GeneratedQuestion } from '../lib/types'
import './Home.css'

type BackendStatus = 'checking' | 'up' | 'down'

export function Home() {
  const [backend, setBackend] = useState<BackendStatus>('checking')
  const [question, setQuestion] = useState<GeneratedQuestion | null>(null)
  const [answer, setAnswer] = useState('')
  const [result, setResult] = useState<AnswerAnalysis | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    checkHealth().then((ok) => {
      if (!cancelled) {
        setBackend(ok ? 'up' : 'down')
      }
    })
    return () => {
      cancelled = true
    }
  }, [])

  async function handleNewQuestion() {
    setBusy(true)
    setError('')
    setResult(null)
    setAnswer('')
    try {
      const next = await generateQuestion()
      setQuestion(next)
      setBackend('up')
    } catch {
      setBackend('down')
      setError('Could not get a question. Is the backend running?')
    } finally {
      setBusy(false)
    }
  }

  async function handleCheck(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!question) {
      return
    }
    setBusy(true)
    setError('')
    try {
      const analysis = await analyzeAnswer({
        question: question.question,
        studentAnswer: answer,
        correctAnswer: question.correct_answer,
        topic: question.topic,
      })
      setResult(analysis)
      setBackend('up')
    } catch {
      setBackend('down')
      setError('Could not check that answer. Is the backend running?')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="home">
      <header className="home__header">
        <h1 className="home__title">GameMath</h1>
        <p className={`home__status home__status--${backend}`} role="status">
          {backend === 'checking' && 'Checking backend…'}
          {backend === 'up' && 'Backend connected'}
          {backend === 'down' && 'Backend offline'}
        </p>
      </header>

      <main className="home__main">
        <p className="home__lead">
          Practice a math question from Sahil’s Pocket Tutor API.
        </p>

        <button
          className="home__button"
          type="button"
          onClick={handleNewQuestion}
          disabled={busy}
        >
          {question ? 'New question' : 'Get a question'}
        </button>

        {question ? (
          <form className="home__form" onSubmit={handleCheck}>
            <p className="home__prompt">{question.question}</p>
            <label className="home__field">
              <span>Your answer</span>
              <input
                type="text"
                name="answer"
                value={answer}
                onChange={(event) => setAnswer(event.target.value)}
                autoComplete="off"
                disabled={busy}
              />
            </label>
            <button className="home__button" type="submit" disabled={busy || !answer.trim()}>
              Check answer
            </button>
          </form>
        ) : null}

        {error ? <p className="home__error">{error}</p> : null}

        {result ? (
          <div className="home__result" role="status">
            <p>{result.explanation}</p>
            {result.hint ? <p>{result.hint}</p> : null}
            <p>
              XP {result.total_xp} · streak {result.streak}
            </p>
          </div>
        ) : null}
      </main>
    </div>
  )
}
