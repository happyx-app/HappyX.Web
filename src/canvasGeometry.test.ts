import { expect, it } from 'vitest'
import { countDrawings, gap, localPoint, scaleFor } from './canvasGeometry'

it('draws full size on wide screens and smaller on narrow ones, down to 55%', () => {
  expect(scaleFor(1920)).toBe(1)
  expect(scaleFor(1600)).toBe(1)
  expect(scaleFor(1200)).toBe(0.75)
  expect(scaleFor(390)).toBe(0.55)
})

it('measures the gap between boxes', () => {
  expect(gap([0, 0, 10, 10], [5, 5, 20, 20])).toBe(0)
  expect(gap([0, 0, 10, 10], [13, 0, 20, 10])).toBe(3)
  expect(gap([0, 0, 10, 10], [13, 14, 20, 20])).toBe(5)
})

it('stores points in px from the anchor, at full size', () => {
  expect(localPoint([0.5, 0.5], 900, 450, 1600, 1000)).toEqual([100, -50])
  // On a phone the same stroke is drawn smaller, so it is stored bigger.
  expect(localPoint([0, 0], 55, 11, 390, 844)).toEqual([100, 20])
  // Never farther than the API takes.
  expect(localPoint([0, 0], 1e6, -1e6, 1600, 1000)).toEqual([4000, -4000])
})

it('counts drawings, not strokes', () => {
  expect(countDrawings([{ drawing_id: 'a' }, { drawing_id: 'a' }, { drawing_id: 'b' }])).toBe(2)
  expect(countDrawings([])).toBe(0)
})
