import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { CSSProperties, FormEvent } from 'react'
import { analyzeAnswer, generateQuestion, uploadNote, type AnswerResult, type GeneratedQuestion, type Topic } from '../lib/api'
import { recordUnitAttempt } from '../lib/progress'
import {
  fileToCourseImageDataUrl,
  getStudentId,
  loadNotebook,
  notesFor,
  pickCourseTone,
  saveNotebook,
  unitsFor,
  withCourseTones,
} from '../lib/session'
import type { Course, NoteDeposit } from '../lib/types'
import './Home.css'

const QUIZ_TOPICS: { id: Topic; label: string }[] = [
  { id: 'mixed', label: 'Mixed' },
  { id: 'addition', label: 'Addition' },
  { id: 'subtraction', label: 'Subtraction' },
  { id: 'multiplication', label: 'Multiplication' },
  { id: 'division', label: 'Division' },
]

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

function TrashMark() {
  return (
    <svg className="trash-mark" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 7h14" />
      <path d="M9 7V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V7" />
      <path d="M7.5 7l.8 12.2A1.5 1.5 0 0 0 9.8 20.5h4.4a1.5 1.5 0 0 0 1.5-1.3L16.5 7" />
      <path d="M10 10.5v6M14 10.5v6" />
    </svg>
  )
}

function courseTone(course: { name: string; tone?: string }) {
  return course.tone ?? withCourseTones([{ name: course.name, units: [] }])[0].tone ?? '#2a6ea8'
}

function courseLookStyle(course: { name: string; tone?: string; image?: string }): CSSProperties {
  const tone = courseTone(course)
  if (!course.image) return { backgroundColor: tone }
  return {
    backgroundColor: tone,
    backgroundImage: `linear-gradient(180deg, rgba(8, 16, 26, 0.08), rgba(8, 16, 26, 0.62)), url("${course.image}")`,
    backgroundSize: 'cover',
    backgroundPosition: 'center',
  }
}

function GripMark() {
  return (
    <svg className="grip-mark" viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="9" cy="7" r="1.4" />
      <circle cx="15" cy="7" r="1.4" />
      <circle cx="9" cy="12" r="1.4" />
      <circle cx="15" cy="12" r="1.4" />
      <circle cx="9" cy="17" r="1.4" />
      <circle cx="15" cy="17" r="1.4" />
    </svg>
  )
}

function SketchPick<T extends string | number>({
  label,
  value,
  options,
  disabled,
  open,
  onToggle,
  onChange,
}: {
  label: string
  value: T
  options: { id: T; label: string }[]
  disabled?: boolean
  open: boolean
  onToggle: () => void
  onChange: (value: T) => void
}) {
  const root = useRef<HTMLDivElement>(null)
  const current = options.find((option) => option.id === value)?.label ?? String(value)

  useEffect(() => {
    if (!open) return
    const close = (event: MouseEvent) => {
      if (!root.current?.contains(event.target as Node)) onToggle()
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onToggle()
    }
    document.addEventListener('mousedown', close)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', close)
      document.removeEventListener('keydown', onKey)
    }
  }, [open, onToggle])

  return (
    <div className={`sketch-pick ${open ? 'is-open' : ''}`} ref={root}>
      <span className="sketch-pick__label">{label}</span>
      <button
        className="sketch-pick__button"
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={onToggle}
      >
        <span>{current}</span>
        <b aria-hidden="true">{open ? '▴' : '▾'}</b>
      </button>
      {open ? (
        <ul className="sketch-pick__menu" role="listbox" aria-label={label}>
          {options.map((option) => (
            <li key={String(option.id)}>
              <button
                className={option.id === value ? 'is-on' : ''}
                type="button"
                role="option"
                aria-selected={option.id === value}
                onClick={() => {
                  onChange(option.id)
                  onToggle()
                }}
              >
                {option.label}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}

export function Tools({ accessToken }: { accessToken?: string }) {
  const [notebook, setNotebook] = useState(() => {
    const loaded = loadNotebook()
    return { ...loaded, courses: withCourseTones(loaded.courses) }
  })
  const [addingCourse, setAddingCourse] = useState(false)
  const [addHintOn, setAddHintOn] = useState('')
  const [newCourse, setNewCourse] = useState('')
  const [newUnit, setNewUnit] = useState('')
  const [addingUnit, setAddingUnit] = useState(false)
  const [renamingUnit, setRenamingUnit] = useState('')
  const [renameDraft, setRenameDraft] = useState('')
  const [renamingCourse, setRenamingCourse] = useState('')
  const [courseRenameDraft, setCourseRenameDraft] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [notice, setNotice] = useState('')
  const [uploadBusy, setUploadBusy] = useState(false)
  const [cardIndex, setCardIndex] = useState(0)
  const [cardFlipped, setCardFlipped] = useState(false)
  const [swipe, setSwipe] = useState<'idle' | 'next' | 'prev'>('idle')
  const swipeLock = useRef(false)
  const fileInput = useRef<HTMLInputElement>(null)
  const pagesRef = useRef<HTMLDivElement>(null)
  const coursePagesRef = useRef<HTMLDivElement>(null)
  const skipCourseScroll = useRef(false)
  const draggingCourse = useRef('')
  const dragEndedAt = useRef(0)
  const [draggingName, setDraggingName] = useState('')
  const [trashHot, setTrashHot] = useState(false)
  const [quizTopic, setQuizTopic] = useState<Topic>('mixed')
  const [quizDifficulty, setQuizDifficulty] = useState(1)
  const [quizQuestion, setQuizQuestion] = useState<GeneratedQuestion | null>(null)
  const [quizAnswer, setQuizAnswer] = useState('')
  const [quizResult, setQuizResult] = useState<AnswerResult | null>(null)
  const [quizBusy, setQuizBusy] = useState(false)
  const [quizError, setQuizError] = useState('')
  const [panelFn, setPanelFn] = useState<'scan' | 'cards' | 'quiz'>('scan')
  const [quizMenu, setQuizMenu] = useState<'topic' | 'level' | null>(null)
  const [orderOpen, setOrderOpen] = useState(false)
  const [orderDrag, setOrderDrag] = useState('')
  const [lookCourse, setLookCourse] = useState('')
  const [lookBusy, setLookBusy] = useState(false)
  const [lookHint, setLookHint] = useState('')
  const courseImageInput = useRef<HTMLInputElement>(null)
  const orderDragIndex = useRef(-1)
  const studentId = useRef(getStudentId())

  const courses = notebook.courses
  const courseOrderKey = courses.map((course) => course.name).join('|')
  const activeCourse = notebook.activeCourse
  const activeCourseRef = useRef(activeCourse)
  activeCourseRef.current = activeCourse
  const activeUnit = notebook.activeUnit
  const units = unitsFor(courses, activeCourse)
  const activeTone = courseTone(courses.find((course) => course.name === activeCourse) ?? { name: activeCourse })
  const looking = courses.find((course) => course.name === lookCourse) ?? courses.find((course) => course.name === activeCourse)
  const unitNotes = notesFor(notebook.deposits, activeCourse, activeUnit)
  const deck =
    unitNotes.length > 0
      ? unitNotes.map((note) => ({
          front: note.fileName,
          back: `Notes saved in ${activeCourse} → ${activeUnit}. Real quiz cards will be generated from this file later.`,
        }))
      : [
          {
            front: activeUnit ? `What belongs in ${activeUnit}?` : 'Pick a unit first',
            back: activeUnit
              ? 'Upload notes on the scan screen, then come back here.'
              : 'Choose or create a unit tab, then scroll back to flashcards.',
          },
          {
            front: 'How do I study?',
            back: 'Scan notes above, then flip through cards for this unit.',
          },
          {
            front: 'Ready to quiz?',
            back: 'Hit Next to swipe this card away and bring the next one forward.',
          },
        ]

  useEffect(() => {
    setCardIndex(0)
    setCardFlipped(false)
    setSwipe('idle')
    swipeLock.current = false
  }, [activeCourse, activeUnit, unitNotes.length])

  useEffect(() => {
    if (swipe === 'idle') return
    const timer = window.setTimeout(() => finishSwipe(swipe), 480)
    return () => window.clearTimeout(timer)
  }, [swipe])

  useEffect(() => {
    saveNotebook(notebook)
  }, [notebook])

  useEffect(() => {
    setNotebook((current) => {
      if (current.courses.every((course) => course.tone)) return current
      return { ...current, courses: withCourseTones(current.courses) }
    })
  }, [])

  useLayoutEffect(() => {
    const pages = pagesRef.current
    const panel = pages?.parentElement
    if (!pages || !panel) return

    const syncHeight = () => {
      const next = `${Math.round(panel.clientHeight)}px`
      if (pages.style.getPropertyValue('--panel-view-height') !== next) {
        pages.style.setProperty('--panel-view-height', next)
      }
    }

    syncHeight()
    const observer = new ResizeObserver(syncHeight)
    observer.observe(panel)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const pages = pagesRef.current
    if (!pages) return

    const syncFn = () => {
      const index = Math.round(pages.scrollTop / Math.max(pages.clientHeight, 1))
      const next = (['scan', 'cards', 'quiz'] as const)[index] ?? 'scan'
      setPanelFn((current) => (current === next ? current : next))
    }
    let frame = 0
    const onScroll = () => {
      if (frame) return
      frame = window.requestAnimationFrame(() => {
        frame = 0
        syncFn()
      })
    }

    syncFn()
    pages.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      pages.removeEventListener('scroll', onScroll)
      if (frame) window.cancelAnimationFrame(frame)
    }
  }, [])

  useEffect(() => {
    const root = coursePagesRef.current
    if (!root) return

    const syncCourse = () => {
      const index = Math.round(root.scrollTop / Math.max(root.clientHeight, 1))
      const course = courses[index]
      if (!course || course.name === activeCourseRef.current) return
      skipCourseScroll.current = true
      chooseCourse(course.name)
    }
    let frame = 0
    const onScroll = () => {
      if (frame) return
      frame = window.requestAnimationFrame(() => {
        frame = 0
        syncCourse()
      })
    }

    root.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      root.removeEventListener('scroll', onScroll)
      if (frame) window.cancelAnimationFrame(frame)
    }
  }, [activeCourse, courseOrderKey, courses])

  useLayoutEffect(() => {
    const root = coursePagesRef.current
    if (!root) return
    if (skipCourseScroll.current) {
      skipCourseScroll.current = false
      return
    }
    jumpToCourse(activeCourse)
  }, [activeCourse, courseOrderKey, courses])

  useEffect(() => {
    if (!orderOpen) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOrderOpen(false)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [orderOpen])

  useEffect(() => {
    if (!addingCourse) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeAddCourse()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [addingCourse])

  useEffect(() => {
    if (panelFn !== 'quiz') return
    void loadQuizQuestion()
  }, [activeCourse, activeUnit, unitNotes.length, panelFn])

  function addCourse(event: FormEvent) {
    event.preventDefault()
    const name = newCourse.trim()
    if (!name) return
    setNotebook((current) => {
      if (current.courses.some((course) => course.name === name)) {
        return { ...current, activeCourse: name, activeUnit: unitsFor(current.courses, name)[0] ?? '' }
      }
      const courses: Course[] = [...current.courses, { name, units: [], tone: pickCourseTone(current.courses) }]
      return { ...current, courses, activeCourse: name, activeUnit: '' }
    })
    setNewCourse('')
    setAddingCourse(false)
    setAddHintOn('')
  }

  function closeAddCourse() {
    setAddingCourse(false)
    setNewCourse('')
    setAddHintOn('')
  }

  function jumpToCourse(name: string) {
    const root = coursePagesRef.current
    if (!root || !name) return
    const page = Array.from(root.querySelectorAll<HTMLElement>('.course-page')).find(
      (item) => item.getAttribute('aria-label') === name,
    )
    if (!page) return
    root.scrollTop += page.getBoundingClientRect().top - root.getBoundingClientRect().top
  }

  function chooseCourse(name: string) {
    if (Date.now() - dragEndedAt.current < 250) return
    setAddingUnit(false)
    setNewUnit('')
    setRenamingUnit('')
    setRenameDraft('')
    setRenamingCourse('')
    setCourseRenameDraft('')
    setAddingCourse(false)
    setNewCourse('')
    setAddHintOn('')
    skipCourseScroll.current = false
    setNotebook((current) => ({
      ...current,
      activeCourse: name,
      activeUnit: unitsFor(current.courses, name)[0] ?? '',
    }))
    jumpToCourse(name)
  }

  function moveCourse(from: number, to: number) {
    if (from === to || from < 0 || to < 0) return
    setNotebook((current) => {
      if (to >= current.courses.length) return current
      const next = [...current.courses]
      const [item] = next.splice(from, 1)
      next.splice(to, 0, item)
      return { ...current, courses: next }
    })
  }

  function startRenameCourse(name: string) {
    chooseCourse(name)
    setRenamingCourse(name)
    setCourseRenameDraft(name)
  }

  function cancelRenameCourse() {
    setRenamingCourse('')
    setCourseRenameDraft('')
  }

  function commitRenameCourse(event?: FormEvent | React.KeyboardEvent) {
    event?.preventDefault()
    const from = renamingCourse
    const to = courseRenameDraft.trim()
    if (!from) return
    if (!to || to === from) {
      cancelRenameCourse()
      return
    }
    if (courses.some((course) => course.name !== from && course.name === to)) {
      setNotice(`“${to}” is already a course.`)
      return
    }
    setNotebook((current) => ({
      ...current,
      courses: current.courses.map((course) => (course.name === from ? { ...course, name: to } : course)),
      deposits: current.deposits.map((item) => (item.course === from ? { ...item, course: to } : item)),
      activeCourse: current.activeCourse === from ? to : current.activeCourse,
    }))
    setLookCourse((current) => (current === from ? to : current))
    cancelRenameCourse()
  }

  function setCourseImage(name: string, image: string | undefined) {
    setNotebook((current) => ({
      ...current,
      courses: current.courses.map((course) => (course.name === name ? { ...course, image } : course)),
    }))
  }

  async function applyCourseImage(file: File | null) {
    const name = looking?.name
    if (!name || !file) return
    if (!file.type.startsWith('image/')) {
      setLookHint('Pick a photo or image file.')
      return
    }
    setLookBusy(true)
    setLookHint('')
    try {
      const image = await fileToCourseImageDataUrl(file)
      setCourseImage(name, image)
      setLookHint(`Cover added to ${name}.`)
    } catch {
      setLookHint('Could not read that image. Try another photo.')
    } finally {
      setLookBusy(false)
      if (courseImageInput.current) courseImageInput.current.value = ''
    }
  }

  function removeCourse(name: string) {
    if (!name) return
    setNotebook((current) => {
      const courses = current.courses.filter((course) => course.name !== name)
      const deposits = current.deposits.filter((item) => item.course !== name)
      if (courses.length === 0) {
        return { ...current, courses, deposits, activeCourse: '', activeUnit: '' }
      }
      const activeCourse =
        current.activeCourse === name ? courses[0].name : current.activeCourse
      const activeUnit =
        activeCourse === current.activeCourse
          ? current.activeUnit
          : (unitsFor(courses, activeCourse)[0] ?? '')
      return { ...current, courses, deposits, activeCourse, activeUnit }
    })
    setNotice(`Removed “${name}”.`)
    setLookCourse((current) => (current === name ? '' : current))
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

  function finishSwipe(direction: 'next' | 'prev') {
    if (swipeLock.current) return
    swipeLock.current = true
    setCardFlipped(false)
    setCardIndex((index) =>
      direction === 'next'
        ? (index + 1) % deck.length
        : index === 0
          ? deck.length - 1
          : index - 1,
    )
    setSwipe('idle')
  }

  function goCard(direction: 'next' | 'prev') {
    if (swipe !== 'idle' || deck.length < 2) return
    swipeLock.current = false
    setCardFlipped(false)
    setSwipe(direction)
  }

  async function loadQuizQuestion() {
    setQuizBusy(true)
    setQuizError('')
    setQuizResult(null)
    setQuizAnswer('')
    try {
      const next = await generateQuestion(
        quizTopic,
        quizDifficulty,
        activeCourse && activeUnit
          ? {
              course: activeCourse,
              unit: activeUnit,
              files: unitNotes.map((note) => note.fileName),
              other_units: units.filter((name) => name !== activeUnit),
              other_courses: courses.map((course) => course.name).filter((name) => name !== activeCourse),
            }
          : undefined,
      )
      setQuizQuestion(next)
    } catch {
      setQuizError('Could not get a question. Is the backend running?')
    } finally {
      setQuizBusy(false)
    }
  }

  async function checkQuizAnswer(event: FormEvent) {
    event.preventDefault()
    if (!quizQuestion || !quizAnswer.trim()) return
    setQuizBusy(true)
    setQuizError('')
    try {
      const result = await analyzeAnswer(quizQuestion, quizAnswer, studentId.current, accessToken)
      setQuizResult(result)
      recordUnitAttempt({
        course: activeCourse,
        unit: activeUnit || quizQuestion.topic,
        correct: result.correct,
      })
    } catch {
      setQuizError('Could not check that answer. Is the backend running?')
    } finally {
      setQuizBusy(false)
    }
  }

  async function sendUpload(event: FormEvent) {
    event.preventDefault()
    if (!file) return
    if (!activeUnit) {
      setNotice(`Create a unit in ${activeCourse} first, then send your notes there.`)
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      setNotice('Notes must be 10 MB or smaller.')
      return
    }
    setUploadBusy(true)
    setNotice(`Reading “${file.name}”…`)
    try {
      const uploaded = await uploadNote(file, activeCourse, activeUnit, accessToken)
      const deposit: NoteDeposit = {
        id: uploaded.id,
        course: uploaded.course,
        unit: uploaded.unit,
        fileName: uploaded.file_name,
        createdAt: uploaded.created_at,
        status: uploaded.status,
      }
      setNotebook((current) => ({ ...current, deposits: [deposit, ...current.deposits.filter((note) => note.id !== deposit.id)] }))
      setFile(null)
      if (fileInput.current) fileInput.current.value = ''
      setNotice(`Ready: “${deposit.fileName}” is grounded for ${activeCourse} → ${activeUnit}.`)
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Could not read that note.')
    } finally {
      setUploadBusy(false)
    }
  }

  return (
    <>
      <div className="sheet__row">
        <div className="course-cluster">
        <aside className="courses">
          <h1>Courses</h1>
              <div className="course-pages" ref={coursePagesRef}>
                {courses.length === 0 ? (
                  <section className="course-page" aria-label="Add course">
                    <form className="add-course" onSubmit={addCourse}>
                      <input
                        value={newCourse}
                        onChange={(event) => setNewCourse(event.target.value)}
                        placeholder="Course name"
                        autoFocus
                      />
                      <button type="submit">Add</button>
                    </form>
                  </section>
                ) : null}
                {courses.map((course) => (
                  <section key={course.name} className="course-page" aria-label={course.name}>
                    <div
                      className="course-card-wrap"
                      onMouseMove={(event) => {
                        if (draggingName || renamingCourse || addingCourse) return
                        const rect = event.currentTarget.getBoundingClientRect()
                        const next = (event.clientY - rect.top) / rect.height > 0.7 ? course.name : ''
                        setAddHintOn((current) => (current === next ? current : next))
                      }}
                      onMouseLeave={() => {
                        if (!addingCourse) setAddHintOn('')
                      }}
                    >
                    {renamingCourse === course.name ? (
                      <form
                        className={`course-card course-card--rename ${course.image ? 'has-image' : ''}`}
                        style={courseLookStyle(course)}
                        onSubmit={commitRenameCourse}
                      >
                        <input
                          value={courseRenameDraft}
                          onChange={(event) => setCourseRenameDraft(event.target.value)}
                          aria-label={`Rename ${course.name}`}
                          autoFocus
                          onFocus={(event) => event.currentTarget.select()}
                          onBlur={() => commitRenameCourse()}
                          onKeyDown={(event) => {
                            if (event.key === 'Escape') {
                              event.preventDefault()
                              cancelRenameCourse()
                            }
                          }}
                        />
                        <small>Enter to save</small>
                      </form>
                    ) : (
                      <button
                        className={`course-card ${course.name === activeCourse ? 'is-active' : ''} ${
                          draggingName === course.name ? 'is-dragging' : ''
                        } ${course.image ? 'has-image' : ''}`}
                        type="button"
                        draggable
                        style={courseLookStyle(course)}
                        title="Double-click to rename"
                        onClick={() => chooseCourse(course.name)}
                        onDoubleClick={(event) => {
                          event.preventDefault()
                          startRenameCourse(course.name)
                        }}
                        onDragStart={(event) => {
                          draggingCourse.current = course.name
                          setDraggingName(course.name)
                          setAddHintOn('')
                          event.dataTransfer.setData('text/plain', course.name)
                          event.dataTransfer.effectAllowed = 'move'
                        }}
                        onDragEnd={() => {
                          draggingCourse.current = ''
                          dragEndedAt.current = Date.now()
                          setDraggingName('')
                          setTrashHot(false)
                        }}
                      >
                        <strong>{course.name}</strong>
                        <small>Scroll for next course</small>
                      </button>
                    )}
                    <div
                      className="course-add-hot"
                      onMouseEnter={() => {
                        if (!draggingName && !renamingCourse) setAddHintOn(course.name)
                      }}
                    />
                    {addHintOn === course.name || (addingCourse && course.name === activeCourse) ? (
                      <div className="course-add-pop">
                        {addingCourse ? (
                          <form className="add-course" onSubmit={addCourse}>
                            <input
                              value={newCourse}
                              onChange={(event) => setNewCourse(event.target.value)}
                              placeholder="New course"
                              autoFocus
                              onKeyDown={(event) => {
                                if (event.key === 'Escape') {
                                  event.preventDefault()
                                  closeAddCourse()
                                }
                              }}
                            />
                            <button type="submit">Add</button>
                          </form>
                        ) : (
                          <button
                            className="course-add-pop__open"
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation()
                              setAddingCourse(true)
                              setAddHintOn(course.name)
                            }}
                          >
                            + Add course
                          </button>
                        )}
                      </div>
                    ) : null}
                    </div>
                  </section>
                ))}
              </div>
              <button
                className={`course-trash ${trashHot ? 'is-hot' : ''}`}
                type="button"
                aria-label="Drop a course here to remove it"
                onClick={() => setNotice('Drag the course onto the trash to remove it.')}
                onDragOver={(event) => {
                  event.preventDefault()
                  event.dataTransfer.dropEffect = 'move'
                  setTrashHot(true)
                }}
                onDragLeave={() => setTrashHot(false)}
                onDrop={(event) => {
                  event.preventDefault()
                  const name = event.dataTransfer.getData('text/plain') || draggingCourse.current
                  setTrashHot(false)
                  draggingCourse.current = ''
                  setDraggingName('')
                  removeCourse(name)
                }}
              >
                <TrashMark />
              </button>
        </aside>
          <div className="order-bar">
            <button
              className={`order-bar__pop ${orderOpen ? 'is-open' : ''}`}
              type="button"
              aria-haspopup="dialog"
              aria-expanded={orderOpen}
              aria-label="Customize courses"
              onClick={() => {
                setLookCourse(activeCourse || courses[0]?.name || '')
                setLookHint('')
                setOrderOpen(true)
              }}
            >
              <span aria-hidden="true">🔧</span>
            </button>
            <ol className="order-bar__ticks" aria-label="Course order">
              {courses.map((course, index) => (
                <li key={course.name} className={course.name === activeCourse ? 'is-on' : ''}>
                  <button
                    type="button"
                    style={{
                      backgroundColor: courseTone(course),
                      animationDelay: `${index * 0.14}s`,
                    }}
                    title={course.name}
                    aria-label={`Go to ${course.name}`}
                    aria-current={course.name === activeCourse ? 'true' : undefined}
                    onClick={() => chooseCourse(course.name)}
                  />
                </li>
              ))}
            </ol>
          </div>
        {orderOpen ? (
          <div
            className="order-pop"
            role="presentation"
            onClick={() => {
              setOrderOpen(false)
              setOrderDrag('')
              orderDragIndex.current = -1
            }}
          >
            <div
              className="order-pop__card"
              role="dialog"
              aria-modal="true"
              aria-labelledby="order-pop-title"
              onClick={(event) => event.stopPropagation()}
            >
              <section className="order-pop__pane order-pop__pane--list">
                <h2 id="order-pop-title">Customize courses</h2>
                <p>Drag to reorder. Click a course to dress it up. Double-click a name to rename it.</p>
                {courses.length === 0 ? (
                  <p className="order-pop__empty">Add a course first, then you can dress it up.</p>
                ) : (
                  <ol className="order-pop__list">
                    {courses.map((course, index) => (
                      <li
                        key={course.name}
                        className={`order-pop__item ${orderDrag === course.name ? 'is-dragging' : ''} ${
                          course.name === (lookCourse || activeCourse) ? 'is-on' : ''
                        }`}
                        style={courseLookStyle(course)}
                        draggable={renamingCourse !== course.name}
                        onClick={() => {
                          setLookCourse(course.name)
                          chooseCourse(course.name)
                          setLookHint('')
                        }}
                        onDoubleClick={(event) => {
                          event.preventDefault()
                          startRenameCourse(course.name)
                        }}
                        onDragStart={(event) => {
                          if (renamingCourse === course.name) {
                            event.preventDefault()
                            return
                          }
                          orderDragIndex.current = index
                          setOrderDrag(course.name)
                          event.dataTransfer.setData('text/plain', course.name)
                          event.dataTransfer.effectAllowed = 'move'
                        }}
                        onDragOver={(event) => {
                          event.preventDefault()
                          event.dataTransfer.dropEffect = 'move'
                          const from = orderDragIndex.current
                          if (from < 0) return
                          const box = event.currentTarget.getBoundingClientRect()
                          let to = event.clientY < box.top + box.height / 2 ? index : index + 1
                          if (from < to) to -= 1
                          if (from === to) return
                          orderDragIndex.current = to
                          moveCourse(from, to)
                        }}
                        onDragEnd={() => {
                          orderDragIndex.current = -1
                          setOrderDrag('')
                        }}
                      >
                        <span className="order-pop__grip">
                          <GripMark />
                        </span>
                        <span className={`order-pop__thumb ${course.image ? 'has-image' : ''}`} aria-hidden="true">
                          {course.image ? <img src={course.image} alt="" /> : null}
                        </span>
                        {renamingCourse === course.name ? (
                          <input
                            className="order-pop__rename"
                            value={courseRenameDraft}
                            onChange={(event) => setCourseRenameDraft(event.target.value)}
                            aria-label={`Rename ${course.name}`}
                            autoFocus
                            onFocus={(event) => event.currentTarget.select()}
                            onBlur={() => commitRenameCourse()}
                            onKeyDown={(event) => {
                              if (event.key === 'Escape') {
                                event.preventDefault()
                                cancelRenameCourse()
                              }
                              if (event.key === 'Enter') commitRenameCourse(event)
                            }}
                          />
                        ) : (
                          <strong>{course.name}</strong>
                        )}
                        <span className="order-pop__shift">
                          <button
                            type="button"
                            aria-label={`Move ${course.name} up`}
                            disabled={index === 0}
                            onClick={() => moveCourse(index, index - 1)}
                          >
                            ▲
                          </button>
                          <button
                            type="button"
                            aria-label={`Move ${course.name} down`}
                            disabled={index === courses.length - 1}
                            onClick={() => moveCourse(index, index + 1)}
                          >
                            ▼
                          </button>
                        </span>
                      </li>
                    ))}
                  </ol>
                )}
                <button
                  className="order-pop__done"
                  type="button"
                  onClick={() => {
                    setOrderOpen(false)
                    setOrderDrag('')
                    orderDragIndex.current = -1
                  }}
                >
                  Done
                </button>
              </section>
              <section
                className="order-pop__pane order-pop__pane--look"
                aria-label="Course look"
                onDragOver={(event) => {
                  event.preventDefault()
                  event.dataTransfer.dropEffect = 'copy'
                }}
                onDrop={(event) => {
                  event.preventDefault()
                  void applyCourseImage(event.dataTransfer.files?.[0] ?? null)
                }}
              >
                <input
                  ref={courseImageInput}
                  className="file-input"
                  type="file"
                  accept="image/*"
                  onChange={(event) => void applyCourseImage(event.target.files?.[0] ?? null)}
                />
                {looking ? (
                  <>
                    <div className="course-look__preview" style={courseLookStyle(looking)}>
                      <strong>{looking.name}</strong>
                      <small>{looking.image ? 'Cover on' : 'Color only'}</small>
                    </div>
                    <div className="course-look__copy">
                      {looking.image ? (
                        <>
                          <h3>Change the cover</h3>
                          <p>Swap the photo on {looking.name} or drop a new one here. The course color still shows through.</p>
                        </>
                      ) : (
                        <>
                          <h3>Give {looking.name} a cover</h3>
                          <p>Add a photo so this course stands out on the shelf. Drop an image here or pick one from your files.</p>
                        </>
                      )}
                    </div>
                    <div className="course-look__actions">
                      <button
                        type="button"
                        disabled={lookBusy}
                        onClick={() => courseImageInput.current?.click()}
                      >
                        {lookBusy ? 'Adding…' : looking.image ? 'Change image' : 'Add image'}
                      </button>
                      {looking.image ? (
                        <button
                          type="button"
                          className="is-ghost"
                          disabled={lookBusy}
                          onClick={() => {
                            setCourseImage(looking.name, undefined)
                            setLookHint(`Cover removed from ${looking.name}.`)
                          }}
                        >
                          Remove cover
                        </button>
                      ) : null}
                    </div>
                    {lookHint ? <p className="course-look__hint">{lookHint}</p> : null}
                  </>
                ) : (
                  <div className="course-look__copy">
                    <h3>No course selected</h3>
                    <p>Add a course first, then come back here to give it a cover image.</p>
                  </div>
                )}
              </section>
            </div>
          </div>
        ) : null}
        </div>

        <section className="stage">
          <header className="stage__intro">
            <p className="stage__kicker">Tools</p>
            <h2 className="stage__title">Turn notes into practice</h2>
            <p className="stage__desc">
              Pick a course and unit, upload your material, then scroll down for flashcards and quizzes.
            </p>
          </header>
          <div className={`workbook is-fn-${panelFn}`} style={{ ['--course-tone' as string]: activeTone }}>
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
              <div className="panel-pages" ref={pagesRef}>
                <section className="panel-page panel-page--scan" aria-label="Scan and notes">
                  <form className="scan" onSubmit={sendUpload}>
                    <div className="scan__stage">
                      <span className="scan__label">Camera / upload</span>
                      <span className="tab" aria-hidden="true" />
                      <input
                        ref={fileInput}
                        className="file-input"
                        type="file"
                        accept=".png,.jpg,.jpeg,.webp,.pdf,.docx,.txt,.md,.csv,.json"
                        onChange={onPickFile}
                      />
                      <button className="frame" type="button" onClick={() => fileInput.current?.click()}>
                        <CameraMark />
                        <strong>Scan / upload file</strong>
                        {file ? <small>{file.name}</small> : null}
                      </button>
                    </div>
                    <button className="send" type="submit" disabled={!file || uploadBusy}>
                      {uploadBusy ? 'Reading…' : 'Send'}
                    </button>
                  </form>

                  <section className="requests">
                    <h2>{activeUnit ? `${activeUnit} notes` : 'Requests'}</h2>
                    {activeUnit && unitNotes.length === 0 ? (
                      <p>Nothing deposited here yet.</p>
                    ) : null}
                    {!activeUnit ? <p>Pick or create a unit tab to collect notes.</p> : null}
                    {unitNotes.length === 0 ? (
                      <span className="requests__papers" aria-hidden="true">
                        <i />
                        <i />
                        <i />
                      </span>
                    ) : null}
                    {unitNotes.length > 0 ? (
                      <ul>
                        {unitNotes.map((note) => (
                          <li key={note.id}>{note.fileName}</li>
                        ))}
                      </ul>
                    ) : null}
                  </section>
                </section>

                <section className="panel-page panel-page--cards" aria-label="Flashcards">
                  <div className="flash">
                    <p className="flash__kicker">Function 2</p>
                    <h2>{activeUnit ? `${activeUnit} flashcards` : 'Flashcards'}</h2>
                    <div className={`flash-stack is-${swipe}`} aria-live="polite">
                      {deck.length > 1 ? (
                        <article
                          key={`incoming-${cardIndex}`}
                          className="flash__card flash-stack__card is-incoming"
                          aria-hidden="true"
                        >
                          <strong>{deck[(cardIndex - 1 + deck.length) % deck.length].front}</strong>
                          <small>Front · click to flip</small>
                        </article>
                      ) : null}
                      {Array.from({ length: Math.min(3, deck.length) }, (_, layer) => {
                        const index = (cardIndex + layer) % deck.length
                        if (layer > 0 && index === cardIndex) return null
                        const card = deck[index]
                        const isFront = layer === 0
                        return (
                          <button
                            key={`card-${index}`}
                            className={`flash__card flash-stack__card ${isFront && cardFlipped ? 'is-flipped' : ''} layer-${layer}`}
                            type="button"
                            tabIndex={isFront ? 0 : -1}
                            aria-hidden={!isFront}
                            onClick={() => {
                              if (!isFront || swipe !== 'idle') return
                              setCardFlipped((open) => !open)
                            }}
                            onTransitionEnd={(event) => {
                              if (!isFront || event.propertyName !== 'transform' || swipe === 'idle') return
                              finishSwipe(swipe)
                            }}
                          >
                            <strong>
                              {isFront && cardFlipped ? card.back : card.front}
                            </strong>
                            <small>
                              {isFront && cardFlipped ? 'Back · click to flip' : 'Front · click to flip'}
                            </small>
                          </button>
                        )
                      })}
                    </div>
                    <div className="flash__nav">
                      <button type="button" onClick={() => goCard('prev')} disabled={swipe !== 'idle'}>
                        Prev
                      </button>
                      <span>
                        {cardIndex + 1} / {deck.length}
                      </span>
                      <button type="button" onClick={() => goCard('next')} disabled={swipe !== 'idle'}>
                        Next
                      </button>
                    </div>
                  </div>
                </section>

                <section className="panel-page panel-page--quiz" aria-label="Quiz">
                  <div className="quiz">
                    <p className="quiz__kicker">Function 3</p>
                    <h2>{activeUnit ? `${activeUnit} quiz` : 'Quiz'}</h2>
                    {unitNotes.length > 0 ? (
                      <p className="quiz__source">Using {unitNotes.length} note file{unitNotes.length === 1 ? '' : 's'} from this unit</p>
                    ) : (
                      <p className="quiz__source">No notes in this unit yet — math practice until you deposit some</p>
                    )}
                    <div className="quiz__picks">
                      {unitNotes.length === 0 ? (
                        <SketchPick
                          label="Topic"
                          value={quizTopic}
                          options={QUIZ_TOPICS}
                          disabled={quizBusy}
                          open={quizMenu === 'topic'}
                          onToggle={() => setQuizMenu((current) => (current === 'topic' ? null : 'topic'))}
                          onChange={setQuizTopic}
                        />
                      ) : null}
                      <SketchPick
                        label="Level"
                        value={quizDifficulty}
                        options={[
                          { id: 1, label: '1' },
                          { id: 2, label: '2' },
                          { id: 3, label: '3' },
                        ]}
                        disabled={quizBusy}
                        open={quizMenu === 'level'}
                        onToggle={() => setQuizMenu((current) => (current === 'level' ? null : 'level'))}
                        onChange={setQuizDifficulty}
                      />
                    </div>
                    <p className="quiz__prompt">
                      {quizQuestion ? quizQuestion.question : 'Get a question to start.'}
                    </p>
                    <form className="quiz__form" onSubmit={checkQuizAnswer}>
                      <input
                        type="text"
                        value={quizAnswer}
                        onChange={(event) => setQuizAnswer(event.target.value)}
                        placeholder="Your answer"
                        autoComplete="off"
                        disabled={quizBusy || !quizQuestion}
                      />
                      <button type="submit" disabled={quizBusy || !quizQuestion || !quizAnswer.trim()}>
                        Check
                      </button>
                      <button type="button" onClick={() => void loadQuizQuestion()} disabled={quizBusy}>
                        New question
                      </button>
                    </form>
                    {quizError ? <p className="quiz__error">{quizError}</p> : null}
                    {quizResult ? (
                      <div className="quiz__result" role="status">
                        <p>{quizResult.correct ? 'Correct.' : 'Not yet.'}</p>
                        <p>{quizResult.explanation}</p>
                        {quizResult.hint ? <p>{quizResult.hint}</p> : null}
                        <p>
                          XP {quizResult.total_xp} · streak {quizResult.streak}
                          {quizResult.xp_earned ? ` · +${quizResult.xp_earned}` : ''}
                        </p>
                      </div>
                    ) : null}
                  </div>
                </section>
              </div>
            </div>
          </div>
        </section>
      </div>

      {notice ? (
        <p className="notice" role="status">
          {notice}
        </p>
      ) : null}
    </>
  )
}
