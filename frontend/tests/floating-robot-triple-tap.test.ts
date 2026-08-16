import { describe, it, expect } from 'vitest'
import { createMultiTapDetector, createTapCounter } from '@/components/floating-robot/use-triple-tap'

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

describe('createMultiTapDetector — double vs triple', () => {
  /** A controllable clock and timer queue, so no test depends on real time. */
  function harness(start = 1000) {
    let clock = start
    let nextHandle = 1
    const timers = new Map<number, { fn: () => void; due: number }>()
    const fired: string[] = []

    const detector = createMultiTapDetector(
      { onDoubleTap: () => fired.push('double'), onTripleTap: () => fired.push('triple') },
      {
        now: () => clock,
        schedule: (fn, ms) => {
          const handle = nextHandle++
          timers.set(handle, { fn, due: clock + ms })
          return handle
        },
        cancel: (handle) => { timers.delete(handle as number) },
      }
    )

    return {
      fired,
      detector,
      tap: (afterMs = 0) => { clock += afterMs; detector.registerTap() },
      /** Runs every timer that is due at the current clock. */
      settle: (afterMs = 300) => {
        clock += afterMs
        for (const [handle, timer] of [...timers]) {
          if (timer.due <= clock) { timers.delete(handle); timer.fn() }
        }
      },
      pendingTimers: () => timers.size,
    }
  }

  it('fires nothing on a single tap', () => {
    const h = harness()
    h.tap()
    h.settle()
    expect(h.fired).toEqual([])
  })

  it('fires double — and only double — when two taps settle', () => {
    const h = harness()
    h.tap()
    h.tap(80)
    h.settle()
    expect(h.fired).toEqual(['double'])
  })

  it('a third tap fires triple and cancels the pending double', () => {
    // This is the whole reason the double is delayed: without the cancel,
    // every triple tap would open the assistant on its way to the note.
    const h = harness()
    h.tap()
    h.tap(80)
    h.tap(80)
    expect(h.fired).toEqual(['triple'])
    h.settle()
    expect(h.fired).toEqual(['triple'])
    expect(h.pendingTimers()).toBe(0)
  })

  it('does not fire double before the settle window elapses', () => {
    const h = harness()
    h.tap()
    h.tap(80)
    h.settle(100)
    expect(h.fired).toEqual([])
  })

  it('two taps further apart than the tap window are two separate first taps', () => {
    const h = harness()
    h.tap()
    h.tap(900)
    h.settle()
    expect(h.fired).toEqual([])
  })

  it('a fourth tap after a triple starts a fresh run rather than re-firing', () => {
    const h = harness()
    h.tap()
    h.tap(80)
    h.tap(80)
    expect(h.fired).toEqual(['triple'])
    h.tap(80)
    h.settle()
    expect(h.fired).toEqual(['triple'])
  })

  it('reset() drops a pending double so it cannot fire after unmount', () => {
    const h = harness()
    h.tap()
    h.tap(80)
    h.detector.reset()
    h.settle()
    expect(h.fired).toEqual([])
    expect(h.pendingTimers()).toBe(0)
  })
})
