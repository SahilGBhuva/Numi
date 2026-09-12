from __future__ import annotations

from typing import Annotated
from fastapi import File, Form, Header, HTTPException, UploadFile

import ai_tutor
import auth
import note_ingestion
import note_store
from main import app

@app.post('/api/notes/ingest')
async def ingest_note(
    file: Annotated[UploadFile, File(...)],
    course: Annotated[str, Form(...)],
    unit: Annotated[str, Form(...)],
    student_id: Annotated[str, Form(...)],
    authorization: Annotated[str | None, Header()] = None,
):
    owner_id = auth.authenticated_user(authorization)['id'] if authorization else student_id
    course = course.strip(); unit = unit.strip(); filename = (file.filename or 'notes').strip()
    if not course or not unit:
        raise HTTPException(status_code=400, detail='Choose a course and unit first')
    content = await file.read(note_ingestion.MAX_NOTE_BYTES + 1)
    if len(content) > note_ingestion.MAX_NOTE_BYTES:
        raise HTTPException(status_code=413, detail='Notes must be 10 MB or smaller')
    content_type = file.content_type or 'application/octet-stream'
    suffix = __import__('pathlib').Path(filename).suffix.lower()
    try:
        if suffix in note_ingestion.IMAGE_EXTENSIONS:
            if content_type not in {'image/png','image/jpeg','image/webp'}:
                content_type = {'png':'image/png','jpg':'image/jpeg','jpeg':'image/jpeg','webp':'image/webp'}.get(suffix.lstrip('.'),'image/jpeg')
            text = ai_tutor.extract_image_notes(image_bytes=content, content_type=content_type)
        else:
            text = note_ingestion.extract_text(filename, content)
    except note_ingestion.NoteIngestionError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except ai_tutor.AITutorError as exc:
        raise HTTPException(status_code=503, detail='Could not scan that image right now. Try again in a moment.') from exc
    row = note_store.save_note(owner_id, course, unit, filename, content_type, text, len(content))
    return {'id': row['id'], 'file_name': filename, 'course': course, 'unit': unit, 'characters': len(text), 'status': 'ready'}

@app.delete('/api/notes/{note_id}')
def delete_note(note_id: str, student_id: str, authorization: Annotated[str | None, Header()] = None):
    owner_id = auth.authenticated_user(authorization)['id'] if authorization else student_id
    if not note_store.remove_note(owner_id, note_id):
        raise HTTPException(status_code=404, detail='Note not found')
    return {'deleted': True}
