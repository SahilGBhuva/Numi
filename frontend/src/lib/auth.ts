export type AuthUser = { id: string; email?: string }
export type AuthSession = {
  access_token: string
  refresh_token: string
  expires_at?: number
  user: AuthUser
}

type AuthConfig = { supabase_url: string; supabase_anon_key: string }

const SESSION_KEY = 'bindit-auth-session'
const LEGACY_SESSION_KEY = 'numi-auth-session'
let configPromise: Promise<AuthConfig> | null = null

function config() {
  configPromise ??= fetch('/api/auth/config').then(async (response) => {
    if (!response.ok) throw new Error('Accounts are not configured yet.')
    return response.json() as Promise<AuthConfig>
  })
  return configPromise
}

export function loadAuthSession(): AuthSession | null {
  const raw = localStorage.getItem(SESSION_KEY) ?? localStorage.getItem(LEGACY_SESSION_KEY)
  if (!raw) return null
  try {
    const session = JSON.parse(raw) as AuthSession
    localStorage.setItem(SESSION_KEY, raw)
    localStorage.removeItem(LEGACY_SESSION_KEY)
    return session
  } catch {
    localStorage.removeItem(SESSION_KEY)
    localStorage.removeItem(LEGACY_SESSION_KEY)
    return null
  }
}

export function saveAuthSession(session: AuthSession | null) {
  if (session) localStorage.setItem(SESSION_KEY, JSON.stringify(session))
  else {
    localStorage.removeItem(SESSION_KEY)
    localStorage.removeItem(LEGACY_SESSION_KEY)
  }
}

async function authRequest(path: string, body: Record<string, string>) {
  const settings = await config()
  const response = await fetch(`${settings.supabase_url}/auth/v1/${path}`, {
    method: 'POST',
    headers: { apikey: settings.supabase_anon_key, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const text = await response.text()
  const data = text
    ? (JSON.parse(text) as Record<string, unknown>)
    : {}
  if (!response.ok) {
    const message = [data.msg, data.error_description, data.message].find((value) => typeof value === 'string')
    throw new Error(message ?? 'Account request failed.')
  }
  return data as AuthSession & { user: AuthUser }
}

export async function refreshAuthSession(session: AuthSession): Promise<AuthSession | null> {
  if (session.expires_at && session.expires_at > Date.now() / 1000 + 60) return session
  try {
    const refreshed = await authRequest('token?grant_type=refresh_token', { refresh_token: session.refresh_token })
    saveAuthSession(refreshed)
    return refreshed
  } catch {
    saveAuthSession(null)
    return null
  }
}

export async function signUp(email: string, password: string) {
  return authRequest('signup', { email, password })
}

export async function signIn(email: string, password: string) {
  return authRequest('token?grant_type=password', { email, password })
}

export async function requestPasswordReset(email: string) {
  await authRequest('recover', { email })
}

export function signOut() {
  saveAuthSession(null)
}
