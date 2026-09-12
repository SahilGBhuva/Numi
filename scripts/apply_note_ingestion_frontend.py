from pathlib import Path

path = Path('frontend/src/pages/Tools.tsx')
text = path.read_text()
text = text.replace(
    "import { analyzeAnswer, generateQuestion, type AnswerResult, type GeneratedQuestion, type Topic } from '../lib/api'",
    "import { analyzeAnswer, generateQuestion, ingestNote, type AnswerResult, type GeneratedQuestion, type Topic } from '../lib/api'",
)
text = text.replace(
    "files: unitNotes.map((note) => note.fileName),",
    "files: unitNotes.map((note) => `${note.id}::${note.fileName}`),",
)
old = '''  function sendUpload(event: FormEvent) {
    event.preventDefault()
    if (!file) return
    if (!activeUnit) {
      setNotice(`Create a unit in ${activeCourse} first, then send your notes there.`)
      return
    }
    const deposit: NoteDeposit = {
      id: crypto.randomUUID(),
      course: activeCourse,
      unit: activeUnit,
      fileName: file.name,
      createdAt: new Date().toISOString(),
    }
    setNotebook((current) => ({ ...current, deposits: [deposit, ...current.deposits] }))
    setFile(null)
    if (fileInput.current) fileInput.current.value = ''
    setNotice(`Saved “${deposit.fileName}” to ${activeCourse} → ${activeUnit}.`)
  }'''
new = '''  async function sendUpload(event: FormEvent) {
    event.preventDefault()
    if (!file) return
    if (!activeUnit) {
      setNotice(`Create a unit in ${activeCourse} first, then send your notes there.`)
      return
    }
    const selected = file
    setNotice(`Scanning “${selected.name}”…`)
    try {
      const uploaded = await ingestNote(selected, activeCourse, activeUnit, accessToken)
      const deposit: NoteDeposit = {
        id: uploaded.id,
        course: activeCourse,
        unit: activeUnit,
        fileName: uploaded.file_name,
        createdAt: new Date().toISOString(),
      }
      setNotebook((current) => ({ ...current, deposits: [deposit, ...current.deposits] }))
      setFile(null)
      if (fileInput.current) fileInput.current.value = ''
      setNotice(`Scanned “${deposit.fileName}” — quizzes now use these notes.`)
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Could not scan those notes.')
    }
  }'''
if old not in text:
    raise SystemExit('sendUpload block not found')
text = text.replace(old, new)
path.write_text(text)
