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
