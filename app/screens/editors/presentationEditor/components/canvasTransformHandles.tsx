export type ResizeHandle =
  | 'top-left'
  | 'top-right'
  | 'bottom-left'
  | 'bottom-right'
  | 'top'
  | 'right'
  | 'bottom'
  | 'left'

type Props = {
  onStartRotate: (event: React.PointerEvent<HTMLDivElement>) => void
  onStartResize: (event: React.PointerEvent<HTMLDivElement>, corner: ResizeHandle) => void
}

export default function CanvasTransformHandles({ onStartRotate, onStartResize }: Props) {
  return (
    <>
      <div
        className="absolute -top-7 left-1/2 -translate-x-1/2 z-20 w-4 h-4 rounded-full bg-primary/90 border border-background cursor-alias"
        onPointerDown={onStartRotate}
      />
      <div
        className="absolute -left-2 -top-2 z-20 w-4 h-4 rounded-sm bg-primary border border-background cursor-nwse-resize"
        onPointerDown={(event) => onStartResize(event, 'top-left')}
      />
      <div
        className="absolute -right-2 -top-2 z-20 w-4 h-4 rounded-sm bg-primary border border-background cursor-nesw-resize"
        onPointerDown={(event) => onStartResize(event, 'top-right')}
      />
      <div
        className="absolute -left-2 -bottom-2 z-20 w-4 h-4 rounded-sm bg-primary border border-background cursor-nesw-resize"
        onPointerDown={(event) => onStartResize(event, 'bottom-left')}
      />
      <div
        className="absolute -right-2 -bottom-2 z-20 w-4 h-4 rounded-sm bg-primary border border-background cursor-nwse-resize"
        onPointerDown={(event) => onStartResize(event, 'bottom-right')}
      />
      <div
        className="absolute -top-2 left-1/2 -translate-x-1/2 z-20 w-3 h-3 rounded-full bg-primary/60 border border-background cursor-ns-resize"
        onPointerDown={(event) => onStartResize(event, 'top')}
      />
      <div
        className="absolute -bottom-2 left-1/2 -translate-x-1/2 z-20 w-3 h-3 rounded-full bg-primary/60 border border-background cursor-ns-resize"
        onPointerDown={(event) => onStartResize(event, 'bottom')}
      />
      <div
        className="absolute -left-2 top-1/2 -translate-y-1/2 z-20 w-3 h-3 rounded-full bg-primary/60 border border-background cursor-ew-resize"
        onPointerDown={(event) => onStartResize(event, 'left')}
      />
      <div
        className="absolute -right-2 top-1/2 -translate-y-1/2 z-20 w-3 h-3 rounded-full bg-primary/60 border border-background cursor-ew-resize"
        onPointerDown={(event) => onStartResize(event, 'right')}
      />
    </>
  )
}
