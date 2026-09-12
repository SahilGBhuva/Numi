export type Topic = 'addition' | 'subtraction' | 'multiplication' | 'division' | 'mixed'
export type GeneratedQuestion = { question: string; correct_answer: string; topic: Exclude<Topic, 'mixed'>; difficulty: number }
export type AnswerResult = { correct: boolean; mistake_type: string | null; explanation: string; hint: string | null; xp_earned: number; total_xp: number; streak: number }
export type Progress = { student_id: string; total_xp: number; attempts: number; correct_answers: number; accuracy: number; streak: number; best_streak: number; weak_topics: string[] }
export type UploadedImage = { id: string; original_name: string; content_type: string; size_bytes: number; created_at: string; url: string }
export type Profile = { student_id: string; username: string; display_name: string; friend_code: string }

const API_URL = import.meta.env.VITE_API_URL ?? ''

async function request<T>(path: string, options?: RequestInit, accessToken?: string): Promise<T> {
  const headers = new Headers(options?.headers)
  if (!(options?.body instanceof FormData)) headers.set('Content-Type', 'application/json')
  if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`)
  const response = await fetch(`${API_URL}${path}`, { ...options, headers })
  if (!response.ok) {
    const data = await response.json().catch(() => null) as { detail?: string } | null
    throw new Error(data?.detail ?? `Bindit could not complete that request (${response.status}).`)
  }
  return response.json() as Promise<T>
}

export function generateQuestion(topic: Topic, difficulty: number) {
  return request<GeneratedQuestion>('/api/generate-question', { method: 'POST', body: JSON.stringify({ topic, difficulty }) })
}

export function analyzeAnswer(question: GeneratedQuestion, studentAnswer: string, studentId: string, accessToken?: string) {
  return request<AnswerResult>('/api/analyze-answer', {
    method: 'POST',
    body: JSON.stringify({ question: question.question, student_answer: studentAnswer, correct_answer: question.correct_answer, student_id: studentId, topic: question.topic }),
  }, accessToken)
}

export async function getProgress(studentId: string, accessToken?: string): Promise<Progress | null> {
  const headers = accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined
  const response = await fetch(`${API_URL}/api/progress/${encodeURIComponent(studentId)}`, { headers })
  if (response.status === 404) return null
  if (!response.ok) {
    const data = await response.json().catch(() => null) as { detail?: string } | null
    throw new Error(data?.detail ?? `Bindit could not load progress (${response.status}).`)
  }
  return response.json() as Promise<Progress>
}

export function listImages(accessToken: string) {
  return request<UploadedImage[]>('/api/images', undefined, accessToken)
}

export function uploadImage(file: File, accessToken: string) {
  const body = new FormData()
  body.append('image', file)
  return request<UploadedImage>('/api/images', { method: 'POST', body }, accessToken)
}

export async function getAccountProfile(accessToken: string): Promise<Profile | null> {
  const response = await fetch(`${API_URL}/api/account/profile`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (response.status === 404) return null
  if (!response.ok) throw new Error('Could not load your Bindit profile.')
  return response.json() as Promise<Profile>
}

export function saveAccountProfile(
  accessToken: string,
  profile: { username: string; display_name: string; guest_id: string },
) {
  return request<Profile>('/api/account/profile', {
    method: 'PUT', body: JSON.stringify(profile),
  }, accessToken)
}
