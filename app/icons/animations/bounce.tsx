
export default function BounceIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <circle cx="12" cy="17" r="3" />
      <path d="M12 14V8" />
      <path d="M8 8c0-2.2 1.8-4 4-4s4 1.8 4 4" />
      <path d="M5 20h14" />
    </svg>
  )
}
