import { useState } from 'react'
import './SiteSidebar.css'

const RAIL_KEY = 'bindet-rail-shut'

export const SCREENS = ['home', 'tools', 'progress', 'games', 'goals', 'profile', 'settings', 'more'] as const
export type Screen = (typeof SCREENS)[number]

type NavItem = { id: Screen; label: string }

const STUDY_ITEMS: NavItem[] = [
  { id: 'home', label: 'Home' },
  { id: 'tools', label: 'Workspace' },
  { id: 'progress', label: 'Progress' },
  { id: 'games', label: 'Games' },
  { id: 'goals', label: 'Goals' },
]

const ACCOUNT_ITEMS: NavItem[] = [
  { id: 'profile', label: 'Profile' },
  { id: 'settings', label: 'Settings' },
  { id: 'more', label: 'More' },
]

function Mark({ kind }: { kind: Screen }) {
  const common = {
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.75,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  }

  if (kind === 'home') {
    return <svg viewBox="0 0 24 24" aria-hidden="true"><path {...common} d="M4.5 10.4 12 4l7.5 6.4v9.1H4.5z" /><path {...common} d="M9.4 19.5v-5.4h5.2v5.4" /></svg>
  }
  if (kind === 'tools') {
    return <svg viewBox="0 0 24 24" aria-hidden="true"><path {...common} d="M5 4.5h5.5v15H5zM13.5 4.5H19v6h-5.5zM13.5 13.5H19v6h-5.5z" /></svg>
  }
  if (kind === 'progress') {
    return <svg viewBox="0 0 24 24" aria-hidden="true"><path {...common} d="M4 19V11m5.3 8V6m5.4 13V9.5M20 19V4" /></svg>
  }
  if (kind === 'games') {
    return <svg viewBox="0 0 24 24" aria-hidden="true"><path {...common} d="M7.4 8.2h9.2a4.4 4.4 0 0 1 4.1 6l-1 2.5a2.4 2.4 0 0 1-4 1l-1.3-1.3H9.6l-1.3 1.3a2.4 2.4 0 0 1-4-1l-1-2.5a4.4 4.4 0 0 1 4.1-6Z" /><path {...common} d="M7.2 12.5h4M9.2 10.5v4M16.3 12h.01M18.4 14h.01" /></svg>
  }
  if (kind === 'goals') {
    return <svg viewBox="0 0 24 24" aria-hidden="true"><circle {...common} cx="12" cy="12" r="7.5" /><circle {...common} cx="12" cy="12" r="3.2" /><path {...common} d="M12 4V2.8M20 12h1.2" /></svg>
  }
  if (kind === 'profile') {
    return <svg viewBox="0 0 24 24" aria-hidden="true"><circle {...common} cx="12" cy="8" r="3.4" /><path {...common} d="M5.4 19.6c.7-3.8 3-5.8 6.6-5.8s5.9 2 6.6 5.8" /></svg>
  }
  if (kind === 'settings') {
    return <svg viewBox="0 0 24 24" aria-hidden="true"><circle {...common} cx="12" cy="12" r="3" /><path {...common} d="M12 3.5v2M12 18.5v2M3.5 12h2M18.5 12h2M6 6l1.4 1.4M16.6 16.6 18 18M18 6l-1.4 1.4M7.4 16.6 6 18" /></svg>
  }
  return <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="5" cy="12" r="1.25" fill="currentColor" /><circle cx="12" cy="12" r="1.25" fill="currentColor" /><circle cx="19" cy="12" r="1.25" fill="currentColor" /></svg>
}

function NavGroup({ label, items, active }: { label: string; items: NavItem[]; active: Screen }) {
  return (
    <section className="numi-rail__section" aria-label={label}>
      <span className="numi-rail__section-label">{label}</span>
      <ol className="numi-rail__list">
        {items.map((item) => (
          <li key={item.id}>
            <a
              className={`numi-rail__item is-${item.id} ${active === item.id ? 'is-active' : ''}`}
              href={`#${item.id}`}
              aria-current={active === item.id ? 'page' : undefined}
              title={item.label}
            >
              <span className="numi-rail__icon"><Mark kind={item.id} /></span>
              <span className="numi-rail__label">{item.label}</span>
              {active === item.id ? <span className="numi-rail__active-dot" aria-hidden="true" /> : null}
            </a>
          </li>
        ))}
      </ol>
    </section>
  )
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
          <span className="numi-rail__brand-mark" aria-hidden="true">
            <span />
            <span />
          </span>
          <span className="numi-rail__word">bindit</span>
        </a>
        <button
          className="numi-rail__collapse"
          type="button"
          aria-expanded={!shut}
          aria-label={shut ? 'Expand sidebar' : 'Collapse sidebar'}
          title={shut ? 'Expand sidebar' : 'Collapse sidebar'}
          onClick={toggleRail}
        >
          <svg viewBox="0 0 20 20" aria-hidden="true">
            <path d={shut ? 'm7 5 5 5-5 5' : 'm13 5-5 5 5 5'} />
          </svg>
        </button>
      </div>

      <div className="numi-rail__nav" id="bindet-rail-list">
        <NavGroup label="Study" items={STUDY_ITEMS} active={active} />
        <NavGroup label="Account" items={ACCOUNT_ITEMS} active={active} />
      </div>

      <div className="numi-rail__footer">
        <div className="numi-rail__sync-icon"><img src="/bindit-mascot.webp" alt="" /></div>
        <div className="numi-rail__footer-copy">
          <strong>bindit workspace</strong>
          <span><i /> Ready to study</span>
        </div>
      </div>
    </nav>
  )
}
