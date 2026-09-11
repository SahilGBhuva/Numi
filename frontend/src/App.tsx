import { useEffect, useState } from 'react'
import { SiteHeader } from './lib/SiteHeader'
import { Home } from './pages/Home'
import { Progress } from './pages/Progress'
import './pages/Home.css'
import './App.css'

function currentScreen() {
  return window.location.hash === '#progress' ? 'progress' : 'home'
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
    <main className="sheet">
      <span className="blob blob-a" aria-hidden="true" />
      <span className="blob blob-b" aria-hidden="true" />
      <SiteHeader
        active={screen}
        onError={setNotice}
        onSettings={() => setNotice('Settings is not connected yet.')}
      />
      {screen === 'progress' ? <Progress /> : <Home />}
      {notice ? (
        <p className="notice" role="status">
          {notice}
        </p>
      ) : null}
    </main>
  )
}

export default App
