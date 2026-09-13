import { useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import type { NoteDeposit } from '../lib/types'
import './NoteLectern.css'

type LectureBeat = {
  title: string
  body: string
}

type Lecture = {
  asked: string
  heading: string
  kicker: string
  sources: NoteDeposit[]
  beats: LectureBeat[]
}

const FILLER = new Set([
  'about',
  'and',
  'can',
  'define',
  'describe',
  'explain',
  'for',
  'from',
  'give',
  'help',
  'how',
  'like',
  'please',
  'tell',
  'the',
  'this',
  'what',
  'why',
  'with',
  'you',
])

function wordsIn(prompt: string) {
  return prompt
    .toLowerCase()
    .split(/[^a-z0-9]+/i)
    .filter((word) => word.length > 2)
}

function topicLabel(prompt: string) {
  const topics = wordsIn(prompt).filter((word) => !FILLER.has(word))
  if (topics.length === 0) return prompt.replace(/\s+/g, ' ').trim() || 'this topic'
  return topics.join(' ')
}

function scoreNote(note: NoteDeposit, words: string[], course: string, unit: string) {
  const hay = `${note.fileName} ${note.course} ${note.unit}`.toLowerCase()
  const hits = words.filter((word) => hay.includes(word)).length
  return hits * 4 + (note.course === course ? 2 : 0) + (note.unit === unit ? 1 : 0)
}

function titleFrom(prompt: string, course: string) {
  const clean = prompt.replace(/\s+/g, ' ').trim()
  if (!clean) return course ? `A lecture from ${course}` : 'A lecture from your notes'
  return clean.length > 72 ? `${clean.slice(0, 69)}…` : clean
}

function fileList(notes: NoteDeposit[]) {
  return notes.map((note) => note.fileName).join(', ')
}

function outlineBeats(
  asked: string,
  course: string,
  unit: string,
  matchedNotes: NoteDeposit[],
  nearbyNotes: NoteDeposit[],
): LectureBeat[] {
  const topic = topicLabel(asked)
  const place = course ? `${course}${unit ? ` → ${unit}` : ''}` : 'your binder'
  const notesBody =
    matchedNotes.length > 0
      ? `Open ${fileList(matchedNotes)} in ${place}. Those names lined up with this prompt. Skim them for ${topic}.`
      : nearbyNotes.length > 0
        ? `No saved file is named for “${topic}” yet. Optional places to look in ${place}: ${fileList(nearbyNotes)}. Rename a file or add notes that use these words.`
        : `Nothing is on the shelf in ${place}. Upload notes, then pull this lecture again.`

  return [
    {
      title: 'Goal',
      body: `Be able to answer: “${asked}.” Work the next periods in order. You do not need AI for this pass — just the question and your notes.`,
    },
    {
      title: 'Break it down',
      body: [
        `What is ${topic}?`,
        `What are the parts or steps of ${topic}?`,
        `How would you draw, compute, or describe ${topic} without looking?`,
      ].join(' '),
    },
    {
      title: 'Use your notes',
      body: notesBody,
    },
    {
      title: 'Check yourself',
      body: [
        `Define ${topic} in one sentence without looking.`,
        `Give one example of ${topic}.`,
        'What would you still need from your notes to be sure?',
      ].join(' '),
    },
  ]
}

function buildLecture(prompt: string, deposits: NoteDeposit[], course: string, unit: string): Lecture {
  const asked = prompt.trim()
  const words = wordsIn(asked)
  const ranked = [...deposits]
    .map((note) => ({ note, score: scoreNote(note, words, course, unit) }))
    .sort((a, b) => b.score - a.score || a.note.fileName.localeCompare(b.note.fileName))

  const matched = words.length > 0 ? ranked.filter((item) => item.score >= 4).map((item) => item.note) : []
  const nearby = ranked
    .filter((item) => item.note.course === course || !course)
    .slice(0, 4)
    .map((item) => item.note)
  const sources = (matched.length > 0 ? matched : nearby).slice(0, 4)

  if (deposits.length === 0) {
    const topic = topicLabel(asked)
    return {
      asked,
      heading: titleFrom(asked, course),
      kicker: 'No notes saved yet',
      sources: [],
      beats: [
        {
          title: 'Goal',
          body: `Be able to answer: “${asked || topic}.”`,
        },
        {
          title: 'Add notes',
          body: course
            ? `Upload notes into ${course}${unit ? ` → ${unit}` : ''} first. Search uses file names, courses, and units until AI can read the pages.`
            : 'Add a course, drop some notes in, then pull this lecture again.',
        },
      ],
    }
  }

  return {
    asked,
    heading: titleFrom(asked, course),
    kicker:
      matched.length > 0
        ? `Matched ${sources.length} note${sources.length === 1 ? '' : 's'}`
        : 'No filename match',
    sources,
    beats: outlineBeats(asked, course, unit, matched, nearby),
  }
}

export function NoteLectern({
  course,
  unit,
  deposits,
  tone,
}: {
  course: string
  unit: string
  deposits: NoteDeposit[]
  tone: string
}) {
  const [prompt, setPrompt] = useState('')
  const [asked, setAsked] = useState('')
  const [folio, setFolio] = useState(0)
  const [period, setPeriod] = useState(0)
  const courseNotes = useMemo(
    () => deposits.filter((note) => !course || note.course === course),
    [course, deposits],
  )

  const lecture = asked ? buildLecture(asked, deposits, course, unit) : null
  const sources = lecture?.sources ?? []

  function deliver(event: FormEvent) {
    event.preventDefault()
    const next = prompt.trim()
    if (!next) return
    setAsked(next)
    setPeriod(0)
    setFolio((count) => count + 1)
  }

  return (
    <section
      className="lectern workbook is-fn-scan"
      style={{ ['--course-tone' as string]: tone }}
      aria-label="AI summarizer"
    >
      <div className="unit-tabs" role="tablist" aria-label="Summarizer">
        <div className="unit-tab is-active" role="tab" aria-selected="true">
          Summarizer
        </div>
      </div>

      <div className="panel">
        <section className="panel-page panel-page--scan lectern__page">
          <form className="scan" onSubmit={deliver}>
            <div className="scan__stage">
              <span className="scan__label">Ask / lecture</span>
              <span className="tab" aria-hidden="true" />
              <div className={`frame lectern__frame ${lecture ? 'is-open' : 'is-shut'}`}>
                <div className="lectern__rings" aria-hidden="true">
                  <i />
                  <i />
                  <i />
                  <i />
                </div>
                <p className="lectern__now">{lecture ? 'Now lecturing' : 'Function 4'}</p>
                <h2>{lecture ? lecture.heading : 'Pull a lecture from the binder'}</h2>
                <label className="lectern__prompt-label" htmlFor="lectern-prompt">
                  Prompt
                </label>
                <textarea
                  id="lectern-prompt"
                  value={prompt}
                  onChange={(event) => setPrompt(event.target.value)}
                  placeholder={
                    course
                      ? `Explain ${unit || course} like a class period…`
                      : 'What should the lecture cover?'
                  }
                  rows={3}
                />
                {lecture ? (
                  <div className="lectern__folio" key={folio}>
                    <ol className="lectern__periods" aria-label="Lecture periods">
                      {lecture.beats.map((beat, index) => (
                        <li key={beat.title} className={index === period ? 'is-on' : ''}>
                          <button
                            type="button"
                            style={{ backgroundColor: tone }}
                            aria-label={`Period ${index + 1}: ${beat.title}`}
                            aria-current={index === period ? 'true' : undefined}
                            onClick={() => setPeriod(index)}
                          />
                        </li>
                      ))}
                    </ol>
                    <ol className="lectern__beats">
                      {lecture.beats.map((beat, index) => (
                        <li
                          key={beat.title}
                          className={index === period ? 'is-on' : ''}
                          style={{ ['--page-delay' as string]: `${index * 70}ms` }}
                          onClick={() => setPeriod(index)}
                        >
                          <span className="lectern__page-tab">{index + 1}</span>
                          <small>Period {index + 1}</small>
                          <h3>{beat.title}</h3>
                          <p>{beat.body}</p>
                        </li>
                      ))}
                    </ol>
                  </div>
                ) : (
                  <div className="lectern__idle">
                    <div className="lectern__shut" aria-hidden="true">
                      <i />
                      <i />
                      <i />
                      <b />
                    </div>
                    <p>
                      The folio is shut. Ask something and Bindet will pull pages from{' '}
                      {course ? `${course}${unit ? ` → ${unit}` : ''}` : 'your notes'} and fan them
                      out like a class period. The voice is a stand-in until AI is on.
                    </p>
                  </div>
                )}
              </div>
            </div>
            <button className="send" type="submit" disabled={!prompt.trim()}>
              Pull lecture
            </button>
          </form>

          <aside className="requests">
            <h2>{lecture ? lecture.kicker : 'Pulled tabs'}</h2>
            {sources.length > 0 ? (
              <ul className="lectern__pulls">
                {sources.map((note) => (
                  <li key={note.id}>
                    <span className="lectern__pull-tab" aria-hidden="true" />
                    <strong>{note.fileName}</strong>
                    <small>
                      {note.course}
                      {note.unit ? ` · ${note.unit}` : ''}
                    </small>
                  </li>
                ))}
              </ul>
            ) : (
              <>
                <p>
                  {courseNotes.length > 0
                    ? `${courseNotes.length} note${courseNotes.length === 1 ? '' : 's'} waiting in ${course}.`
                    : deposits.length > 0
                      ? `${deposits.length} note${deposits.length === 1 ? '' : 's'} in the binder.`
                      : 'Pages the lecture pulls will land here as tabs.'}
                </p>
                <span className="requests__papers" aria-hidden="true">
                  <i />
                  <i />
                  <i />
                </span>
              </>
            )}
          </aside>
        </section>
      </div>
    </section>
  )
}
