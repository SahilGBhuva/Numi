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

export type AnswerAnalysis = {
  correct: boolean
  mistake_type: string | null
  explanation: string
  hint: string | null
  xp_earned: number
  total_xp: number
  streak: number
}
