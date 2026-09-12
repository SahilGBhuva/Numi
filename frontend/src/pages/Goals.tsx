import './Progress.css'

export function Goals() {
  return (
    <section className="board">
      <h1>Goals</h1>
      <p>Daily and weekly study goals will show up on this board.</p>
      <span className="board__tabs" aria-hidden="true"><i /><i /><i /></span>
      <div className="board__grid">
        <article>
          <h2>Daily</h2>
          <p>—</p>
        </article>
        <article>
          <h2>Weekly</h2>
          <p>—</p>
        </article>
        <article>
          <h2>Rewards</h2>
          <p>—</p>
        </article>
      </div>
    </section>
  )
}
