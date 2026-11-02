// Pure geometry of the team canvas (see canvas.ts), kept apart so it can be tested without a page.

// Strokes by the same person less than this apart, in time and on screen, belong to one drawing.
export const sameDrawingMs = 2 * 60_000
export const sameDrawingPx = 150
// The API's limits.
export const maxPoints = 500
const maxOffset = 4000

// scaleFor is how big drawings are on a screen this wide: full size from 1600 px, down to 55%.
export const scaleFor = (width: number) => Math.max(0.55, Math.min(1, width / 1600))

export type Box = [x1: number, y1: number, x2: number, y2: number]

// gap is the distance between two boxes, 0 when they touch.
export const gap = (a: Box, b: Box) => Math.hypot(Math.max(0, a[0] - b[2], b[0] - a[2]), Math.max(0, a[1] - b[3], b[1] - a[3]))

// localPoint turns a point on screen into px from the anchor, as stored.
export function localPoint(anchor: [number, number], x: number, y: number, width: number, height: number): [number, number] {
  const k = scaleFor(width)
  const clamp = (v: number) => Math.max(-maxOffset, Math.min(maxOffset, Math.round(v / k)))
  return [clamp(x - anchor[0] * width), clamp(y - anchor[1] * height)]
}

// countDrawings counts the drawings among the strokes.
export const countDrawings = (strokes: { drawing_id: string }[]) => new Set(strokes.map((x) => x.drawing_id)).size

