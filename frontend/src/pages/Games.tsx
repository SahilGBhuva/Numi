import './Progress.css'

export function Games() {
  return (
    <section className="board">
      <h1>Games</h1>
      <p>Study games will land here. Pick a unit in Tools, then come back to play.</p>
      <span className="board__tabs" aria-hidden="true"><i /><i /><i /></span>
      <div className="board__grid">
        <article>
          <h2>Arcade</h2>
          <p>—</p>
        </article>
        <article>
          <h2>Matches</h2>
          <p>—</p>
        </article>
        <article>
          <h2>High score</h2>
          <p>—</p>
        </article>
      </div>
    </section>
  )
}
