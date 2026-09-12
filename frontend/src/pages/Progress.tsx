import { useEffect, useState } from 'react'
import { getProgress, type Progress as ProgressData } from '../lib/api'
import type { AuthSession } from '../lib/auth'
import { getStudentId } from '../lib/session'
import './Progress.css'

type ProgressProps = {
  session: AuthSession | null
}

export function Progress({ session }: ProgressProps) {
  const [stats, setStats] = useState<ProgressData | null>(null)
  const studentId = session?.user.id ?? getStudentId()

  useEffect(() => {
    void getProgress(studentId, session?.access_token).then(setStats).catch(() => setStats(null))
  }, [studentId, session?.access_token])

  return (
    <section className="board">
      <h1>Progress board</h1>
      <p>Your streaks, scores, and weak spots will show up here.</p>
      <div className="board__grid">
        <article>
          <h2>Streak</h2>
          <p>{stats?.streak ?? '—'}</p>
        </article>
        <article>
          <h2>XP</h2>
          <p>{stats?.total_xp ?? '—'}</p>
        </article>
        <article>
          <h2>Accuracy</h2>
          <p>{stats ? `${stats.accuracy}%` : '—'}</p>
        </article>
      </div>
    </section>
  )
}
