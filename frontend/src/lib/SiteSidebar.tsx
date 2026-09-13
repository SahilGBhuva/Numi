import { useState } from 'react'
import './SiteSidebar.css'

const RAIL_KEY = 'bindet-rail-shut'

export const SCREENS = ['home', 'tools', 'progress', 'games', 'goals', 'profile', 'settings', 'more'] as const
export type Screen = (typeof SCREENS)[number]

const ITEMS: { id: Screen; label: string; hint: string }[] = [
  { id: 'home', label: 'Home', hint: 'Overview' },
  { id: 'tools', label: 'Workspace', hint: 'Notes + practice' },
  { id: 'progress', label: 'Progress', hint: 'Momentum' },
  { id: 'games', label: 'Games', hint: 'Quick reps' },
  { id: 'goals', label: 'Quests', hint: 'Next wins' },
  { id: 'profile', label: 'Profile', hint: 'Friends' },
  { id: 'settings', label: 'Settings', hint: 'Preferences' },
  { id: 'more', label: 'More', hint: 'Everything else' },
]

function Mark({ kind }: { kind: Screen }) {
  const common = {
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  }

  if (kind === 'home') {
    return <svg viewBox="0 0 24 24" aria-hidden="true"><path {...common} d="M4.5 10.5 12 4l7.5 6.5V20H4.5z" /><path {...common} d="M9.5 20v-5.5h5V20" /></svg>
  }
  if (kind === 'tools') {
    return <svg viewBox="0 0 24 24" aria-hidden="true"><path {...common} d="M4 6.5h16M6.5 4v5M17.5 4v5M5 11.5h14v8H5z" /><path {...common} d="M8 15h4M8 17.5h7" /></svg>
  }
  if (kind === 'progress') {
    return <svg viewBox="0 0 24 24" aria-hidden="true"><path {...common} d="M4 19V9m6 10V5m6 14v-7m4 7H2.5" /></svg>
  }
  if (kind === 'games') {
    return <svg viewBox="0 0 24 24" aria-hidden="true"><path {...common} d="M7.5 8h9a4.5 4.5 0 0 1 4.2 6.1l-1 2.6a2.5 2.5 0 0 1-4.1 1l-1.2-1.2H9.6l-1.2 1.2a2.5 2.5 0 0 1-4.1-1l-1-2.6A4.5 4.5 0 0 1 7.5 8Z" /><path {...common} d="M7 12.5h4M9 10.5v4M16.5 12h.01M18.5 14h.01" /></svg>
  }
  if (kind === 'goals') {
    return <svg viewBox="0 0 24 24" aria-hidden="true"><path {...common} d="M5 4.5h14v15H5z" /><path {...common} d="m8 10 2 2 5-5M8 16h8" /></svg>
  }
  if (kind === 'profile') {
    return <svg viewBox="0 0 24 24" aria-hidden="true"><circle {...common} cx="12" cy="8" r="3.5" /><path {...common} d="M5.5 20c.7-4 3-6 6.5-6s5.8 2 6.5 6" /></svg>
  }
  if (kind === 'settings') {
    return <svg viewBox="0 0 24 24" aria-hidden="true"><path {...common} d="M5 7h14M5 17h14M8.5 4v6M15.5 14v6" /></svg>
  }
  return <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="5" cy="12" r="1.2" fill="currentColor" /><circle cx="12" cy="12" r="1.2" fill="currentColor" /><circle cx="19" cy="12" r="1.2" fill="currentColor" /></svg>
}

type SiteSidebarProps = {
  active: Screen
}

export function SiteSidebar({ active }: SiteSidebarProps) {
  const [shut, setShut] = useState(() => localStorage.getItem(RAIL_KEY) === '1')

  function toggleRail() {
    setShut((current) => {
      const next = !current
      localStorage.setItem(RAIL_KEY, next ? '1' : '0')
      return next
    })
  }

  return (
    <nav className={`numi-rail ${shut ? 'is-shut' : ''}`} aria-label="Main navigation">
      <div className="numi-rail__top">
        <a className="numi-rail__brand" href="#home" aria-label="bindit home">
          <span className="numi-rail__brand-mark">
            <img className="numi-rail__mark" src="/bindit-mascot.webp" alt="" />
          </span>
          <span className="numi-rail__word">bindit</span>
        </a>
        <button
          className="numi-rail__collapse"
          type="button"
          aria-expanded={!shut}
          aria-controls="bindet-rail-list"
          aria-label={shut ? 'Expand sidebar' : 'Collapse sidebar'}
          title={shut ? 'Expand sidebar' : 'Collapse sidebar'}
          onClick={toggleRail}
        >
          <svg viewBox="0 0 20 20" aria-hidden="true">
            <path d={shut ? 'm7 5 5 5-5 5' : 'm13 5-5 5 5 5'} />
          </svg>
        </button>
      </div>

      <ol className="numi-rail__list" id="bindet-rail-list">
        {ITEMS.map((item) => (
          <li key={item.id}>
            <a
              className={`numi-rail__item is-${item.id} ${active === item.id ? 'is-active' : ''}`}
              href={`#${item.id}`}
              aria-current={active === item.id ? 'page' : undefined}
              title={shut ? item.label : undefined}
            >
              <span className="numi-rail__icon"><Mark kind={item.id} /></span>
              <span className="numi-rail__copy">
                <span className="numi-rail__label">{item.label}</span>
                <span className="numi-rail__hint">{item.hint}</span>
              </span>
            </a>
          </li>
        ))}
      </ol>

      <div className="numi-rail__footer">
        <span className="numi-rail__footer-dot" />
        <span>Study system online</span>
      </div>
    </nav>
  )
}
