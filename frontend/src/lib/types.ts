export type Question = {
  id: string
  prompt: string
  choices: string[]
  correctIndex: number
}

export type Attempt = {
  questionId: string
  choiceIndex: number
}

export type Session = {
  topic: string
  notes: string
  questions: Question[]
  attempts: Attempt[]
  score: number | null
  streak: number
  xp: number
}

export type ApiTopic =
  | 'addition'
  | 'subtraction'
  | 'multiplication'
  | 'division'
  | 'mixed'

export type GeneratedQuestion = {
  question: string
  correct_answer: string
  topic: string
  difficulty: number
}

export type NoteDeposit = {
  id: string
  course: string
  unit: string
  fileName: string
  createdAt: string
}

export type Course = {
  name: string
  units: string[]
  stashedUnits?: string[]
  tone?: string
  image?: string
  tabLabel?: string
  coverX?: number
  coverY?: number
  coverZoom?: number
}

export type Notebook = {
  courses: Course[]
  activeCourse: string
  activeUnit: string
  deposits: NoteDeposit[]
}

export type AssignmentPriority = 'high' | 'medium' | 'low'

export type CourseAssignment = {
  id: string
  course: string
  title: string
  due: string
  priority: AssignmentPriority
  done: boolean
}

export type UnitVerdict = 'locked' | 'seeded' | 'warming' | 'rising' | 'steady' | 'sharp' | 'slipping' | 'stuck'

export type UnitAttempt = {
  id: string
  course: string
  unit: string
  correct: boolean
  at: number
}
