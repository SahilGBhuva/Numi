import { useEffect, useState } from 'react'
import { SCREENS, SiteSidebar, type Screen } from './lib/SiteSidebar'
import { recordDailyLogin } from './lib/api'
import { loadAuthSession, refreshAuthSession, type AuthSession } from './lib/auth'
import { getStudentId } from './lib/session'
import { Home } from './pages/Home'
import { Progress } from './pages/Progress'
import { Games } from './pages/Games'
import { Goals } from './pages/Goals'
import { Profile } from './pages/Profile'
import { Settings } from './pages/Settings'
import { More } from './pages/More'
import { Tools } from './pages/Tools'
import './pages/Home.css'
import './App.css'

function currentScreen(): Screen {
  const raw = window.location.hash.replace('#', '')
  const hash = (raw === 'quests' ? 'goals' : raw) as Screen
  return SCREENS.includes(hash) ? hash : 'home'
}

function App() {
  const [screen, setScreen] = useState(currentScreen)
  const [notice, setNotice] = useState('')
  const [session, setSession] = useState<AuthSession | null>(() => loadAuthSession())

  useEffect(() => {
    const sync = () => setScreen(currentScreen())
    window.addEventListener('hashchange', sync)
    return () => window.removeEventListener('hashchange', sync)
  }, [])

  useEffect(() => {
    const current = loadAuthSession()
    if (!current) return
    void refreshAuthSession(current).then(setSession)
  }, [])

  useEffect(() => {
    const studentId = session?.user.id ?? getStudentId()
    void recordDailyLogin(studentId, session?.access_token).catch(() => undefined)
  }, [session?.user.id, session?.access_token])

  return (
    <div className="app-shell">
      <SiteSidebar active={screen} />
      <main className={`sheet is-${screen}`}>
        <span className="blob blob-a" aria-hidden="true" />
        <span className="blob blob-b" aria-hidden="true" />
        <div className="binder-sparks" aria-hidden="true">
          <span className="binder-sparks__paper" />
          <span className="binder-sparks__tab" />
          <span className="binder-sparks__ring" />
        </div>
        {screen === 'home' ? <Home /> : null}
        {screen === 'tools' ? <Tools accessToken={session?.access_token} /> : null}
        {screen === 'progress' ? <Progress session={session} /> : null}
        {screen === 'games' ? <Games /> : null}
        {screen === 'goals' ? <Goals /> : null}
        {screen === 'profile' ? <Profile session={session} onError={setNotice} /> : null}
        {screen === 'settings' ? <Settings session={session} onSession={setSession} /> : null}
        {screen === 'more' ? <More /> : null}
        {notice ? (
          <p className="notice" role="status">
            {notice}
          </p>
        ) : null}
      </main>
    </div>
  )
}

export default App
