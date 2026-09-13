import type { Course, NoteDeposit, UnitAttempt } from './types'

const QUEST_KEY = 'bindet-quests'
const GOAL_KEY = 'bindet-goals'

export type QuestKind = 'xp' | 'notes' | 'quiz' | 'streak'
export type GoalKind = 'xp' | 'notes' | 'quiz' | 'custom'
export type QuestWindow = 'day' | 'week' | 'open'

export type QuestOffer = {
  id: string
  title: string
  hint: string
  kind: QuestKind
  target: number
  window: QuestWindow
  course?: string
  unit?: string
  tone: string
}

export type ActiveQuest = QuestOffer & {
  startedAt: number
  baseline: number
  doneAt?: number
}

export type PersonalGoal = {
  id: string
  title: string
  kind: GoalKind
  target: number
  due: string
  course: string
  createdAt: number
  baseline: number
  done: boolean
}

export type QuestStats = {
  xp: number
  loginStreak: number
  deposits: NoteDeposit[]
  attempts: UnitAttempt[]
}

function ymd(date = new Date()) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function startOfWeek(date = new Date()) {
  const next = new Date(date)
  const day = next.getDay()
  next.setHours(0, 0, 0, 0)
  next.setDate(next.getDate() - day)
  return next.getTime()
}

function readList<T>(key: string): T[] {
  const raw = localStorage.getItem(key)
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw) as T[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function loadQuests(): ActiveQuest[] {
  return readList<ActiveQuest>(QUEST_KEY).filter((item) => item?.id && item.title)
}

export function saveQuests(items: ActiveQuest[]) {
  localStorage.setItem(QUEST_KEY, JSON.stringify(items))
}

export function loadGoals(): PersonalGoal[] {
  return readList<PersonalGoal>(GOAL_KEY).filter((item) => item?.id && item.title)
}

export function saveGoals(items: PersonalGoal[]) {
  localStorage.setItem(GOAL_KEY, JSON.stringify(items))
}

export function pruneQuests(items: ActiveQuest[]): ActiveQuest[] {
  const today = ymd()
  const week = startOfWeek()
  return items.filter((item) => {
    if (item.doneAt) {
      return ymd(new Date(item.doneAt)) === today
    }
    if (item.window === 'day') return ymd(new Date(item.startedAt)) === today
    if (item.window === 'week') return item.startedAt >= week
    return true
  })
}

function countSince(
  deposits: NoteDeposit[],
  startedAt: number,
  course?: string,
) {
  return deposits.filter((item) => {
    if (course && item.course !== course) return false
    const at = Date.parse(item.createdAt)
    return Number.isFinite(at) ? at >= startedAt : true
  }).length
}

function quizSince(attempts: UnitAttempt[], startedAt: number, course?: string, unit?: string) {
  return attempts.filter((item) => {
    if (course && item.course !== course) return false
    if (unit && item.unit !== unit) return false
    return item.at >= startedAt
  }).length
}

export function questProgress(quest: ActiveQuest, stats: QuestStats) {
  if (quest.kind === 'xp') return Math.max(0, stats.xp - quest.baseline)
  if (quest.kind === 'notes') return countSince(stats.deposits, quest.startedAt, quest.course)
  if (quest.kind === 'quiz') return quizSince(stats.attempts, quest.startedAt, quest.course, quest.unit)
  return stats.loginStreak
}

export function goalProgress(goal: PersonalGoal, stats: QuestStats) {
  if (goal.done) return goal.target
  if (goal.kind === 'xp') return Math.max(0, stats.xp - goal.baseline)
  if (goal.kind === 'notes') return countSince(stats.deposits, goal.createdAt, goal.course || undefined)
  if (goal.kind === 'quiz') return quizSince(stats.attempts, goal.createdAt, goal.course || undefined)
  return 0
}

export function offerQuests(
  courses: Course[],
  deposits: NoteDeposit[],
  attempts: UnitAttempt[],
  dailyXp: number,
): QuestOffer[] {
  const today = ymd()
  const course = courses[0]
  const busy = [...courses].sort(
    (a, b) =>
      deposits.filter((item) => item.course === b.name).length -
      deposits.filter((item) => item.course === a.name).length,
  )[0]
  const focus = busy ?? course
  const unit = focus?.units[0]
  const tone = (name?: string) => courses.find((item) => item.name === name)?.tone ?? '#7e87ef'
  const notesIn = (name: string) => deposits.filter((item) => item.course === name).length
  const attemptsIn = (name: string, unitName?: string) => attempts.filter((item) => {
    if (item.course !== name) return false
    if (unitName && item.unit !== unitName) return false
    return true
  }).length

  const offers: QuestOffer[] = [
    {
      id: `xp-day-${today}`,
      title: `Bank ${dailyXp} XP today`,
      hint: 'Quiz, scan, or keep a streak going. XP from anywhere counts.',
      kind: 'xp',
      target: dailyXp,
      window: 'day',
      tone: '#7e87ef',
    },
    {
      id: `xp-week-${today.slice(0, 7)}`,
      title: 'Hit 100 XP this week',
      hint: 'A week-long pull. Any study on bindit feeds it.',
      kind: 'xp',
      target: 100,
      window: 'week',
      tone: '#8b93ff',
    },
  ]

  if (focus) {
    const have = notesIn(focus.name)
    offers.push({
      id: `notes-${focus.name}-${today}`,
      title: have === 0 ? `Seed ${focus.name} with a note` : `Drop 2 notes in ${focus.name}`,
      hint: have === 0 ? 'Open Workspace, pick a unit, and scan or upload a file.' : 'Add two more pages to that course binder.',
      kind: 'notes',
      target: have === 0 ? 1 : 2,
      window: 'day',
      course: focus.name,
      tone: tone(focus.name),
    })
  }

  if (focus && unit) {
    const completed = attemptsIn(focus.name, unit)
    offers.push({
      id: `quiz-${focus.name}-${unit}-${today}`,
      title: completed === 0 ? `Start 3 questions in ${unit}` : `Do 3 more in ${unit}`,
      hint: completed === 0
        ? `Kick off your first ${focus.name} practice set for this unit.`
        : `You have already answered ${completed} here. Add three fresh reps.`,
      kind: 'quiz',
      target: 3,
      window: 'day',
      course: focus.name,
      unit,
      tone: tone(focus.name),
    })
  } else if (focus) {
    offers.push({
      id: `unit-${focus.name}-${today}`,
      title: `Open a unit in ${focus.name}`,
      hint: 'Add a unit tab in Workspace, then come back to pin a quiz quest.',
      kind: 'notes',
      target: 1,
      window: 'day',
      course: focus.name,
      tone: tone(focus.name),
    })
  }

  offers.push({
    id: `streak-${today}`,
    title: 'Hold a 3-day streak',
    hint: 'Open bindit three days in a row and keep the chain alive.',
    kind: 'streak',
    target: 3,
    window: 'open',
    tone: '#cf7d72',
  })

  if (courses.length > 1) {
    const other = courses.find((item) => item.name !== focus?.name)
    if (other) {
      offers.push({
        id: `visit-${other.name}-${today}`,
        title: `Leave a note in ${other.name}`,
        hint: 'Switch courses in Workspace and drop one useful file.',
        kind: 'notes',
        target: 1,
        window: 'day',
        course: other.name,
        tone: tone(other.name),
      })
    }
  }

  return offers.slice(0, 6)
}

export function startQuest(offer: QuestOffer, stats: QuestStats, current: ActiveQuest[]): ActiveQuest[] {
  const live = pruneQuests(current).filter((item) => !item.doneAt)
  if (live.some((item) => item.id === offer.id) || live.length >= 4) return current
  const baseline = offer.kind === 'xp' ? stats.xp : 0
  return [
    {
      ...offer,
      startedAt: Date.now(),
      baseline,
    },
    ...current,
  ]
}

export function settleQuests(items: ActiveQuest[], stats: QuestStats): ActiveQuest[] {
  return pruneQuests(items).map((item) => {
    if (item.doneAt) return item
    const value = questProgress(item, stats)
    if (value >= item.target) return { ...item, doneAt: Date.now() }
    return item
  })
}
