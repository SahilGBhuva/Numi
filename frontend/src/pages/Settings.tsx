import './Progress.css'

export function Settings() {
  return (
    <section className="board">
      <h1>Settings</h1>
      <p>App options will live here. Nothing is wired to a backend yet.</p>
      <div className="board__grid">
        <article>
          <h2>Sound</h2>
          <p>—</p>
        </article>
        <article>
          <h2>Theme</h2>
          <p>—</p>
        </article>
        <article>
          <h2>Account</h2>
          <p>—</p>
        </article>
      </div>
    </section>
  )
}
