import { useEffect, useState } from 'react'
import './HomeScreen.css'

const SCHOLAR_QUOTES = [
  { text: 'The only true wisdom is in knowing you know nothing.', author: 'Socrates', era: '470–399 BC' },
  { text: 'Knowing yourself is the beginning of all wisdom.', author: 'Aristotle', era: '384–322 BC' },
  { text: 'Imagination is more important than knowledge.', author: 'Albert Einstein', era: '1879–1955' },
  { text: 'Real knowledge is to know the extent of one\'s ignorance.', author: 'Confucius', era: '551–479 BC' },
  { text: 'If I have seen further it is by standing on the shoulders of giants.', author: 'Isaac Newton', era: '1643–1727' },
  { text: 'Learning never exhausts the mind.', author: 'Leonardo da Vinci', era: '1452–1519' },
  { text: 'The beginning is the most important part of the work.', author: 'Plato', era: '428–348 BC' },
  { text: 'The first principle is that you must not fool yourself — and you are the easiest person to fool.', author: 'Richard Feynman', era: '1918–1988' },
  { text: 'Reserve your right to think, for even to think wrongly is better than not to think at all.', author: 'Hypatia', era: 'c. 360–415' },
  { text: 'Nothing in life is to be feared, it is only to be understood.', author: 'Marie Curie', era: '1867–1934' },
  { text: 'The important thing is not to stop questioning. Curiosity has its own reason for existing.', author: 'Albert Einstein', era: '1879–1955' },
  { text: 'Education is the kindling of a flame, not the filling of a vessel.', author: 'Plutarch', era: 'c. 46–120' },
] as const

const CYCLE_MS = 7000

export function Home() {
  const [index, setIndex] = useState(0)
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    let transitionTimer = 0
    const timer = window.setInterval(() => {
      setVisible(false)
      transitionTimer = window.setTimeout(() => {
        setIndex((current) => (current + 1) % SCHOLAR_QUOTES.length)
        setVisible(true)
      }, 420)
    }, CYCLE_MS)
    return () => {
      window.clearInterval(timer)
      window.clearTimeout(transitionTimer)
    }
  }, [])

  const quote = SCHOLAR_QUOTES[index]

  function chooseQuote(nextIndex: number) {
    setVisible(false)
    window.setTimeout(() => {
      setIndex(nextIndex)
      setVisible(true)
    }, 220)
  }

  return (
    <section className="home" aria-label="Home">
      <div className="home__ornaments" aria-hidden="true">
        <span className="home__ring home__ring--a" />
        <span className="home__ring home__ring--b" />
        <span className="home__paper home__paper--a" />
        <span className="home__paper home__paper--b" />
        <span className="home__tab home__tab--coral" />
        <span className="home__tab home__tab--gold" />
        <span className="home__tab home__tab--violet" />
      </div>

      <header className="home__header">
        <p className="home__kicker">bindit</p>
        <h1 className="home__title">Words from the wise</h1>
      </header>

      <figure className={`home__quote ${visible ? 'is-visible' : 'is-fading'}`}>
        <blockquote className="home__text">
          <span className="home__mark" aria-hidden="true">“</span>
          {quote.text}
          <span className="home__mark home__mark--end" aria-hidden="true">”</span>
        </blockquote>
        <figcaption className="home__attribution">
          <cite className="home__author">{quote.author}</cite>
          <span className="home__era">{quote.era}</span>
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
            aria-label={`Quote ${i + 1} of ${SCHOLAR_QUOTES.length}: ${item.author}`}
            onClick={() => chooseQuote(i)}
          />
        ))}
      </div>
    </section>
  )
}
