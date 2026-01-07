import React from 'react'

export default function SplitIcon({ className }: { className?: string }) {
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
      <rect x="3" y="10" width="4" height="4" />
      <rect x="10" y="10" width="4" height="4" opacity="0.7" />
      <rect x="17" y="10" width="4" height="4" opacity="0.4" />
    </svg>
  )
}
