import type { Course, Notebook, NoteDeposit, Session } from './types'

const STORAGE_KEY = 'cac-study-session'
const STUDENT_ID_KEY = 'numi-student-id'
const NOTEBOOK_KEY = 'numi-notebook'

const emptyNotebook: Notebook = {
  courses: [{ name: 'Biology', units: [] }],
  activeCourse: 'Biology',
  activeUnit: '',
  deposits: [],
}

export function getStudentId(): string {
  const savedId = localStorage.getItem(STUDENT_ID_KEY)
  if (savedId) return savedId

  const studentId = crypto.randomUUID()
  localStorage.setItem(STUDENT_ID_KEY, studentId)
  return studentId
}

export function loadNotebook(): Notebook {
  const raw = localStorage.getItem(NOTEBOOK_KEY)
  if (!raw) return emptyNotebook
  try {
    const parsed = JSON.parse(raw) as Notebook
    if (!Array.isArray(parsed.courses) || parsed.courses.length === 0) {
      return emptyNotebook
    }
    const courses: Course[] = parsed.courses.map((course) =>
      typeof course === 'string' ? { name: course, units: [] } : course,
    )
    return {
      courses,
      activeCourse: parsed.activeCourse || courses[0].name,
      activeUnit: parsed.activeUnit || '',
      deposits: Array.isArray(parsed.deposits) ? parsed.deposits : [],
    }
  } catch {
    return emptyNotebook
  }
}

export function saveNotebook(notebook: Notebook): void {
  localStorage.setItem(NOTEBOOK_KEY, JSON.stringify(notebook))
}

export function unitsFor(courses: Course[], courseName: string): string[] {
  return courses.find((course) => course.name === courseName)?.units ?? []
}

export function notesFor(deposits: NoteDeposit[], course: string, unit: string): NoteDeposit[] {
  return deposits.filter((item) => item.course === course && item.unit === unit)
}

export function createDraftSession(topic: string, notes: string): Session {
  return {
    topic: topic.trim(),
    notes: notes.trim(),
    questions: [],
    attempts: [],
    score: null,
    streak: 0,
    xp: 0,
  }
}

export function saveSession(session: Session): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(session))
}

export function loadSession(): Session | null {
  const raw = localStorage.getItem(STORAGE_KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw) as Session
  } catch {
    return null
  }
}
