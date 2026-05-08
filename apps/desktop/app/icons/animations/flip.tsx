
export default function FlipIcon({ className }: { className?: string }) {
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
      <path d="M12 2v20" />
      <path d="M8 6h8v12H8z" opacity="0.5" />
      <path d="M2 12c0-2.5 1-4.5 2.5-6" />
      <path d="M22 12c0 2.5-1 4.5-2.5 6" />
    </svg>
  )
}
