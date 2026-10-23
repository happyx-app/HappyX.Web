import { expect, it } from 'vitest'
import { approach, keyVector, toWorld, uiScale } from './plaza'

it('turns held keys into a direction', () => {
  expect(keyVector(new Set())).toEqual([0, 0])
  expect(keyVector(new Set(['ArrowRight', 'ArrowUp']))).toEqual([1, -1])
  expect(keyVector(new Set(['a', 's']))).toEqual([-1, 1])
  // Opposite keys cancel out.
  expect(keyVector(new Set(['ArrowLeft', 'd']))).toEqual([0, 0])
})

it('maps a tap on the canvas to the world', () => {
  expect(toWorld(240, 75, { width: 480, height: 300 }, { w: 960, h: 600 })).toEqual([480, 150])
})

it('glides toward the server position and snaps on far jumps', () => {
  const x = approach(100, 110, 1 / 60)
  expect(x).toBeGreaterThan(100)
  expect(x).toBeLessThan(110)
  expect(approach(100, 110, 1)).toBe(110)
  expect(approach(100, 600, 1 / 60)).toBe(600)
})

it('draws avatars larger on small screens only', () => {
  expect(uiScale(1.6)).toBe(1) // desktop
  expect(uiScale(0.375)).toBe(2) // phone
  expect(uiScale(0.5)).toBeCloseTo(1.5)
})
