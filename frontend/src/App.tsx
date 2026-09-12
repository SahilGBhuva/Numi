import { useEffect, useState } from 'react'
import { SiteHeader } from './lib/SiteHeader'
import { SCREENS, SiteSidebar, type Screen } from './lib/SiteSidebar'
import { Home } from './pages/Home'
import { Progress } from './pages/Progress'
import { Games } from './pages/Games'
import { Quests } from './pages/Quests'
import { Profile } from './pages/Profile'
import { Settings } from './pages/Settings'
import { More } from './pages/More'
import './pages/Home.css'
import './App.css'

function currentScreen(): Screen {
  const hash = window.location.hash.replace('#', '') as Screen
  return SCREENS.includes(hash) ? hash : 'home'
}

function App() {
  const [screen, setScreen] = useState(currentScreen)
  const [notice, setNotice] = useState('')

  useEffect(() => {
    const sync = () => setScreen(currentScreen())
    window.addEventListener('hashchange', sync)
    return () => window.removeEventListener('hashchange', sync)
  }, [])

  return (
    <div className="app-shell">
      <SiteSidebar active={screen} />
      <main className="sheet">
        <span className="blob blob-a" aria-hidden="true" />
        <span className="blob blob-b" aria-hidden="true" />
        <SiteHeader />
        {screen === 'home' ? <Home /> : null}
        {screen === 'progress' ? <Progress /> : null}
        {screen === 'games' ? <Games /> : null}
        {screen === 'quests' ? <Quests /> : null}
        {screen === 'profile' ? <Profile onError={setNotice} /> : null}
        {screen === 'settings' ? <Settings /> : null}
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
