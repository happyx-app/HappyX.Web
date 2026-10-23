import { describe, expect, it } from 'vitest'
import { edgePoint, formatClock, tileAt } from './launch'

describe('launch', () => {
  it('shows the clock as m:ss, rounding up', () => {
    expect(formatClock(240)).toBe('4:00')
    expect(formatClock(9.2)).toBe('0:10')
    expect(formatClock(-3)).toBe('0:00')
  })

  it('maps a tap to the tile under it, inside the office', () => {
    const o = { cols: 24, rows: 15 }
    const rect = { width: 480, height: 300 }
    expect(tileAt(0, 0, rect, o)).toEqual([0, 0])
    expect(tileAt(70, 250, rect, o)).toEqual([3, 12])
    expect(tileAt(480, 300, rect, o)).toEqual([23, 14])
  })

  it('puts the arrow on the edge of the view, toward the target', () => {
    const [x, y, a] = edgePoint(100, 100, 100, 400, 50)
    expect(x).toBeCloseTo(100)
    expect(y).toBeCloseTo(150)
    expect(a).toBeCloseTo(Math.PI / 2)
  })
})
