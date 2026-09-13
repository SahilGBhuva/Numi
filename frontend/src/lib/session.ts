import type { Course, CourseAssignment, Notebook, NoteDeposit, Session } from './types'

const STORAGE_KEY = 'cac-study-session'
const STUDENT_ID_KEY = 'bindit-student-id'
const LEGACY_STUDENT_ID_KEY = 'numi-student-id'
const NOTEBOOK_KEY = 'numi-notebook'
const AVATAR_KEY = 'numi-avatar'
const PLANNER_KEY = 'bindet-planner'

export const COURSE_TONES = [
  '#FF1744',
  '#FF6D00',
  '#FFD600',
  '#00E676',
  '#00B0FF',
  '#3D5AFE',
  '#D500F9',
  '#FF4081',
]

const emptyNotebook: Notebook = {
  courses: [{ name: 'Biology', units: [], tone: COURSE_TONES[0] }],
  activeCourse: 'Biology',
  activeUnit: '',
  deposits: [],
}

export function withCourseTones(courses: Course[]): Course[] {
  const used = new Set(
    courses.map((course) => course.tone?.toLowerCase()).filter((tone): tone is string => Boolean(tone)),
  )
  return courses.map((course, index) => {
    if (course.tone) return course
    const unused = COURSE_TONES.find((tone) => !used.has(tone.toLowerCase()))
    const tone = unused ?? COURSE_TONES[index % COURSE_TONES.length]
    used.add(tone.toLowerCase())
    return { ...course, tone }
  })
}

export function pickCourseTone(courses: Course[]): string {
  const used = new Set(courses.map((course) => course.tone?.toLowerCase()))
  return COURSE_TONES.find((tone) => !used.has(tone.toLowerCase())) ?? COURSE_TONES[courses.length % COURSE_TONES.length]
}

export function getStudentId(): string {
  const savedId = localStorage.getItem(STUDENT_ID_KEY) ?? localStorage.getItem(LEGACY_STUDENT_ID_KEY)
  if (savedId) {
    localStorage.setItem(STUDENT_ID_KEY, savedId)
    localStorage.removeItem(LEGACY_STUDENT_ID_KEY)
    return savedId
  }

  const studentId = crypto.randomUUID()
  localStorage.setItem(STUDENT_ID_KEY, studentId)
  return studentId
}

export function loadNotebook(): Notebook {
  const raw = localStorage.getItem(NOTEBOOK_KEY)
  if (!raw) return emptyNotebook
  try {
    const parsed = JSON.parse(raw) as Notebook
    if (!Array.isArray(parsed.courses)) {
      return emptyNotebook
    }
    const courses: Course[] = withCourseTones(
      parsed.courses.map((course) => {
        if (typeof course === 'string') return { name: course, units: [], stashedUnits: [] }
        const units = Array.isArray(course.units) ? course.units.filter((name) => typeof name === 'string') : []
        const stashedUnits = Array.isArray(course.stashedUnits)
          ? course.stashedUnits.filter((name) => typeof name === 'string' && !units.includes(name))
          : []
        return { ...course, units, stashedUnits }
      }),
    )
    if (courses.length === 0) {
      return {
        courses: [],
        activeCourse: '',
        activeUnit: '',
        deposits: Array.isArray(parsed.deposits) ? parsed.deposits : [],
      }
    }
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

export function stashedUnitsFor(courses: Course[], courseName: string): string[] {
  return courses.find((course) => course.name === courseName)?.stashedUnits ?? []
}

export function notesFor(deposits: NoteDeposit[], course: string, unit: string): NoteDeposit[] {
  return deposits.filter((item) => item.course === course && item.unit === unit)
}

export function loadPlanner(): CourseAssignment[] {
  const raw = localStorage.getItem(PLANNER_KEY)
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw) as CourseAssignment[]
    if (!Array.isArray(parsed)) return []
    return parsed.filter((item) => item && typeof item.id === 'string' && typeof item.course === 'string')
  } catch {
    return []
  }
}

export function savePlanner(items: CourseAssignment[]): void {
  localStorage.setItem(PLANNER_KEY, JSON.stringify(items))
}

export function assignmentsFor(items: CourseAssignment[], course: string): CourseAssignment[] {
  return items.filter((item) => item.course === course)
}

export function removePlannerForCourse(course: string): void {
  savePlanner(loadPlanner().filter((item) => item.course !== course))
}

export function renamePlannerCourse(from: string, to: string): void {
  savePlanner(loadPlanner().map((item) => (item.course === from ? { ...item, course: to } : item)))
}

export function loadAvatar(): string {
  return localStorage.getItem(AVATAR_KEY) ?? ''
}

export function saveAvatar(dataUrl: string): void {
  localStorage.setItem(AVATAR_KEY, dataUrl)
}

export function fileToCourseImageDataUrl(file: File): Promise<string> {
  const dpr = Math.min(typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1, 2)
  const max = Math.round(1600 * dpr)
  return fileToFitDataUrl(file, max, max, 0.92)
}

function fileToFitDataUrl(file: File, maxWidth: number, maxHeight: number, quality = 0.84): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('Could not read image'))
    reader.onload = () => {
      const image = new Image()
      image.onload = () => {
        const scale = Math.min(maxWidth / image.width, maxHeight / image.height, 1)
        const width = Math.max(1, Math.round(image.width * scale))
        const height = Math.max(1, Math.round(image.height * scale))
        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        if (!ctx) {
          resolve(String(reader.result))
          return
        }
        ctx.imageSmoothingEnabled = true
        ctx.imageSmoothingQuality = 'high'
        ctx.drawImage(image, 0, 0, width, height)
        const webp = canvas.toDataURL('image/webp', quality)
        resolve(webp.startsWith('data:image/webp') ? webp : canvas.toDataURL('image/jpeg', quality))
      }
      image.onerror = () => reject(new Error('Could not load image'))
      image.src = String(reader.result)
    }
    reader.readAsDataURL(file)
  })
}

function fileToCoverDataUrl(file: File, width: number, height: number, quality = 0.84): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('Could not read image'))
    reader.onload = () => {
      const image = new Image()
      image.onload = () => {
        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        if (!ctx) {
          resolve(String(reader.result))
          return
        }
        ctx.imageSmoothingEnabled = true
        ctx.imageSmoothingQuality = 'high'
        const scale = Math.max(width / image.width, height / image.height)
        const dw = image.width * scale
        const dh = image.height * scale
        ctx.drawImage(image, (width - dw) / 2, (height - dh) / 2, dw, dh)
        const webp = canvas.toDataURL('image/webp', quality)
        resolve(webp.startsWith('data:image/webp') ? webp : canvas.toDataURL('image/jpeg', quality))
      }
      image.onerror = () => reject(new Error('Could not load image'))
      image.src = String(reader.result)
    }
    reader.readAsDataURL(file)
  })
}

export function fileToAvatarDataUrl(file: File): Promise<string> {
  return fileToCoverDataUrl(file, 256, 256)
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
