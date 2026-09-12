import type { Course, NoteDeposit, UnitAttempt, UnitVerdict } from './types'
import type { TopicStat } from './api'

const ATTEMPT_KEY = 'bindet-unit-attempts'
const SESSION_SIZE = 3
const RECENT_WINDOW = 6
const SERIES_LENGTH = 8
const RISE_MARGIN = 0.12

const SAMPLE_UNITS: Record<string, string[]> = {
  biology: ['Cells', 'Genetics', 'Ecology', 'Human body'],
  chemistry: ['Atoms', 'Bonding', 'Reactions', 'Stoichiometry'],
  physics: ['Motion', 'Energy', 'Waves', 'Electricity'],
  history: ['Causes', 'Events', 'People', 'Aftermath'],
  english: ['Rhetoric', 'Theme', 'Structure', 'Voice'],
  algebra: ['Equations', 'Functions', 'Graphs', 'Systems'],
  math: ['Foundations', 'Practice', 'Word problems', 'Review'],
}

export type UnitJudgment = {
  name: string
  notes: number
  attempts: number
  correct: number
  accuracy: number
  mastery: number
  delta: number
  verdict: UnitVerdict
  reason: string
  live: boolean
}

export type CoursePulse = {
  course: Course
  units: UnitJudgment[]
  mastery: number
  verdict: UnitVerdict
  reason: string
  recommended: string
  live: boolean
  labels: string[]
  overall: number[]
  series: { name: string; color: string; values: number[] }[]
  palette: CoursePalette
}

export type CoursePalette = {
  tone: string
  line: string
  fill: string
  soft: string
  ink: string
  units: string[]
}

export const VERDICT_COPY: Record<UnitVerdict, { label: string; hint: string }> = {
  locked: { label: 'Locked', hint: 'No notes or quizzes yet' },
  seeded: { label: 'Seeded', hint: 'Notes are in — quiz to start the line' },
  warming: { label: 'Warming', hint: 'Need a few more answers to judge the trend' },
  rising: { label: 'Rising', hint: 'Recent answers beat your earlier ones' },
  steady: { label: 'Steady', hint: 'Holding the same level session to session' },
  sharp: { label: 'Sharp', hint: 'High mastery and staying there' },
  slipping: { label: 'Slipping', hint: 'Recent answers are weaker than before' },
  stuck: { label: 'Stuck', hint: 'Lots of tries, still under 45% mastery' },
}

export function loadUnitAttempts(): UnitAttempt[] {
  const raw = localStorage.getItem(ATTEMPT_KEY)
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw) as UnitAttempt[]
    return Array.isArray(parsed) ? parsed.filter((item) => item?.course && item?.unit) : []
  } catch {
    return []
  }
}

export function recordUnitAttempt(entry: Omit<UnitAttempt, 'id' | 'at'> & { at?: number }) {
  if (!entry.course || !entry.unit) return
  const next: UnitAttempt[] = [
    ...loadUnitAttempts(),
    {
      id: crypto.randomUUID(),
      course: entry.course,
      unit: entry.unit,
      correct: entry.correct,
      at: entry.at ?? Date.now(),
    },
  ].slice(-400)
  localStorage.setItem(ATTEMPT_KEY, JSON.stringify(next))
}

export function unitsForCourse(course: Course): { names: string[]; sample: boolean } {
  if (course.units.length > 0) return { names: course.units, sample: false }
  const key = course.name.toLowerCase()
  const match = Object.entries(SAMPLE_UNITS).find(([name]) => key.includes(name))
  return { names: match?.[1] ?? ['Unit 1', 'Unit 2', 'Unit 3', 'Unit 4'], sample: true }
}

export function paletteFor(tone: string, count: number): CoursePalette {
  const [h, s] = hexToHsl(tone)
  const shifts = [0, 42, -38, 78, -72, 124]
  const units = Array.from({ length: Math.max(count, 1) }, (_, index) =>
    hsl(h + (shifts[index] ?? index * 36), clamp(s + 18, 62, 82), 62 + (index % 3) * 4),
  )
  return {
    tone,
    line: hsl(h, 78, 72),
    fill: hsla(h, 70, 58, 0.34),
    soft: hsla(h, 60, 48, 0.2),
    ink: hsl(h, 30, 88),
    units,
  }
}

export function buildCoursePulse(
  course: Course,
  deposits: NoteDeposit[],
  attempts: UnitAttempt[],
  topics: TopicStat[],
): CoursePulse {
  const { names } = unitsForCourse(course)
  const palette = paletteFor(course.tone ?? '#2a6ea8', names.length)
  const courseAttempts = attempts.filter((item) => sameName(item.course, course.name))
  const units = names.map((name, index) =>
    judgeUnit(name, course.name, deposits, courseAttempts, topics, index),
  )
  const anyLive = units.some((unit) => unit.live)
  const mastery = units.length
    ? Math.round(units.reduce((sum, unit) => sum + unit.mastery, 0) / units.length)
    : 0
  const live = anyLive
  const verdict = courseVerdict(units, mastery)
  const recommended =
    units.find((unit) => unit.verdict === 'slipping' || unit.verdict === 'stuck')?.name ??
    units.find((unit) => unit.verdict === 'warming' || unit.verdict === 'seeded')?.name ??
    units.slice().sort((a, b) => a.mastery - b.mastery)[0]?.name ??
    names[0] ??
    ''

  const labels = Array.from({ length: SERIES_LENGTH }, (_, index) => `S${index + 1}`)
  const series = units.map((unit, index) => ({
    name: unit.name,
    color: palette.units[index] ?? palette.line,
    values: seriesForUnit(unit, courseAttempts, index, !anyLive),
  }))
  const overall = labels.map((_, session) =>
    Math.round(series.reduce((sum, line) => sum + line.values[session], 0) / Math.max(series.length, 1)),
  )

  return {
    course,
    units,
    mastery,
    verdict,
    reason: VERDICT_COPY[verdict].hint,
    recommended,
    live,
    labels,
    overall,
    series,
    palette,
  }
}

function judgeUnit(
  name: string,
  courseName: string,
  deposits: NoteDeposit[],
  attempts: UnitAttempt[],
  topics: TopicStat[],
  salt: number,
): UnitJudgment {
  const notes = deposits.filter((item) => sameName(item.course, courseName) && sameName(item.unit, name)).length
  const mine = attempts.filter((item) => sameName(item.unit, name))
  const topic = topics.find((item) => sameName(item.topic, name))
  const loggedAttempts = mine.length
  const loggedCorrect = mine.filter((item) => item.correct).length
  const attemptsCount = loggedAttempts || topic?.attempts || 0
  const correctCount = loggedAttempts ? loggedCorrect : topic?.correct_answers || 0
  const live = attemptsCount > 0 || notes > 0
  const accuracy = attemptsCount ? Math.round((correctCount / attemptsCount) * 1000) / 10 : 0
  const mastery = live ? masteryScore(correctCount, attemptsCount, notes) : sampleMastery(courseName, name, salt)
  const { delta, verdict, reason } = decideVerdict(mine, attemptsCount, mastery, notes, live)
  const previewDelta = ((hash(`${courseName}:${name}:d`) % 21) - 6)

  return {
    name,
    notes,
    attempts: attemptsCount,
    correct: correctCount,
    accuracy,
    mastery,
    delta: live ? delta : previewDelta,
    verdict: live ? verdict : sampleVerdict(mastery, previewDelta),
    reason: live ? reason : 'Draft sample until this unit has quizzes.',
    live,
  }
}

function masteryScore(correct: number, attempts: number, notes: number) {
  const confidence = attempts / (attempts + 6)
  const accuracy = attempts ? correct / attempts : 0
  const prior = 0.38
  const notesNudge = Math.min(8, notes * 2)
  return clamp(Math.round((prior * (1 - confidence) + accuracy * confidence) * 100 + notesNudge), 0, 100)
}

function decideVerdict(
  attempts: UnitAttempt[],
  attemptCount: number,
  mastery: number,
  notes: number,
  live: boolean,
) {
  if (!live && attemptCount === 0 && notes === 0) {
    return { delta: 0, verdict: 'locked' as const, reason: VERDICT_COPY.locked.hint }
  }
  if (attemptCount === 0 && notes > 0) {
    return { delta: 0, verdict: 'seeded' as const, reason: VERDICT_COPY.seeded.hint }
  }
  if (attemptCount < 4) {
    return { delta: 0, verdict: 'warming' as const, reason: VERDICT_COPY.warming.hint }
  }

  const recent = attempts.slice(-RECENT_WINDOW)
  const earlier = attempts.slice(-RECENT_WINDOW * 2, -RECENT_WINDOW)
  const recentRate = rate(recent)
  const earlierRate = earlier.length >= 3 ? rate(earlier) : recentRate
  const delta = Math.round((recentRate - earlierRate) * 100)

  if (recentRate - earlierRate >= RISE_MARGIN) {
    return { delta, verdict: 'rising' as const, reason: VERDICT_COPY.rising.hint }
  }
  if (earlierRate - recentRate >= RISE_MARGIN) {
    return { delta, verdict: 'slipping' as const, reason: VERDICT_COPY.slipping.hint }
  }
  if (mastery >= 82) {
    return { delta, verdict: 'sharp' as const, reason: VERDICT_COPY.sharp.hint }
  }
  if (mastery < 45) {
    return { delta, verdict: 'stuck' as const, reason: VERDICT_COPY.stuck.hint }
  }
  return { delta, verdict: 'steady' as const, reason: VERDICT_COPY.steady.hint }
}

function courseVerdict(units: UnitJudgment[], mastery: number): UnitVerdict {
  if (units.some((unit) => unit.verdict === 'slipping')) return 'slipping'
  if (units.some((unit) => unit.verdict === 'rising')) return 'rising'
  if (units.every((unit) => unit.verdict === 'locked')) return 'locked'
  if (units.every((unit) => unit.verdict === 'seeded' || unit.verdict === 'locked')) return 'seeded'
  if (mastery >= 82 && units.every((unit) => unit.verdict === 'sharp' || unit.verdict === 'steady')) return 'sharp'
  if (units.some((unit) => unit.verdict === 'warming')) return 'warming'
  if (mastery < 45) return 'stuck'
  return 'steady'
}

function seriesForUnit(unit: UnitJudgment, attempts: UnitAttempt[], salt: number, draft: boolean) {
  const live = sessionMastery(attempts.filter((item) => sameName(item.unit, unit.name)), unit.notes)
  if (live.length >= 2) {
    return padSeries(live, unit.mastery)
  }
  if (unit.live || draft) {
    return previewSeries(Math.max(unit.mastery, 18), unit.name, salt)
  }
  return Array.from({ length: SERIES_LENGTH }, () => 0)
}

function sessionMastery(attempts: UnitAttempt[], notes: number) {
  const buckets: UnitAttempt[][] = []
  for (let i = 0; i < attempts.length; i += SESSION_SIZE) {
    buckets.push(attempts.slice(i, i + SESSION_SIZE))
  }
  let correct = 0
  let total = 0
  return buckets.map((bucket) => {
    correct += bucket.filter((item) => item.correct).length
    total += bucket.length
    return masteryScore(correct, total, notes)
  })
}

function padSeries(values: number[], current: number) {
  const trimmed = values.slice(-SERIES_LENGTH)
  const prefix = previewSeries(trimmed[0] ?? current, 'lead', 3).slice(0, SERIES_LENGTH - trimmed.length)
  const next = [...prefix, ...trimmed]
  next[next.length - 1] = current
  return next.slice(-SERIES_LENGTH)
}

function previewSeries(end: number, seed: string, salt: number) {
  const start = clamp(end - 32 - (hash(seed + String(salt)) % 14) - salt * 5, 10, 58)
  return Array.from({ length: SERIES_LENGTH }, (_, index) => {
    const t = index / (SERIES_LENGTH - 1)
    const wobble = Math.sin((index + 1) * 1.2 + salt) * 7 + Math.cos(index * 0.7 + salt * 0.6) * 3
    return clamp(Math.round(start + (end - start) * (0.12 + 0.88 * t * t) + wobble), 8, 100)
  })
}

function sampleMastery(course: string, unit: string, salt: number) {
  return 48 + (hash(`${course}:${unit}:${salt}`) % 38)
}

function sampleVerdict(mastery: number, delta: number): UnitVerdict {
  if (mastery >= 82) return 'sharp'
  if (delta >= 10 || mastery >= 70) return 'rising'
  if (mastery < 45) return 'stuck'
  return 'steady'
}

function rate(items: UnitAttempt[]) {
  if (items.length === 0) return 0
  return items.filter((item) => item.correct).length / items.length
}

function sameName(a: string, b: string) {
  return a.trim().toLowerCase() === b.trim().toLowerCase()
}

function hash(value: string) {
  let n = 0
  for (let i = 0; i < value.length; i += 1) n = (n * 33 + value.charCodeAt(i)) >>> 0
  return n
}

function hexToHsl(hex: string): [number, number, number] {
  const clean = hex.replace('#', '')
  const full = clean.length === 3 ? clean.split('').map((part) => part + part).join('') : clean
  const n = Number.parseInt(full, 16)
  const r = ((n >> 16) & 255) / 255
  const g = ((n >> 8) & 255) / 255
  const b = (n & 255) / 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 2
  const d = max - min
  if (d === 0) return [210, 40, Math.round(l * 100)]
  const s = d / (1 - Math.abs(2 * l - 1))
  let h = 0
  if (max === r) h = ((g - b) / d) % 6
  else if (max === g) h = (b - r) / d + 2
  else h = (r - g) / d + 4
  return [Math.round((h * 60 + 360) % 360), Math.round(s * 100), Math.round(l * 100)]
}

function hsl(h: number, s: number, l: number) {
  return `hsl(${((h % 360) + 360) % 360} ${s}% ${l}%)`
}

function hsla(h: number, s: number, l: number, a: number) {
  return `hsl(${((h % 360) + 360) % 360} ${s}% ${l}% / ${a})`
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

export function smoothPath(values: number[], width: number, height: number, padX: number, padY: number) {
  const innerW = width - padX * 2
  const innerH = height - padY * 2
  const points = values.map((value, index) => ({
    x: padX + (values.length === 1 ? innerW / 2 : (index / (values.length - 1)) * innerW),
    y: padY + (1 - value / 100) * innerH,
  }))
  if (points.length === 0) return ''
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`
  let d = `M ${points[0].x} ${points[0].y}`
  for (let i = 0; i < points.length - 1; i += 1) {
    const a = points[i]
    const b = points[i + 1]
    const dx = (b.x - a.x) / 2
    d += ` C ${a.x + dx} ${a.y}, ${b.x - dx} ${b.y}, ${b.x} ${b.y}`
  }
  return d
}

export function areaPath(values: number[], width: number, height: number, padX: number, padY: number) {
  const line = smoothPath(values, width, height, padX, padY)
  if (!line) return ''
  const lastX = padX + (width - padX * 2)
  const base = height - padY
  return `${line} L ${lastX} ${base} L ${padX} ${base} Z`
}
