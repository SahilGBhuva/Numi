type WrenchMarkProps = {
  className?: string
}

export function WrenchMark({ className }: WrenchMarkProps) {
  return (
    <svg className={className} viewBox="0 0 32 32" aria-hidden="true">
      <path
        fill="#140d22"
        opacity={0.55}
        transform="translate(0.65, 0.85)"
        d="M21.8 5.8a5.4 5.4 0 0 0-7.6 7.6L6.5 21.1a1.9 1.9 0 1 0 2.7 2.7l7.7-7.7a5.4 5.4 0 0 0 7.6-7.6l-1.2 1.2-2-2 2-2z"
      />
      <path
        fill="#5a4498"
        stroke="#2a1848"
        strokeWidth={1.1}
        strokeLinejoin="round"
        d="M5.8 22.4a2.2 2.2 0 0 0 0 3.1 2.2 2.2 0 0 0 3.1 0l1.4-1.4-3.1-3.1z"
      />
      <path
        fill="#a890ff"
        stroke="#f4efe0"
        strokeWidth={1.75}
        strokeLinejoin="round"
        strokeLinecap="round"
        d="M21.2 5.9a5.1 5.1 0 0 0-7.2 7.2L7.3 20a1.7 1.7 0 1 0 2.4 2.4l6.7-6.7a5.1 5.1 0 0 0 7.2-7.2l-1.2 1.2-1.65-1.65 1.65-1.65z"
      />
      <path fill="#7560c8" d="M7.8 19.2 11.6 15.4 13.4 17.2 9.6 21z" />
      <path
        fill="#4f3f92"
        stroke="#2a1848"
        strokeWidth={0.9}
        d="M21.2 8.8a2.5 2.5 0 1 0-3.5-3.5"
      />
      <path fill="#ddd0ff" d="M23.8 7.2a3 3 0 0 0-4.2 0l.6.6a2 2 0 0 1 2.8 0z" />
      <path
        fill="none"
        stroke="rgba(255,255,255,0.45)"
        strokeWidth={1.4}
        strokeLinecap="round"
        d="M12.8 17.8 17.8 12.8"
      />
      <circle fill="#8470e8" stroke="#f4efe0" strokeWidth={1.2} cx={21.2} cy={9.8} r={2.1} />
      <circle fill="#f3d48a" stroke="#2a1848" strokeWidth={0.75} cx={21.2} cy={9.8} r={0.95} />
    </svg>
  )
}
