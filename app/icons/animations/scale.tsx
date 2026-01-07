import React from 'react'

export default function ScaleIcon({ className }: { className?: string }) {
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
      <path d="M21 3H3v18h18V3z" opacity="0.3" />
      <rect x="7" y="7" width="10" height="10" opacity="0.6" />
      <rect x="10" y="10" width="4" height="4" />
    </svg>
  )
}
