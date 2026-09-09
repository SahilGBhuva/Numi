export type Topic = 'addition' | 'subtraction' | 'multiplication' | 'division' | 'mixed'
export type GeneratedQuestion = { question: string; correct_answer: string; topic: Exclude<Topic, 'mixed'>; difficulty: number }
export type AnswerResult = { correct: boolean; mistake_type: string | null; explanation: string; hint: string | null; xp_earned: number; total_xp: number; streak: number }
export type Progress = { student_id: string; total_xp: number; attempts: number; correct_answers: number; accuracy: number; streak: number; best_streak: number; weak_topics: string[] }

const API_URL = import.meta.env.VITE_API_URL ?? 'http://127.0.0.1:8000'

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, { headers: { 'Content-Type': 'application/json' }, ...options })
  if (!response.ok) throw new Error(`Pocket Tutor API returned ${response.status}`)
  return response.json() as Promise<T>
}

export function generateQuestion(topic: Topic, difficulty: number) {
  return request<GeneratedQuestion>('/generate-question', { method: 'POST', body: JSON.stringify({ topic, difficulty }) })
}

export function analyzeAnswer(question: GeneratedQuestion, studentAnswer: string, studentId: string) {
  return request<AnswerResult>('/analyze-answer', {
    method: 'POST',
    body: JSON.stringify({ question: question.question, student_answer: studentAnswer, correct_answer: question.correct_answer, student_id: studentId, topic: question.topic }),
  })
}

export async function getProgress(studentId: string): Promise<Progress | null> {
  const response = await fetch(`${API_URL}/progress/${encodeURIComponent(studentId)}`)
  if (response.status === 404) return null
  if (!response.ok) throw new Error(`Pocket Tutor API returned ${response.status}`)
  return response.json() as Promise<Progress>
}
