import { AvatarControl } from './AvatarControl'

function GearMark() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="3" />
      <path d="M12 3.2v2.3M12 18.5v2.3M4.8 6.2l1.7 1.7M17.5 16.1l1.7 1.7M3.2 12h2.3M18.5 12h2.3M6.2 19.2l1.7-1.7M16.1 6.5l1.7-1.7" />
    </svg>
  )
}

type SiteHeaderProps = {
  active: 'home' | 'progress'
  onError?: (message: string) => void
  onSettings?: () => void
}

export function SiteHeader({ active, onError, onSettings }: SiteHeaderProps) {
  return (
    <header className="sheet__top">
      <div className="profile-pill">
        <AvatarControl onError={onError} />
        <button className="gear" type="button" onClick={onSettings} aria-label="Settings">
          <GearMark />
        </button>
      </div>

      <nav className="directory" aria-label="Directory">
        <a className={`directory__lead ${active === 'home' ? 'is-active' : ''}`} href="#home">
          Home
        </a>
        <span className="directory__lead is-empty" aria-label="Empty slot" />
        <a className={`directory__lead ${active === 'progress' ? 'is-active' : ''}`} href="#progress">
          Progress
        </a>
      </nav>

      <a className="logo" href="#home" aria-label="Numi logo">
        N
      </a>
    </header>
  )
}
