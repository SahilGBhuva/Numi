import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { assignmentsFor, loadPlanner, savePlanner } from '../lib/session'
import type { AssignmentPriority, CourseAssignment } from '../lib/types'
import './CourseCalendar.css'

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']
const PRIORITIES: { id: AssignmentPriority; label: string }[] = [
  { id: 'high', label: 'High' },
  { id: 'medium', label: 'Medium' },
  { id: 'low', label: 'Low' },
]

function ymd(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function monthLabel(year: number, month: number) {
  return new Date(year, month, 1).toLocaleString(undefined, { month: 'short', year: 'numeric' })
}

function shortDue(date: string, today: string) {
  if (date === today) return 'Today'
  const [year, month, day] = date.split('-').map(Number)
  return new Date(year, month - 1, day).toLocaleString(undefined, { month: 'short', day: 'numeric' })
}

function monthCells(year: number, month: number) {
  const pad = new Date(year, month, 1).getDay()
  const days = new Date(year, month + 1, 0).getDate()
  return [...Array(pad).fill(null), ...Array.from({ length: days }, (_, index) => index + 1)] as (number | null)[]
}

const RANK: Record<AssignmentPriority, number> = { high: 0, medium: 1, low: 2 }

export function CourseCalendar({ course, tone }: { course: string; tone: string }) {
  const today = ymd(new Date())
  const [open, setOpen] = useState(false)
  const [cursor, setCursor] = useState(() => {
    const now = new Date()
    return { year: now.getFullYear(), month: now.getMonth() }
  })
  const [selected, setSelected] = useState(today)
  const [items, setItems] = useState<CourseAssignment[]>(() => loadPlanner())
  const [title, setTitle] = useState('')
  const [priority, setPriority] = useState<AssignmentPriority>('medium')
  const hoverTimer = useRef(0)
  const leaveTimer = useRef(0)

  useEffect(() => {
    setItems(loadPlanner())
  }, [course])

  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open])

  const courseItems = assignmentsFor(items, course)
  const selectedItems = courseItems
    .filter((item) => item.due === selected)
    .sort((a, b) => RANK[a.priority] - RANK[b.priority] || a.title.localeCompare(b.title))
  const upcoming = courseItems
    .filter((item) => !item.done && item.due >= today)
    .sort((a, b) => a.due.localeCompare(b.due) || RANK[a.priority] - RANK[b.priority])
  const dueNext = upcoming.slice(0, 3)

  function persist(next: CourseAssignment[]) {
    setItems(next)
    savePlanner(next)
  }

  function addAssignment(event: FormEvent) {
    event.preventDefault()
    const name = title.trim()
    if (!name || !course) return
    persist([
      {
        id: crypto.randomUUID(),
        course,
        title: name,
        due: selected,
        priority,
        done: false,
      },
      ...items,
    ])
    setTitle('')
  }

  function toggleDone(id: string) {
    persist(items.map((item) => (item.id === id ? { ...item, done: !item.done } : item)))
  }

  function removeItem(id: string) {
    persist(items.filter((item) => item.id !== id))
  }

  function startHover() {
    window.clearTimeout(leaveTimer.current)
    if (open) return
    window.clearTimeout(hoverTimer.current)
    hoverTimer.current = window.setTimeout(() => setOpen(true), 700)
  }

  function endHover() {
    window.clearTimeout(hoverTimer.current)
    if (!open) return
    window.clearTimeout(leaveTimer.current)
    leaveTimer.current = window.setTimeout(() => setOpen(false), 220)
  }

  const cells = monthCells(cursor.year, cursor.month)

  return (
    <div
      className={`planner ${open ? 'is-open' : ''}`}
      style={{ ['--planner-tone' as string]: tone }}
      onMouseEnter={startHover}
      onMouseLeave={endHover}
    >
      <div
        className="planner__due"
        role="region"
        aria-label={`${course || 'Course'} assignments due next`}
        onClick={() => setOpen(true)}
      >
        <p className="planner__mini-label">Due next</p>
        {dueNext.length === 0 ? (
          <p className="planner__due-empty">{course ? 'Nothing coming up' : 'Pick a course'}</p>
        ) : (
          <ul className="planner__due-list">
            {dueNext.map((item) => (
              <li key={item.id} className={`is-${item.priority}`}>
                <span className="planner__when">{shortDue(item.due, today)}</span>
                <span className="planner__due-title">{item.title}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <button
        className="planner__mini"
        type="button"
        aria-expanded={open}
        aria-label={`${course || 'Course'} calendar`}
        onClick={() => setOpen(true)}
      >
        <p className="planner__mini-label">{monthLabel(cursor.year, cursor.month)}</p>
        <div className="planner__grid planner__grid--mini" aria-hidden="true">
          {WEEKDAYS.map((day, index) => (
            <span key={`${day}-${index}`}>{day}</span>
          ))}
          {cells.map((day, index) => {
            const date = day ? ymd(new Date(cursor.year, cursor.month, day)) : ''
            const marked = Boolean(date && courseItems.some((item) => item.due === date))
            return (
              <span key={date || `pad-${index}`} className={marked ? 'is-marked' : ''}>
                {day ?? ''}
              </span>
            )
          })}
        </div>
      </button>

      {open ? (
        <div className="planner__pop" role="dialog" aria-label={`${course || 'Course'} assignments`}>
          <div className="planner__pop-head">
            <div>
              <p>Assignments</p>
              <strong>{course || 'Pick a course'}</strong>
            </div>
            <button type="button" onClick={() => setOpen(false)}>
              Close
            </button>
          </div>

          <div className="planner__pop-body">
            <div className="planner__month">
              <div className="planner__month-nav">
                <button
                  type="button"
                  aria-label="Previous month"
                  onClick={() =>
                    setCursor((current) =>
                      current.month === 0
                        ? { year: current.year - 1, month: 11 }
                        : { year: current.year, month: current.month - 1 },
                    )
                  }
                >
                  ‹
                </button>
                <span>{monthLabel(cursor.year, cursor.month)}</span>
                <button
                  type="button"
                  aria-label="Next month"
                  onClick={() =>
                    setCursor((current) =>
                      current.month === 11
                        ? { year: current.year + 1, month: 0 }
                        : { year: current.year, month: current.month + 1 },
                    )
                  }
                >
                  ›
                </button>
              </div>
              <div className="planner__grid planner__grid--full">
                {WEEKDAYS.map((day, index) => (
                  <span key={`full-${day}-${index}`} className="is-dow">
                    {day}
                  </span>
                ))}
                {cells.map((day, index) => {
                  if (!day) return <span key={`empty-${index}`} />
                  const date = ymd(new Date(cursor.year, cursor.month, day))
                  const marked = courseItems.some((item) => item.due === date)
                  return (
                    <button
                      key={date}
                      type="button"
                      className={`${date === selected ? 'is-on' : ''} ${date === today ? 'is-today' : ''} ${
                        marked ? 'is-marked' : ''
                      }`}
                      onClick={() => setSelected(date)}
                    >
                      {day}
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="planner__desk">
              <form className="planner__form" onSubmit={addAssignment}>
                <label>
                  Assignment
                  <input
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                    placeholder="Homework, essay, lab…"
                    disabled={!course}
                  />
                </label>
                <div className="planner__form-row">
                  <label>
                    Due
                    <input type="date" value={selected} onChange={(event) => setSelected(event.target.value)} />
                  </label>
                  <label>
                    Priority
                    <select
                      value={priority}
                      onChange={(event) => setPriority(event.target.value as AssignmentPriority)}
                    >
                      {PRIORITIES.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <button type="submit" disabled={!course || !title.trim()}>
                  Add to {selected}
                </button>
              </form>

              <section>
                <h3>Due {selected}</h3>
                {selectedItems.length === 0 ? (
                  <p className="planner__empty">Nothing due this day.</p>
                ) : (
                  <ul className="planner__list">
                    {selectedItems.map((item) => (
                      <li key={item.id} className={`is-${item.priority} ${item.done ? 'is-done' : ''}`}>
                        <button type="button" onClick={() => toggleDone(item.id)}>
                          {item.done ? 'Done' : item.priority}
                        </button>
                        <span>{item.title}</span>
                        <button type="button" aria-label={`Remove ${item.title}`} onClick={() => removeItem(item.id)}>
                          ×
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section>
                <h3>Up next</h3>
                {upcoming.length === 0 ? (
                  <p className="planner__empty">No upcoming work in this course.</p>
                ) : (
                  <ul className="planner__list">
                    {upcoming.slice(0, 4).map((item) => (
                      <li key={item.id} className={`is-${item.priority}`}>
                        <span className="planner__when">{item.due.slice(5)}</span>
                        <span>{item.title}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
