import { AvatarControl } from '../lib/AvatarControl'
import './Progress.css'

type ProfileProps = {
  onError?: (message: string) => void
}

export function Profile({ onError }: ProfileProps) {
  return (
    <section className="board">
      <h1>Profile</h1>
      <p>Tap the avatar to set your photo. Stats will connect later.</p>
      <div className="board__grid">
        <article>
          <h2>Avatar</h2>
          <div className="board__avatar">
            <AvatarControl onError={onError} />
          </div>
        </article>
        <article>
          <h2>Name</h2>
          <p>B</p>
        </article>
        <article>
          <h2>Level</h2>
          <p>—</p>
        </article>
      </div>
    </section>
  )
}
