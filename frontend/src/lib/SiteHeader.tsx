import { AvatarControl } from './AvatarControl'

type SiteHeaderProps = {
  onError?: (message: string) => void
}

export function SiteHeader({ onError }: SiteHeaderProps) {
  return (
    <header className="sheet__top">
      <div className="profile-pill">
        <AvatarControl onError={onError} />
      </div>

      <a className="logo" href="#home" aria-label="Numi logo">
        N
      </a>
    </header>
  )
}
