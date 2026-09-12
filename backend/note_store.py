from __future__ import annotations

import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, DateTime, Integer, MetaData, String, Table, Text, delete, select
import database

note_metadata = MetaData()
notes = Table('study_notes', note_metadata,
    Column('id', String(36), primary_key=True), Column('student_id', String(100), nullable=False, index=True),
    Column('course', String(120), nullable=False, index=True), Column('unit', String(160), nullable=False, index=True),
    Column('file_name', String(255), nullable=False), Column('content_type', String(100), nullable=False, default=''),
    Column('text', Text, nullable=False), Column('size_bytes', Integer, nullable=False), Column('created_at', DateTime(timezone=True), nullable=False))

def init_notes() -> None:
    database.init_db(); note_metadata.create_all(database.engine())

def save_note(student_id: str, course: str, unit: str, file_name: str, content_type: str, text: str, size_bytes: int) -> dict:
    init_notes(); row={'id':str(uuid.uuid4()),'student_id':student_id,'course':course,'unit':unit,'file_name':file_name,'content_type':content_type,'text':text,'size_bytes':size_bytes,'created_at':datetime.now(timezone.utc)}
    with database.engine().begin() as connection: connection.execute(notes.insert().values(**row))
    return row

def context_by_ids(note_ids: list[str], limit_chars: int = 18000) -> tuple[list[str], str]:
    if not note_ids: return [], ''
    init_notes()
    with database.engine().begin() as connection: rows=connection.execute(select(notes).where(notes.c.id.in_(note_ids[:20]))).mappings().all()
    by_id={row['id']:row for row in rows}; labels=[]; chunks=[]; used=0
    for note_id in note_ids:
        row=by_id.get(note_id)
        if not row: continue
        labels.append(row['file_name']); remaining=limit_chars-used
        if remaining <= 0: break
        excerpt=row['text'][:remaining]; chunks.append(f"SOURCE: {row['file_name']}\n{excerpt}"); used += len(excerpt)
    return labels, '\n\n'.join(chunks)

def remove_note(student_id: str, note_id: str) -> bool:
    init_notes()
    with database.engine().begin() as connection: result=connection.execute(delete(notes).where(notes.c.id==note_id, notes.c.student_id==student_id))
    return bool(result.rowcount)
