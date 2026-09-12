import './Progress.css'

export function More() {
  return (
    <section className="board">
      <h1>More</h1>
      <p>Extra tools and pages that do not need their own rail slot.</p>
      <div className="board__grid">
        <article>
          <h2>Help</h2>
          <p>—</p>
        </article>
        <article>
          <h2>About</h2>
          <p>—</p>
        </article>
        <article>
          <h2>Feedback</h2>
          <p>—</p>
        </article>
      </div>
    </section>
  )
}
