import './Progress.css'

export function Quests() {
  return (
    <section className="board">
      <h1>Quests</h1>
      <p>Daily and weekly study quests will show up on this board.</p>
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
