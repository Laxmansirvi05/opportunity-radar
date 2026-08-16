import { describe, it, expect } from 'vitest'
import { createTapCounter } from '@/components/floating-robot/use-triple-tap'

describe('createTapCounter', () => {
  it('does not fire on the first or second tap', () => {
    const counter = createTapCounter(() => 0)
    expect(counter.registerTap()).toBe(false)
    expect(counter.registerTap()).toBe(false)
  })

  it('fires on the third tap when all three land within the window', () => {
    let t = 0
    const counter = createTapCounter(() => t)
    expect(counter.registerTap()).toBe(false)
    t += 150
    expect(counter.registerTap()).toBe(false)
    t += 150
    expect(counter.registerTap()).toBe(true)
  })

  it('resets the count once fired — a 4th tap does not immediately fire again', () => {
    let t = 0
    const counter = createTapCounter(() => t)
    counter.registerTap()
    t += 100
    counter.registerTap()
    t += 100
    expect(counter.registerTap()).toBe(true) // 3rd tap fires
    t += 100
    expect(counter.registerTap()).toBe(false) // 4th tap starts a fresh count at 1
  })

  it('drops taps older than the tap window instead of ever accumulating them', () => {
    let t = 0
    const counter = createTapCounter(() => t)
    counter.registerTap()
    t += 1000 // well past the 600ms window — the first tap no longer counts
    counter.registerTap()
    t += 100
    // Only 2 taps are actually within window of each other (the 2nd and
    // 3rd) — the dropped 1st means this is not yet a genuine triple-tap.
    expect(counter.registerTap()).toBe(false)
  })

  it('a tap arriving after the window resets to a fresh run of 1, not 0', () => {
    let t = 0
    const counter = createTapCounter(() => t)
    counter.registerTap()
    t += 700 // outside the window — this tap starts a new run
    expect(counter.registerTap()).toBe(false)
    t += 100
    expect(counter.registerTap()).toBe(false)
    t += 100
    expect(counter.registerTap()).toBe(true)
  })

  it('reset() clears any in-progress count', () => {
    let t = 0
    const counter = createTapCounter(() => t)
    counter.registerTap()
    counter.registerTap()
    counter.reset()
    t += 100
    expect(counter.registerTap()).toBe(false)
    t += 100
    expect(counter.registerTap()).toBe(false)
  })
})
