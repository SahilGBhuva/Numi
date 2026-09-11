import './Progress.css'

export function Progress() {
  return (
    <section className="board">
      <h1>Progress board</h1>
      <p>Your streaks, scores, and weak spots will show up here.</p>
      <div className="board__grid">
        <article>
          <h2>Streak</h2>
          <p>—</p>
        </article>
        <article>
          <h2>XP</h2>
          <p>—</p>
        </article>
        <article>
          <h2>Accuracy</h2>
          <p>—</p>
        </article>
      </div>
    </section>
  )
}
