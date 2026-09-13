import { WrenchMark } from './WrenchMark'
import './SiteSidebar.css'

export const SCREENS = ['home', 'tools', 'progress', 'games', 'goals', 'profile', 'settings', 'more'] as const
export type Screen = (typeof SCREENS)[number]

const ITEMS: { id: Screen; label: string }[] = [
  { id: 'home', label: 'Home' },
  { id: 'tools', label: 'Tools' },
  { id: 'progress', label: 'Progress' },
  { id: 'games', label: 'Games' },
  { id: 'goals', label: 'Goals' },
  { id: 'profile', label: 'Profile' },
  { id: 'settings', label: 'Settings' },
  { id: 'more', label: 'More' },
]

function Mark({ kind }: { kind: Screen }) {
  if (kind === 'home') return <svg viewBox="0 0 32 32" aria-hidden="true"><path fill="#e0a045" d="M5 15.2 16 5.4 27 15.2V27a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2z" /><path fill="#c45c3c" d="M13.2 18.4h5.6V29h-5.6z" /><circle fill="#f3d48a" cx="16" cy="12.2" r="1.6" /></svg>
  if (kind === 'tools') return <WrenchMark variant="sidebar" className="wrench-mark wrench-mark--sidebar" />
  if (kind === 'progress') return <svg viewBox="0 0 32 32" aria-hidden="true"><rect fill="#4d7ea8" x="5" y="16" width="6" height="11" rx="1.4" /><rect fill="#6f9a7a" x="13" y="8" width="6" height="19" rx="1.4" /><rect fill="#e0a045" x="21" y="12" width="6" height="15" rx="1.4" /></svg>
  if (kind === 'games') return <svg viewBox="0 0 32 32" aria-hidden="true"><rect fill="#d36b4f" x="3" y="10" width="26" height="14" rx="7" /><rect fill="#f3e6c4" x="8.6" y="16" width="6" height="2.2" rx="1" /><rect fill="#f3e6c4" x="10.5" y="14.1" width="2.2" height="6" rx="1" /><circle fill="#7eb8e8" cx="21.2" cy="15.2" r="1.7" /><circle fill="#e0a045" cx="23.8" cy="18.4" r="1.7" /></svg>
  if (kind === 'goals') return <svg viewBox="0 0 32 32" aria-hidden="true"><path fill="#e0a045" d="M7 6h18v21l-9-3.4L7 27z" /><path fill="#c45c3c" d="M7 6h18v4H7z" /><rect fill="#f3e6c4" x="11" y="13.4" width="10" height="2" rx="1" /><rect fill="#f3e6c4" x="11" y="17.6" width="7" height="2" rx="1" /></svg>
  if (kind === 'profile') return <svg viewBox="0 0 32 32" aria-hidden="true"><circle fill="#6d4c8d" cx="16" cy="16" r="13" /><circle fill="#f3e6c4" cx="16" cy="13" r="5" /><path fill="#3a2433" d="M8.4 26.2c1.6-4.6 4.4-6.6 7.6-6.6s6 2 7.6 6.6" /></svg>
  if (kind === 'settings') return <svg viewBox="0 0 32 32" aria-hidden="true"><circle fill="#b8af82" cx="16" cy="16" r="13" /><path fill="#1a2430" d="M16 9.2a6.8 6.8 0 1 0 0 13.6 6.8 6.8 0 0 0 0-13.6zm0 4.1a2.7 2.7 0 1 1 0 5.4 2.7 2.7 0 0 1 0-5.4z" /><circle fill="#e0a045" cx="16" cy="16" r="2.1" /></svg>
  return <svg viewBox="0 0 32 32" aria-hidden="true"><circle fill="#8a5bb5" cx="16" cy="16" r="13" /><circle fill="#f3e6c4" cx="10.2" cy="16" r="2.1" /><circle fill="#f3e6c4" cx="16" cy="16" r="2.1" /><circle fill="#f3e6c4" cx="21.8" cy="16" r="2.1" /></svg>
}

type SiteSidebarProps = { active: Screen }

export function SiteSidebar({ active }: SiteSidebarProps) {
  return (
    <nav className="bindit-rail" aria-label="Main">
      <a className="bindit-rail__brand" href="#home" aria-label="Bindit home">
        <span className="bindit-rail__brand-mark" aria-hidden="true"><img src="/bindit-mascot.webp" alt="" /></span>
        Bindit
      </a>
      <ol className="bindit-rail__list">
        {ITEMS.map((item) => (
          <li key={item.id}>
            <a className={`bindit-rail__item is-${item.id} ${active === item.id ? 'is-active' : ''}`} href={`#${item.id}`} aria-current={active === item.id ? 'page' : undefined}>
              <span className="bindit-rail__icon"><Mark kind={item.id} /></span>
              <span className="bindit-rail__label">{item.label}</span>
            </a>
          </li>
        ))}
      </ol>
    </nav>
  )
}
