from __future__ import annotations

from io import BytesIO
from pathlib import Path

MAX_NOTE_BYTES = 10 * 1024 * 1024
MAX_STORED_CHARS = 120_000
TEXT_EXTENSIONS = {'.txt', '.md', '.csv', '.json'}
IMAGE_EXTENSIONS = {'.png', '.jpg', '.jpeg', '.webp'}
SUPPORTED_EXTENSIONS = TEXT_EXTENSIONS | IMAGE_EXTENSIONS | {'.pdf', '.docx'}


class NoteIngestionError(ValueError):
    pass


def clean_text(value: str) -> str:
    lines = [' '.join(line.split()) for line in value.replace('\x00', ' ').splitlines()]
    return '\n'.join(line for line in lines if line).strip()[:MAX_STORED_CHARS]


def extract_text(filename: str, content: bytes) -> str:
    if not content:
        raise NoteIngestionError('The uploaded file is empty')
    if len(content) > MAX_NOTE_BYTES:
        raise NoteIngestionError('Notes must be 10 MB or smaller')
    suffix = Path(filename).suffix.lower()
    if suffix not in SUPPORTED_EXTENSIONS:
        raise NoteIngestionError('Use a PDF, DOCX, TXT, MD, CSV, JSON, PNG, JPG, JPEG, or WEBP file')
    try:
        if suffix in TEXT_EXTENSIONS:
            text = content.decode('utf-8-sig', errors='replace')
        elif suffix == '.pdf':
            # Keep heavy parsing libraries out of the normal backend cold-start path.
            from pypdf import PdfReader

            text = '\n'.join(page.extract_text() or '' for page in PdfReader(BytesIO(content)).pages)
        elif suffix == '.docx':
            from docx import Document

            document = Document(BytesIO(content))
            text = '\n'.join(paragraph.text for paragraph in document.paragraphs)
        else:
            raise NoteIngestionError('image_requires_vision')
    except NoteIngestionError:
        raise
    except Exception as exc:
        raise NoteIngestionError('Could not read that file. Try exporting it again.') from exc
    text = clean_text(text)
    if not text:
        raise NoteIngestionError('No readable text was found in that file')
    return text
