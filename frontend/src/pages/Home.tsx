import { FormEvent, useEffect, useRef, useState } from 'react'
import { getProgress } from '../lib/api'
import { getStudentId, loadNotebook, notesFor, saveNotebook, unitsFor } from '../lib/session'
import type { Course, NoteDeposit } from '../lib/types'
import './Home.css'

const STREAK_STEPS = 6

function CameraMark() {
  return (
    <svg className="camera-mark" viewBox="0 0 120 84" aria-hidden="true">
      <rect className="camera-mark__body" x="8" y="22" width="104" height="56" rx="10" />
      <rect className="camera-mark__flash" x="18" y="8" width="28" height="18" rx="4" />
      <circle className="camera-mark__lens" cx="62" cy="50" r="18" />
      <circle className="camera-mark__glass" cx="62" cy="50" r="8" />
      <circle className="camera-mark__dot" cx="28" cy="38" r="5" />
    </svg>
  )
}

function GearMark() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="3" />
      <path d="M12 3.2v2.3M12 18.5v2.3M4.8 6.2l1.7 1.7M17.5 16.1l1.7 1.7M3.2 12h2.3M18.5 12h2.3M6.2 19.2l1.7-1.7M16.1 6.5l1.7-1.7" />
    </svg>
  )
}

export function Home() {
  const [studentId] = useState(() => getStudentId())
  const [streak, setStreak] = useState(0)
  const [coursesOpen, setCoursesOpen] = useState(true)
  const [notebook, setNotebook] = useState(() => loadNotebook())
  const [addingCourse, setAddingCourse] = useState(false)
  const [newCourse, setNewCourse] = useState('')
  const [newUnit, setNewUnit] = useState('')
  const [addingUnit, setAddingUnit] = useState(false)
  const [renamingUnit, setRenamingUnit] = useState('')
  const [renameDraft, setRenameDraft] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [notice, setNotice] = useState('')
  const fileInput = useRef<HTMLInputElement>(null)

  const courses = notebook.courses
  const activeCourse = notebook.activeCourse
  const activeUnit = notebook.activeUnit
  const units = unitsFor(courses, activeCourse)
  const unitNotes = notesFor(notebook.deposits, activeCourse, activeUnit)

  useEffect(() => {
    saveNotebook(notebook)
  }, [notebook])

  useEffect(() => {
    void getProgress(studentId)
      .then((progress) => setStreak(progress?.streak ?? 0))
      .catch(() => undefined)
  }, [studentId])

  function showSoon(label: string) {
    setNotice(`${label} is not connected yet.`)
  }

  function addCourse(event: FormEvent) {
    event.preventDefault()
    const name = newCourse.trim()
    if (!name) return
    setNotebook((current) => {
      if (current.courses.some((course) => course.name === name)) {
        return { ...current, activeCourse: name, activeUnit: unitsFor(current.courses, name)[0] ?? '' }
      }
      const courses: Course[] = [...current.courses, { name, units: [] }]
      return { ...current, courses, activeCourse: name, activeUnit: '' }
    })
    setNewCourse('')
    setAddingCourse(false)
  }

  function chooseCourse(name: string) {
    setAddingUnit(false)
    setNewUnit('')
    setRenamingUnit('')
    setRenameDraft('')
    setNotebook((current) => ({
      ...current,
      activeCourse: name,
      activeUnit: unitsFor(current.courses, name)[0] ?? '',
    }))
  }

  function chooseUnit(name: string) {
    setNotebook((current) => ({ ...current, activeUnit: name }))
  }

  function addUnit(event?: FormEvent | React.KeyboardEvent) {
    event?.preventDefault()
    const name = newUnit.trim()
    if (!name) return
    setNotebook((current) => {
      const already = unitsFor(current.courses, current.activeCourse)
      if (already.includes(name)) {
        return { ...current, activeUnit: name }
      }
      const courses = current.courses.map((course) =>
        course.name === current.activeCourse ? { ...course, units: [...course.units, name] } : course,
      )
      return { ...current, courses, activeUnit: name }
    })
    setNewUnit('')
    setAddingUnit(false)
  }

  function startRename(name: string) {
    setAddingUnit(false)
    setRenamingUnit(name)
    setRenameDraft(name)
    chooseUnit(name)
  }

  function cancelRename() {
    setRenamingUnit('')
    setRenameDraft('')
  }

  function commitRename(event?: FormEvent | React.KeyboardEvent) {
    event?.preventDefault()
    const from = renamingUnit
    const to = renameDraft.trim()
    if (!from) return
    if (!to || to === from) {
      cancelRename()
      return
    }
    const taken = unitsFor(courses, activeCourse).some((item) => item !== from && item === to)
    if (taken) {
      setNotice(`“${to}” already exists in ${activeCourse}.`)
      return
    }
    setNotebook((current) => {
      const courses = current.courses.map((course) =>
        course.name === current.activeCourse
          ? { ...course, units: course.units.map((item) => (item === from ? to : item)) }
          : course,
      )
      const deposits = current.deposits.map((item) =>
        item.course === current.activeCourse && item.unit === from ? { ...item, unit: to } : item,
      )
      return {
        ...current,
        courses,
        deposits,
        activeUnit: current.activeUnit === from ? to : current.activeUnit,
      }
    })
    cancelRename()
  }

  function onPickFile(event: React.ChangeEvent<HTMLInputElement>) {
    const next = event.target.files?.[0]
    setFile(next ?? null)
    setNotice(next ? `Ready: ${next.name}` : '')
  }

  function sendUpload(event: FormEvent) {
    event.preventDefault()
    if (!file) return
    if (!activeUnit) {
      setNotice(`Create a unit in ${activeCourse} first, then send your notes there.`)
      return
    }
    const deposit: NoteDeposit = {
      id: crypto.randomUUID(),
      course: activeCourse,
      unit: activeUnit,
      fileName: file.name,
      createdAt: new Date().toISOString(),
    }
    setNotebook((current) => ({ ...current, deposits: [deposit, ...current.deposits] }))
    setFile(null)
    if (fileInput.current) fileInput.current.value = ''
    setNotice(`Saved “${deposit.fileName}” to ${activeCourse} → ${activeUnit}.`)
  }

  const filledSteps = Math.min(streak, STREAK_STEPS)

  return (
    <main className="sheet">
      <span className="blob blob-a" aria-hidden="true" />
      <span className="blob blob-b" aria-hidden="true" />
      <header className="sheet__top">
        <div className="profile-pill">
          <button className="avatar" type="button" onClick={() => showSoon('Avatar')} aria-label="Avatar">
            B
          </button>
          <button className="gear" type="button" onClick={() => showSoon('Settings')} aria-label="Settings">
            <GearMark />
          </button>
        </div>

        <div className="streak" aria-label={`Streak ${streak} days`}>
          <div className="streak__track">
            {Array.from({ length: STREAK_STEPS }, (_, index) => (
              <span key={index} className={`streak__dot ${index < filledSteps ? 'is-on' : ''}`} />
            ))}
            <span className={`streak__flag ${streak >= STREAK_STEPS ? 'is-on' : ''}`} aria-hidden="true" />
          </div>
          <div className="streak__caption">
            <span className="streak__person" aria-hidden="true" />
            <span>STREAK</span>
          </div>
        </div>

        <a className="logo" href="#home" id="home" aria-label="Numi logo">
          N
        </a>
      </header>

      <div className={`sheet__row ${coursesOpen ? '' : 'is-collapsed'}`}>
        <aside className={`courses ${coursesOpen ? '' : 'is-collapsed'}`}>
          <h1>Courses</h1>
          <button
            className="collapse"
            type="button"
            onClick={() => setCoursesOpen((open) => !open)}
            aria-expanded={coursesOpen}
            aria-label={coursesOpen ? 'Collapse courses' : 'Expand courses'}
          >
            {coursesOpen ? '‹' : '›'}
          </button>
          {coursesOpen ? (
            <>
              <ul>
                {courses.map((course) => (
                  <li key={course.name}>
                    <button
                      className={course.name === activeCourse ? 'is-active' : ''}
                      type="button"
                      onClick={() => chooseCourse(course.name)}
                    >
                      + {course.name}
                    </button>
                  </li>
                ))}
              </ul>
              {addingCourse ? (
                <form className="add-course" onSubmit={addCourse}>
                  <input
                    value={newCourse}
                    onChange={(event) => setNewCourse(event.target.value)}
                    placeholder="Course name"
                    autoFocus
                  />
                  <button type="submit">Add</button>
                </form>
              ) : (
                <button className="plus" type="button" onClick={() => setAddingCourse(true)} aria-label="Add course">
                  +
                </button>
              )}
            </>
          ) : null}
        </aside>

        <section className="stage">
          <button className="toolbox" type="button" onClick={() => showSoon('Toolbox')}>
            Toolbox <b>›</b>
          </button>

          <div className="workbook">
            <div className="unit-tabs" role="tablist" aria-label={`Units in ${activeCourse}`}>
              {units.map((item) =>
                item === renamingUnit ? (
                  <form
                    key={item}
                    className="unit-tab unit-tab--new is-active"
                    onSubmit={commitRename}
                  >
                    <input
                      value={renameDraft}
                      onChange={(event) => setRenameDraft(event.target.value)}
                      aria-label={`Rename ${item}`}
                      autoFocus
                      onFocus={(event) => event.currentTarget.select()}
                      onBlur={() => commitRename()}
                      onKeyDown={(event) => {
                        if (event.key === 'Escape') {
                          event.preventDefault()
                          cancelRename()
                        }
                        if (event.key === 'Enter') commitRename(event)
                      }}
                    />
                  </form>
                ) : (
                  <button
                    key={item}
                    className={`unit-tab ${item === activeUnit ? 'is-active' : ''}`}
                    type="button"
                    role="tab"
                    title="Double-click to rename"
                    aria-selected={item === activeUnit}
                    onClick={() => chooseUnit(item)}
                    onDoubleClick={(event) => {
                      event.preventDefault()
                      startRename(item)
                    }}
                  >
                    {item}
                  </button>
                ),
              )}
              {addingUnit ? (
                <form className="unit-tab unit-tab--new" onSubmit={addUnit}>
                  <input
                    value={newUnit}
                    onChange={(event) => setNewUnit(event.target.value)}
                    placeholder={`New ${activeCourse} unit`}
                    aria-label={`New ${activeCourse} unit`}
                    autoFocus
                    onBlur={() => {
                      if (!newUnit.trim()) setAddingUnit(false)
                    }}
                    onKeyDown={(event) => {
                      if (event.key === 'Escape') {
                        setNewUnit('')
                        setAddingUnit(false)
                      }
                      if (event.key === 'Enter') addUnit(event)
                    }}
                  />
                </form>
              ) : (
                <button
                  className="unit-tab unit-tab--add"
                  type="button"
                  aria-label={`Add ${activeCourse} unit`}
                  onClick={() => setAddingUnit(true)}
                >
                  +
                </button>
              )}
            </div>

            <div className="panel">
              <form className="scan" onSubmit={sendUpload}>
                <span className="scan__label">Camera / upload</span>
                <span className="tab" aria-hidden="true" />
                <input
                  ref={fileInput}
                  className="file-input"
                  type="file"
                  accept="image/*,.pdf,.txt,.md"
                  onChange={onPickFile}
                />
                <button className="frame" type="button" onClick={() => fileInput.current?.click()}>
                  <CameraMark />
                  <strong>Scan / upload file</strong>
                  {file ? <small>{file.name}</small> : null}
                </button>
                <button className="send" type="submit" disabled={!file}>
                  Send
                </button>
              </form>

              <section className="requests">
                <h2>{activeUnit ? `${activeUnit} notes` : 'Requests'}</h2>
                {activeUnit && unitNotes.length === 0 ? (
                  <p>Nothing deposited here yet.</p>
                ) : null}
                {!activeUnit ? <p>Pick or create a unit tab to collect notes.</p> : null}
                {unitNotes.length > 0 ? (
                  <ul>
                    {unitNotes.map((note) => (
                      <li key={note.id}>{note.fileName}</li>
                    ))}
                  </ul>
                ) : null}
              </section>
            </div>
          </div>
        </section>
      </div>

      {notice ? (
        <p className="notice" role="status">
          {notice}
        </p>
      ) : null}
    </main>
  )
}
