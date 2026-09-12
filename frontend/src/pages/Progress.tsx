import { useEffect, useMemo, useState } from 'react'
import { getProgress, type Progress as ProgressData } from '../lib/api'
import type { AuthSession } from '../lib/auth'
import {
  VERDICT_COPY,
  areaPath,
  buildCoursePulse,
  loadUnitAttempts,
  smoothPath,
  type CoursePulse,
  type UnitJudgment,
} from '../lib/progress'
import { getStudentId, loadNotebook, withCourseTones } from '../lib/session'
import './Progress.css'

const GRAPH = { w: 720, h: 248, x: 44, y: 22 }

type ProgressProps = {
  session: AuthSession | null
}

export function Progress({ session }: ProgressProps) {
  const [stats, setStats] = useState<ProgressData | null>(null)
  const [notebook, setNotebook] = useState(() => {
    const loaded = loadNotebook()
    return { ...loaded, courses: withCourseTones(loaded.courses) }
  })
  const [selected, setSelected] = useState(() => notebook.activeCourse || notebook.courses[0]?.name || '')
  const [focusUnit, setFocusUnit] = useState('')
  const [hover, setHover] = useState<number | null>(null)
  const [howOpen, setHowOpen] = useState(false)
  const studentId = session?.user.id ?? getStudentId()

  useEffect(() => {
    void getProgress(studentId, session?.access_token).then(setStats).catch(() => setStats(null))
  }, [studentId, session?.access_token])

  useEffect(() => {
    const sync = () => {
      const loaded = loadNotebook()
      const courses = withCourseTones(loaded.courses)
      setNotebook({ ...loaded, courses })
      setSelected((current) =>
        courses.some((course) => course.name === current) ? current : courses[0]?.name ?? '',
      )
    }
    sync()
    window.addEventListener('storage', sync)
    window.addEventListener('hashchange', sync)
    return () => {
      window.removeEventListener('storage', sync)
      window.removeEventListener('hashchange', sync)
    }
  }, [])

  const attempts = useMemo(() => loadUnitAttempts(), [notebook, stats, selected])
  const courses = notebook.courses
  const activeCourse = courses.find((course) => course.name === selected) ?? courses[0]
  const pulse = useMemo(
    () =>
      activeCourse
        ? buildCoursePulse(activeCourse, notebook.deposits, attempts, stats?.topics ?? [])
        : null,
    [activeCourse, notebook.deposits, attempts, stats],
  )

  return (
    <section className="board progress-page">
      <header className="progress-head">
        <p className="progress-kicker">Progress</p>
        <h1>Course pulse</h1>
        <p>Each course gets its own mastery graph and unit roadmap. Judgment uses quiz history, accuracy, and notes.</p>
      </header>

      {courses.length === 0 || !pulse ? (
        <div className="progress-empty">
          <strong>No courses yet</strong>
          <p>Add a course in Tools and this board will grow a graph and roadmap for it.</p>
          <a href="#tools">Open Tools</a>
        </div>
      ) : (
        <>
          <nav className="progress-courses" aria-label="Courses">
            {courses.map((course) => (
              <button
                key={course.name}
                type="button"
                className={`progress-course ${course.name === pulse.course.name ? 'is-on' : ''}`}
                style={{ ['--tone' as string]: course.tone ?? '#2a6ea8' }}
                onClick={() => {
                  setSelected(course.name)
                  setFocusUnit('')
                  setHover(null)
                }}
              >
                {course.name}
              </button>
            ))}
          </nav>

          <CourseBoard
            pulse={pulse}
            stats={stats}
            focusUnit={focusUnit}
            hover={hover}
            howOpen={howOpen}
            onHow={() => setHowOpen((open) => !open)}
            onFocus={setFocusUnit}
            onHover={setHover}
          />
        </>
      )}
    </section>
  )
}

function CourseBoard({
  pulse,
  stats,
  focusUnit,
  hover,
  howOpen,
  onHow,
  onFocus,
  onHover,
}: {
  pulse: CoursePulse
  stats: ProgressData | null
  focusUnit: string
  hover: number | null
  howOpen: boolean
  onHow: () => void
  onFocus: (name: string) => void
  onHover: (index: number | null) => void
}) {
  const { palette, course } = pulse
  const sampleUnits = course.units.length === 0
  const activeLine = pulse.series.find((line) => line.name === focusUnit)
  const hoverIndex = hover ?? pulse.labels.length - 1
  const hoverValue = (activeLine?.values ?? pulse.overall)[hoverIndex] ?? pulse.mastery

  return (
    <article className="progress-board" style={{ ['--tone' as string]: palette.tone, ['--tone-soft' as string]: palette.soft }}>
      <header className="progress-hero">
        <div>
          <p className="progress-hero__kicker">{course.name}</p>
          <h2>{pulse.mastery}<small> mastery</small></h2>
          <p className="progress-hero__reason">{pulse.reason}</p>
        </div>
        <div className="progress-hero__meta">
          <span className={`verdict verdict--${pulse.verdict}`}>{VERDICT_COPY[pulse.verdict].label}</span>
          <span className={`progress-live ${pulse.live ? 'is-live' : ''}`}>
            {pulse.live ? 'Live quizzes' : 'Draft sample'}
          </span>
        </div>
      </header>

      <dl className="progress-stats">
        <div>
          <dt>Streak</dt>
          <dd>{stats?.streak ?? '—'}</dd>
        </div>
        <div>
          <dt>XP</dt>
          <dd>{stats?.total_xp ?? '—'}</dd>
        </div>
        <div>
          <dt>Accuracy</dt>
          <dd>{stats ? `${stats.accuracy}%` : '—'}</dd>
        </div>
        <div>
          <dt>Next up</dt>
          <dd>{pulse.recommended || '—'}</dd>
        </div>
      </dl>

      <figure className="progress-graph">
        <figcaption>
          <div>
            <strong>{course.name} mastery by session</strong>
            <span>
              {activeLine ? activeLine.name : 'Course average'} · session {hoverIndex + 1} · {hoverValue}%
            </span>
          </div>
          <button type="button" className="progress-how" aria-expanded={howOpen} onClick={onHow}>
            How we judge
          </button>
        </figcaption>
        <PulseGraph pulse={pulse} focusUnit={focusUnit} hover={hover} onHover={onHover} />
        <ul className="progress-legend">
          <li>
            <button type="button" className={!focusUnit ? 'is-on' : ''} onClick={() => onFocus('')}>
              <i style={{ background: palette.line }} />
              Average
            </button>
          </li>
          {pulse.series.map((line) => (
            <li key={line.name}>
              <button
                type="button"
                className={focusUnit === line.name ? 'is-on' : ''}
                onClick={() => onFocus(focusUnit === line.name ? '' : line.name)}
              >
                <i style={{ background: line.color }} />
                {line.name}
              </button>
            </li>
          ))}
        </ul>
        {sampleUnits ? <p className="progress-note">Sample units until you add real ones in Tools.</p> : null}
        {!pulse.live ? <p className="progress-note">Quiz this course to replace the sample curve with your own.</p> : null}
      </figure>

      {howOpen ? (
        <aside className="progress-rules" aria-label="Judgment rules">
          <p>Mastery shrinks toward 38% until you have enough answers, then follows accuracy, plus a small notes bonus.</p>
          <p>Improvement compares your last 6 answers to the 6 before that. A 12-point swing is Rising or Slipping. 82%+ and stable is Sharp.</p>
        </aside>
      ) : null}

      <section className="progress-roadmap" aria-label={`${course.name} roadmap`}>
        <div className="progress-roadmap__head">
          <h3>Unit roadmap</h3>
          <p>Follow the course tone down the trail. The next unit to press is marked.</p>
        </div>
        <ol className="progress-trail">
          {pulse.units.map((unit, index) => (
            <RoadNode
              key={unit.name}
              unit={unit}
              color={pulse.series[index]?.color ?? palette.line}
              next={unit.name === pulse.recommended}
              selected={unit.name === focusUnit}
              onSelect={() => onFocus(focusUnit === unit.name ? '' : unit.name)}
            />
          ))}
        </ol>
      </section>
    </article>
  )
}

function PulseGraph({
  pulse,
  focusUnit,
  hover,
  onHover,
}: {
  pulse: CoursePulse
  focusUnit: string
  hover: number | null
  onHover: (index: number | null) => void
}) {
  const { w, h, x, y } = GRAPH
  const ticks = [0, 25, 50, 75, 100]
  const focused = pulse.series.find((line) => line.name === focusUnit)
  const shown = focused ? [focused] : pulse.series
  const main = focused?.values ?? pulse.overall
  const mainColor = focused?.color ?? pulse.palette.line
  const hoverIndex = hover ?? main.length - 1
  const points = main.map((value, index) => {
    const innerW = w - x * 2
    const innerH = h - y * 2
    return {
      x: x + (main.length === 1 ? innerW / 2 : (index / (main.length - 1)) * innerW),
      y: y + (1 - value / 100) * innerH,
    }
  })
  const mark = points[hoverIndex]

  function nearest(clientX: number, target: SVGSVGElement) {
    const box = target.getBoundingClientRect()
    const local = ((clientX - box.left) / box.width) * w
    let best = 0
    let dist = Infinity
    points.forEach((point, index) => {
      const gap = Math.abs(point.x - local)
      if (gap < dist) {
        dist = gap
        best = index
      }
    })
    onHover(best)
  }

  return (
    <svg
      className="progress-svg"
      viewBox={`0 0 ${w} ${h}`}
      role="img"
      aria-label={`${pulse.course.name} mastery from session 1 to ${pulse.labels.length}`}
      onMouseMove={(event) => nearest(event.clientX, event.currentTarget)}
      onMouseLeave={() => onHover(null)}
    >
      <defs>
        <linearGradient id={`pulse-fill-${cssId(pulse.course.name)}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={mainColor} stopOpacity="0.5" />
          <stop offset="100%" stopColor={mainColor} stopOpacity="0.03" />
        </linearGradient>
      </defs>
      {ticks.map((tick) => {
        const gy = y + (1 - tick / 100) * (h - y * 2)
        return (
          <g key={tick}>
            <line className="progress-svg__grid" x1={x} x2={w - x} y1={gy} y2={gy} />
            <text className="progress-svg__tick" x={x - 8} y={gy + 4}>
              {tick}
            </text>
          </g>
        )
      })}
      <path
        d={areaPath(main, w, h, x, y)}
        fill={`url(#pulse-fill-${cssId(pulse.course.name)})`}
      />
      {shown.map((line) => (
        <path
          key={line.name}
          d={smoothPath(line.values, w, h, x, y)}
          fill="none"
          stroke={line.color}
          strokeWidth={focused || pulse.series.length === 1 ? 4 : 2.8}
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity={focused || !focusUnit ? 1 : 0.4}
        />
      ))}
      {!focused && pulse.series.length > 1 ? (
        <path
          d={smoothPath(pulse.overall, w, h, x, y)}
          fill="none"
          stroke={pulse.palette.line}
          strokeWidth="3.2"
          strokeLinecap="round"
          strokeDasharray="5 6"
          opacity="0.85"
        />
      ) : null}
      {pulse.labels.map((label, index) => (
        <text key={label} className="progress-svg__label" x={points[index]?.x ?? 0} y={h - 4}>
          {label}
        </text>
      ))}
      {mark ? (
        <>
          <line className="progress-svg__hover" x1={mark.x} x2={mark.x} y1={y} y2={h - y} />
          <circle cx={mark.x} cy={mark.y} r="6.5" fill={mainColor} stroke="#07111c" strokeWidth="3" />
        </>
      ) : null}
    </svg>
  )
}

function RoadNode({
  unit,
  color,
  next,
  selected,
  onSelect,
}: {
  unit: UnitJudgment
  color: string
  next: boolean
  selected: boolean
  onSelect: () => void
}) {
  return (
    <li>
      <button
        type="button"
        className={`progress-node ${next ? 'is-next' : ''} ${selected ? 'is-on' : ''}`}
        onClick={onSelect}
        style={{ ['--node' as string]: color }}
      >
        <span className="progress-node__ring" style={{ background: ring(unit.mastery, color) }}>
          <b>{unit.mastery}</b>
        </span>
        <strong>{unit.name}</strong>
        <span className={`verdict verdict--${unit.verdict}`}>{VERDICT_COPY[unit.verdict].label}</span>
        <small>
          {unit.live
            ? `${unit.correct}/${unit.attempts || 0} · ${unit.delta >= 0 ? '+' : ''}${unit.delta} pts`
            : 'Sample trend'}
        </small>
      </button>
    </li>
  )
}

function ring(mastery: number, color: string) {
  return `conic-gradient(${color} ${mastery * 3.6}deg, rgba(232, 223, 176, 0.14) 0deg)`
}

function cssId(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-')
}
