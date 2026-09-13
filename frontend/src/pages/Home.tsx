import { useEffect, useState } from 'react'
import { getFriends, type FriendsHub } from '../lib/api'
import type { AuthSession } from '../lib/auth'
import { isTutorialComplete, startTutorial } from '../lib/tutorial'
import './HomeScreen.css'

const SCHOLAR_QUOTES = [
  { text: 'The important thing is not to stop questioning.', author: 'Albert Einstein', era: '1879–1955' },
  { text: 'The beginning is the most important part of the work.', author: 'Plato', era: '428–348 BC' },
  { text: 'Real knowledge is to know the extent of one’s ignorance.', author: 'Confucius', era: '551–479 BC' },
  { text: 'Learning never exhausts the mind.', author: 'Leonardo da Vinci', era: '1452–1519' },
  { text: 'Nothing in life is to be feared, it is only to be understood.', author: 'Marie Curie', era: '1867–1934' },
  { text: 'The first principle is that you must not fool yourself.', author: 'Richard Feynman', era: '1918–1988' },
] as const

const CYCLE_MS = 7600

export function Home({ session }: { session?: AuthSession | null }) {
  const [index, setIndex] = useState(0)
  const [visible, setVisible] = useState(true)
  const [tutorialComplete, setTutorialComplete] = useState(isTutorialComplete)
  const [social, setSocial] = useState<FriendsHub | null>(null)

  useEffect(() => {
    const timer = window.setInterval(() => {
      setVisible(false)
      window.setTimeout(() => {
        setIndex((current) => (current + 1) % SCHOLAR_QUOTES.length)
        setVisible(true)
      }, 260)
    }, CYCLE_MS)

    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    const onComplete = () => setTutorialComplete(true)
    window.addEventListener('bindet:tutorial-complete', onComplete)
    return () => window.removeEventListener('bindet:tutorial-complete', onComplete)
  }, [])

  useEffect(() => {
    if (!session?.access_token) {
      setSocial(null)
      return
    }
    void getFriends(session.access_token)
      .then(setSocial)
      .catch(() => setSocial(null))
  }, [session?.access_token])

  const quote = SCHOLAR_QUOTES[index]
  const pending = social?.requests.length ?? 0
  const friendCount = social?.friends.length ?? 0
  const socialTitle = pending > 0
    ? `${pending} request${pending === 1 ? '' : 's'} waiting`
    : friendCount > 0
      ? `${friendCount} study friend${friendCount === 1 ? '' : 's'}`
      : 'Build your circle'

  return (
    <section className="home" aria-label="Home">
      <div className="home__ambient" aria-hidden="true" />

      <div className="home__grid">
        <div className="home__hero">
          <div className="home__eyebrow">
            <span className="home__status-dot" />
            bindit workspace
          </div>

          <div className="home__identity">
            <img src="/bindit-mascot.webp" alt="" className="home__mascot" />
            <span>Everything you study, connected.</span>
          </div>

          <h1 className="home__title">
            Turn scattered schoolwork into a system you can actually use.
          </h1>
          <p className="home__lede">
            Capture notes, practice what matters, track what is sticking, and keep your next move obvious.
          </p>

          <div className="home__cta-row">
            <a className="home__cta home__cta--primary" href="#tools">
              Open workspace
              <span aria-hidden="true">→</span>
            </a>
            <a className="home__cta home__cta--secondary" href="#progress">
              View progress
            </a>
          </div>

          <div className="home__signal-row" aria-label="Workspace highlights">
            <div>
              <strong>Notes → practice</strong>
              <span>Keep study material actionable</span>
            </div>
            <div>
              <strong>Progress that means something</strong>
              <span>See where to focus next</span>
            </div>
            <div>
              <strong>Built for consistency</strong>
              <span>Quests, streaks, and momentum</span>
            </div>
          </div>
        </div>

        <aside className="home__quote-card" aria-label="Study thought">
          <div className="home__quote-topline">
            <span>Thought for the session</span>
            <span>{String(index + 1).padStart(2, '0')} / {String(SCHOLAR_QUOTES.length).padStart(2, '0')}</span>
          </div>

          <figure className={`home__quote ${visible ? 'is-visible' : 'is-fading'}`}>
            <blockquote className="home__text">“{quote.text}”</blockquote>
            <figcaption className="home__attribution">
              <cite>{quote.author}</cite>
              <span>{quote.era}</span>
            </figcaption>
          </figure>

          <div className="home__progress" role="tablist" aria-label="Quote progress">
            {SCHOLAR_QUOTES.map((item, i) => (
              <button
                key={`${item.author}-${i}`}
                type="button"
                role="tab"
                className={`home__dot ${i === index ? 'is-active' : ''}`}
                aria-selected={i === index}
                aria-label={`Quote ${i + 1}: ${item.author}`}
                onClick={() => {
                  setVisible(false)
                  window.setTimeout(() => {
                    setIndex(i)
                    setVisible(true)
                  }, 180)
                }}
              />
            ))}
          </div>
        </aside>
      </div>

      <div className="home__actions" aria-label="Quick actions">
        <a className="home__action" href="#tools">
          <span className="home__action-index">01</span>
          <strong>Build your binder</strong>
          <p>Drop in notes, organize units, and turn raw material into something useful.</p>
          <span className="home__action-arrow" aria-hidden="true">↗</span>
        </a>
        <a className="home__action" href="#goals">
          <span className="home__action-index">02</span>
          <strong>Pick the next win</strong>
          <p>Use focused quests so studying feels finite instead of endless.</p>
          <span className="home__action-arrow" aria-hidden="true">↗</span>
        </a>
        <a className="home__action" href="#progress">
          <span className="home__action-index">03</span>
          <strong>Find the weak spot</strong>
          <p>Check momentum and course progress before deciding what to review.</p>
          <span className="home__action-arrow" aria-hidden="true">↗</span>
        </a>
        <a className="home__action" href="#profile">
          <span className="home__action-index">04</span>
          <strong>{session ? socialTitle : 'Set up your profile'}</strong>
          <p>{session ? 'Study with people you know and keep each other moving.' : 'Sign in when you want synced progress and social features.'}</p>
          <span className="home__action-arrow" aria-hidden="true">↗</span>
        </a>
      </div>

      {!tutorialComplete ? (
        <div className="home__tutorial">
          <div>
            <span>First time here?</span>
            <strong>Take the 60-second product tour.</strong>
          </div>
          <button type="button" onClick={() => startTutorial()}>
            Start tutorial
          </button>
        </div>
      ) : null}
    </section>
  )
}
