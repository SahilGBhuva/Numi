import type { Session } from './types'

const STORAGE_KEY = 'cac-study-session'
const STUDENT_ID_KEY = 'numi-student-id'

export function getStudentId(): string {
  const savedId = localStorage.getItem(STUDENT_ID_KEY)
  if (savedId) return savedId

  const studentId = crypto.randomUUID()
  localStorage.setItem(STUDENT_ID_KEY, studentId)
  return studentId
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
