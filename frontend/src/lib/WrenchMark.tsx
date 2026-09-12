type WrenchMarkProps = {
  className?: string
  variant?: 'default' | 'sidebar'
}

const SRC = {
  default: '/bindet-wrench.png',
  sidebar: '/bindet-wrench-sidebar.png',
} as const

export function WrenchMark({ className, variant = 'default' }: WrenchMarkProps) {
  return (
    <img
      className={className}
      src={SRC[variant]}
      alt=""
      aria-hidden="true"
      draggable={false}
    />
  )
}
