import React from 'react'

const FormatLineSpacingIcon = ({
  size = undefined,
  strokeWidth = 2,
  background = 'transparent',
  opacity = 1,
  shadow = 0,
  padding = 0
}: React.SVGProps<SVGSVGElement> & {
  size?: number
  color?: string
  strokeWidth?: number
  background?: string
  opacity?: number
  rotation?: number
  shadow?: number
  flipHorizontal?: boolean
  flipVertical?: boolean
  padding?: number
}) => {
  const viewBoxSize = 24 + padding * 2
  const viewBoxOffset = -padding
  const viewBox = `${viewBoxOffset} ${viewBoxOffset} ${viewBoxSize} ${viewBoxSize}`

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={viewBox}
      width={size}
      height={size}
      fill="none"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{
        opacity,
        filter:
          shadow > 0 ? `drop-shadow(0 ${shadow}px ${shadow * 2}px rgba(0,0,0,0.3))` : undefined,
        backgroundColor: background !== 'transparent' ? background : undefined
      }}
    >
      <path
        fill="currentColor"
        d="M6.308 19L3 15.692l.708-.707l2.1 2.088V6.927l-2.1 2.089L3 8.308L6.308 5l3.308 3.308l-.708.708l-2.1-2.089v10.146l2.1-2.089l.708.708zm6.077-1v-1H21v1.23zm0-5.5v-1H21v1zm0-5.5V6L21 5.77V7z"
      />
    </svg>
  )
}

export default FormatLineSpacingIcon
