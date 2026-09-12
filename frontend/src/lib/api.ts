import { loadAuthSession, refreshAuthSession } from './auth'
import { getStudentId } from './session'

export type Topic = 'addition' | 'subtraction' | 'multiplication' | 'division' | 'mixed'
export type GeneratedQuestion = { question_id: string; question: string; topic: string; difficulty: number }
export type NoteQuizContext = {
  course: string
  unit: string
  files: string[]
  other_units: string[]
  other_courses: string[]
}
export type Flashcard = { front: string; back: string; topic: string }
export type FlashcardDeck = {
  course: string
  unit: string
  personalized: boolean
  cards: Flashcard[]
}
export type UploadedNote = {
  id: string
  course: string
  unit: string
  file_name: string
  content_type: string
  size_bytes: number
  status: 'ready'
  text_preview: string
  created_at: string
}
export type AnswerResult = {
  correct: boolean
  score: number
  mistake_type: string | null
  misconception: string | null
  explanation: string
  hint: string | null
  grading_source: 'deterministic' | 'ai' | 'fallback'
  xp_earned: number
  total_xp: number
  streak: number
}
export type TopicStat = { topic: string; attempts: number; correct_answers: number; accuracy: number }
export type Progress = {
  student_id: string
  total_xp: number
  attempts: number
  correct_answers: number
  accuracy: number
  streak: number
  best_streak: number
  login_streak: number
  best_login_streak: number
  weak_topics: string[]
  topics: TopicStat[]
}
export type Profile = {
  student_id: string
  username: string
  display_name: string
  avatar_path: string
  friend_code: string
  daily_goal: number
  total_xp: number
  streak: number
  best_streak: number
  login_streak: number
  best_login_streak: number
}
export type Friend = {
  student_id: string
  username: string
  display_name: string
  avatar_path: string
  total_xp: number
  streak: number
  active_today: boolean
}
export type FriendRequest = { request_id: number; username: string; display_name: string; created_at: string }
export type FriendQuest = { id: number; friend_id: string; friend_name: string; target_xp: number; progress_xp: number; status: string; expires_at: string }
export type FriendsHub = { friends: Friend[]; requests: FriendRequest[]; leaderboard: Friend[]; quests: FriendQuest[] }

const API_URL = import.meta.env.VITE_API_URL ?? ''

async function resolvedToken(explicit?: string): Promise<string | undefined> {
  if (explicit) return explicit
  const saved = loadAuthSession()
  const session = saved ? await refreshAuthSession(saved) : null
  return session?.access_token
}

async function request<T>(path: string, options?: RequestInit, accessToken?: string): Promise<T> {
  const headers = new Headers(options?.headers)
  if (!(options?.body instanceof FormData)) headers.set('Content-Type', 'application/json')
  const token = await resolvedToken(accessToken)
  if (token) headers.set('Authorization', `Bearer ${token}`)
  const response = await fetch(`${API_URL}${path}`, { ...options, headers })
  if (!response.ok) {
    const data = (await response.json().catch(() => null)) as { detail?: string } | null
    throw new Error(data?.detail ?? `bindet could not complete that request (${response.status}).`)
  }
  return response.json() as Promise<T>
}

async function optimizedImage(file: File): Promise<File> {
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) return file
  try {
    const bitmap = await createImageBitmap(file)
    const largestSide = Math.max(bitmap.width, bitmap.height)
    if (file.size < 1_000_000 && largestSide <= 1800) {
      bitmap.close()
      return file
    }
    const scale = Math.min(1, 1800 / largestSide)
    const width = Math.max(1, Math.round(bitmap.width * scale))
    const height = Math.max(1, Math.round(bitmap.height * scale))
    let blob: Blob | null = null
    if (typeof OffscreenCanvas !== 'undefined') {
      const canvas = new OffscreenCanvas(width, height)
      canvas.getContext('2d')?.drawImage(bitmap, 0, 0, width, height)
      blob = await canvas.convertToBlob({ type: 'image/webp', quality: 0.82 })
    } else {
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      canvas.getContext('2d')?.drawImage(bitmap, 0, 0, width, height)
      blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/webp', 0.82))
    }
    bitmap.close()
    if (!blob || blob.size >= file.size) return file
    return new File([blob], file.name.replace(/\.[^.]+$/, '.webp'), { type: 'image/webp', lastModified: file.lastModified })
  } catch {
    return file
  }
}

export async function uploadNote(file: File, course: string, unit: string, accessToken?: string) {
  const preparedFile = await optimizedImage(file)
  const form = new FormData()
  form.set('file', preparedFile)
  form.set('course', course)
  form.set('unit', unit)
  return request<UploadedNote>('/api/notes', { method: 'POST', body: form }, accessToken)
}

export function generateQuestion(topic: Topic, difficulty: number, notes?: NoteQuizContext) {
  return request<GeneratedQuestion>('/api/generate-question', {
    method: 'POST',
    body: JSON.stringify({
      topic,
      difficulty,
      student_id: getStudentId(),
      notes: notes ?? undefined,
    }),
  })
}

export function generateFlashcards(
  context: { course: string; unit: string; files?: string[]; count?: number },
  accessToken?: string,
) {
  return request<FlashcardDeck>('/api/generate-flashcards', {
    method: 'POST',
    body: JSON.stringify({
      student_id: getStudentId(),
      course: context.course,
      unit: context.unit,
      files: context.files ?? [],
      count: context.count ?? 10,
    }),
  }, accessToken)
}

export function analyzeAnswer(question: GeneratedQuestion, studentAnswer: string, studentId: string, accessToken?: string) {
  return request<AnswerResult>('/api/analyze-answer', {
    method: 'POST',
    body: JSON.stringify({ question_id: question.question_id, student_answer: studentAnswer, student_id: studentId }),
  }, accessToken)
}

export async function getProgress(studentId: string, accessToken?: string): Promise<Progress | null> {
  const headers = new Headers()
  const token = await resolvedToken(accessToken)
  if (token) headers.set('Authorization', `Bearer ${token}`)
  const response = await fetch(`${API_URL}/api/progress/${encodeURIComponent(studentId)}`, { headers })
  if (response.status === 404) return null
  if (!response.ok) {
    const data = (await response.json().catch(() => null)) as { detail?: string } | null
    throw new Error(data?.detail ?? `bindet could not load progress (${response.status}).`)
  }
  return response.json() as Promise<Progress>
}

export async function getAccountProfile(accessToken: string): Promise<Profile | null> {
  const response = await fetch(`${API_URL}/api/account/profile`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (response.status === 404) return null
  if (!response.ok) throw new Error('Could not load your bindet profile.')
  return response.json() as Promise<Profile>
}

export function recordDailyLogin(studentId: string, accessToken?: string) {
  return request<Progress>('/api/daily-login', {
    method: 'POST',
    body: JSON.stringify({ student_id: studentId }),
  }, accessToken)
}

export function saveAccountProfile(
  accessToken: string,
  profile: { username: string; display_name: string; guest_id: string; daily_goal?: number; avatar_path?: string },
) {
  return request<Profile>('/api/account/profile', {
    method: 'PUT',
    body: JSON.stringify(profile),
  }, accessToken)
}

export function getFriends(accessToken: string) {
  return request<FriendsHub>('/api/friends', undefined, accessToken)
}

export function sendFriendRequest(friendCode: string, accessToken: string) {
  return request('/api/friends/requests', { method: 'POST', body: JSON.stringify({ friend_code: friendCode }) }, accessToken)
}

export function answerFriendRequest(requestId: number, accept: boolean, accessToken: string) {
  return request(`/api/friends/requests/${requestId}`, { method: 'POST', body: JSON.stringify({ accept }) }, accessToken)
}

export function removeFriend(friendId: string, accessToken: string) {
  return request(`/api/friends/${encodeURIComponent(friendId)}`, { method: 'DELETE' }, accessToken)
}

export function startFriendQuest(friendId: string, accessToken: string) {
  return request<FriendQuest>('/api/friend-quests', { method: 'POST', body: JSON.stringify({ friend_id: friendId, target_xp: 100 }) }, accessToken)
}
