import note_ingestion


def test_plain_text_extraction():
    text = note_ingestion.extract_text('biology.txt', b'Cell theory\nAll cells come from existing cells.')
    assert 'Cell theory' in text
    assert 'existing cells' in text


def test_rejects_unsupported_file():
    try:
        note_ingestion.extract_text('notes.exe', b'nope')
    except note_ingestion.NoteIngestionError as exc:
        assert 'PDF' in str(exc)
    else:
        raise AssertionError('unsupported file should be rejected')


def test_rejects_oversized_file():
    try:
        note_ingestion.extract_text('notes.txt', b'x' * (note_ingestion.MAX_NOTE_BYTES + 1))
    except note_ingestion.NoteIngestionError as exc:
        assert '10 MB' in str(exc)
    else:
        raise AssertionError('oversized file should be rejected')
