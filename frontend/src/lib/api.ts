export type Topic = 'addition' | 'subtraction' | 'multiplication' | 'division' | 'mixed'
export type GeneratedQuestion = { question: string; correct_answer: string; topic: string; difficulty: number }
export type NoteQuizContext = {
  course: string
  unit: string
  files: string[]
  other_units: string[]
  other_courses: string[]
}
export type AnswerResult = { correct: boolean; mistake_type: string | null; explanation: string; hint: string | null; xp_earned: number; total_xp: number; streak: number }
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
export type FriendQuest = {
  id: number
  friend_id: string
  friend_name: string
  target_xp: number
  progress_xp: number
  status: string
  expires_at: string
}
export type FriendsHub = { friends: Friend[]; requests: FriendRequest[]; leaderboard: Friend[]; quests: FriendQuest[] }

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

const API_URL = import.meta.env.VITE_API_URL ?? ''

async function request<T>(path: string, options?: RequestInit, accessToken?: string): Promise<T> {
  const headers = new Headers(options?.headers)
  if (!(options?.body instanceof FormData)) headers.set('Content-Type', 'application/json')
  if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`)
  const response = await fetch(`${API_URL}${path}`, { ...options, headers })
  if (!response.ok) {
    const data = (await response.json().catch(() => null)) as { detail?: string } | null
    throw new Error(data?.detail ?? `Bindet could not complete that request (${response.status}).`)
  }
  return response.json() as Promise<T>
}

export function generateQuestion(topic: Topic, difficulty: number, notes?: NoteQuizContext) {
  return request<GeneratedQuestion>('/api/generate-question', {
    method: 'POST',
    body: JSON.stringify({ topic, difficulty, notes: notes && notes.files.length > 0 ? notes : undefined }),
  })
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
    const data = (await response.json().catch(() => null)) as { detail?: string } | null
    throw new Error(data?.detail ?? `Bindet could not load progress (${response.status}).`)
  }
  return response.json() as Promise<Progress>
}

export async function getAccountProfile(accessToken: string): Promise<Profile | null> {
  const response = await fetch(`${API_URL}/api/account/profile`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (response.status === 404) return null
  if (!response.ok) throw new Error('Could not load your Bindet profile.')
  return response.json() as Promise<Profile>
}

export function recordDailyLogin(studentId: string, accessToken?: string) {
  return request<Progress>('/api/daily-login', {
    method: 'POST',
    body: JSON.stringify({ student_id: studentId }),
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
  return request<FriendQuest>('/api/friend-quests', {
    method: 'POST',
    body: JSON.stringify({ friend_id: friendId, target_xp: 100 }),
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
