import pytest
from fastapi import HTTPException

import auth


def test_public_settings_requires_configuration(monkeypatch):
    monkeypatch.delenv('SUPABASE_URL', raising=False)
    monkeypatch.delenv('SUPABASE_ANON_KEY', raising=False)
    with pytest.raises(HTTPException) as exc:
        auth.public_settings()
    assert exc.value.status_code == 503


def test_public_settings(monkeypatch):
    monkeypatch.setenv('SUPABASE_URL', 'https://example.supabase.co/')
    monkeypatch.setenv('SUPABASE_ANON_KEY', 'anon-key')
    assert auth.public_settings() == ('https://example.supabase.co', 'anon-key')
