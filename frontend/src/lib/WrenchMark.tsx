type WrenchMarkProps = {
  className?: string
  variant?: 'default' | 'sidebar'
}

export function WrenchMark({ className, variant = 'default' }: WrenchMarkProps) {
  const size = variant === 'sidebar' ? 32 : 36
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 32 32"
      role="img"
      aria-label="Tools"
    >
      <path
        fill="currentColor"
        d="M19.2 4.2a7.2 7.2 0 0 0-8.7 8.9L4 19.6a3.5 3.5 0 0 0 5 5l6.5-6.5a7.2 7.2 0 0 0 8.9-8.7l-4.1 4.1-3.8-.8-.8-3.8 3.5-4.7ZM7.4 23.1a1.4 1.4 0 1 1 0-2.8 1.4 1.4 0 0 1 0 2.8Z"
      />
    </svg>
  )
}
