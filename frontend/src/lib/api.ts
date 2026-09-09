import type { AnswerAnalysis, ApiTopic, GeneratedQuestion } from './types'

const STUDENT_KEY = 'cac-student-id'
const BASE = import.meta.env.VITE_API_URL || '/api'

async function readJson<T>(response: Response): Promise<T> {
  if (!response.ok) {
    throw new Error(`API ${response.status}`)
  }
  return (await response.json()) as T
}

export function getStudentId(): string {
  const existing = localStorage.getItem(STUDENT_KEY)
  if (existing) {
    return existing
  }
  const next = `student-${crypto.randomUUID()}`
  localStorage.setItem(STUDENT_KEY, next)
  return next
}

export async function checkHealth(): Promise<boolean> {
  try {
    const response = await fetch(`${BASE}/health`)
    if (!response.ok) {
      return false
    }
    const body = (await response.json()) as { status?: string }
    return body.status === 'healthy'
  } catch {
    return false
  }
}

export async function generateQuestion(
  topic: ApiTopic = 'mixed',
  difficulty = 1,
): Promise<GeneratedQuestion> {
  const response = await fetch(`${BASE}/generate-question`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ topic, difficulty }),
  })
  return readJson<GeneratedQuestion>(response)
}

export async function analyzeAnswer(input: {
  question: string
  studentAnswer: string
  correctAnswer: string
  topic: string
}): Promise<AnswerAnalysis> {
  const response = await fetch(`${BASE}/analyze-answer`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      question: input.question,
      student_answer: input.studentAnswer,
      correct_answer: input.correctAnswer,
      student_id: getStudentId(),
      topic: input.topic,
    }),
  })
  return readJson<AnswerAnalysis>(response)
}
