from __future__ import annotations

import os
import httpx
from fastapi import HTTPException


def public_settings() -> tuple[str, str]:
    url = os.getenv('SUPABASE_URL', '').rstrip('/')
    anon_key = os.getenv('SUPABASE_ANON_KEY', '')
    if not url or not anon_key:
        raise HTTPException(status_code=503, detail='Accounts are not configured yet')
    return url, anon_key


def authenticated_user(authorization: str | None) -> dict:
    if not authorization or not authorization.lower().startswith('bearer '):
        raise HTTPException(status_code=401, detail='Sign in required')
    url, anon_key = public_settings()
    try:
        response = httpx.get(f'{url}/auth/v1/user', headers={'apikey': anon_key, 'Authorization': authorization}, timeout=10)
    except httpx.RequestError as error:
        raise HTTPException(status_code=503, detail='Could not verify account') from error
    if response.status_code != 200:
        raise HTTPException(status_code=401, detail='Your sign-in has expired')
    user = response.json()
    if not user.get('id'):
        raise HTTPException(status_code=401, detail='Invalid account')
    return user
