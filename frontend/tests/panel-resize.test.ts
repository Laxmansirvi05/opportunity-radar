// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest'
import { clampPanelSize, maxPanelSize, MAX_VIEWPORT_FRACTION } from '@/components/floating-robot/use-panel-resize'

const NOTE_DEFAULT = { width: 340, height: 300 }
const ASSISTANT_DEFAULT = { width: 360, height: 440 }

function setViewport(width: number, height: number) {
  Object.defineProperty(window, 'innerWidth', { value: width, configurable: true })
  Object.defineProperty(window, 'innerHeight', { value: height, configurable: true })
}

describe('panel resize limits', () => {
  beforeEach(() => setViewport(1440, 900))

  it('caps each axis at 40% of the viewport', () => {
    expect(MAX_VIEWPORT_FRACTION).toBe(0.4)
    const max = maxPanelSize(NOTE_DEFAULT)
    expect(max.width).toBe(576)
    expect(max.height).toBe(360)
  })

  it('refuses to grow a panel past the cap however far the handle is dragged', () => {
    const dragged = clampPanelSize({ width: 5000, height: 5000 }, NOTE_DEFAULT)
    expect(dragged).toEqual({ width: 576, height: 360 })
  })

  it('lets a panel grow right up to the cap', () => {
    expect(clampPanelSize({ width: 576, height: 360 }, NOTE_DEFAULT)).toEqual({ width: 576, height: 360 })
  })

  it('never caps a panel below the size it opens at', () => {
    // The Quick Assistant opens 440 tall; 40% of a 900px viewport is 360. A
    // strict cap would make it boot above its own maximum and snap smaller the
    // first time the handle was touched.
    const max = maxPanelSize(ASSISTANT_DEFAULT)
    expect(max.height).toBe(ASSISTANT_DEFAULT.height)
    expect(clampPanelSize(ASSISTANT_DEFAULT, ASSISTANT_DEFAULT)).toEqual(ASSISTANT_DEFAULT)
  })

  it('enforces a floor so a panel cannot be dragged down to nothing', () => {
    expect(clampPanelSize({ width: 10, height: 10 }, NOTE_DEFAULT)).toEqual({ width: 260, height: 220 })
  })

  it('re-clamps a size saved on a big monitor when reopened on a laptop', () => {
    setViewport(3840, 2160)
    const onBigScreen = clampPanelSize({ width: 1400, height: 800 }, NOTE_DEFAULT)
    expect(onBigScreen).toEqual({ width: 1400, height: 800 })

    setViewport(1280, 800)
    const reopened = clampPanelSize(onBigScreen, NOTE_DEFAULT)
    expect(reopened.width).toBe(512)
    expect(reopened.height).toBe(320)
  })

  it('rounds to whole pixels', () => {
    const clamped = clampPanelSize({ width: 400.6, height: 350.2 }, NOTE_DEFAULT)
    expect(Number.isInteger(clamped.width)).toBe(true)
    expect(Number.isInteger(clamped.height)).toBe(true)
  })

  it('keeps a panel inside 40% on a very small viewport by falling back to its default', () => {
    setViewport(480, 640)
    // 40% would be 192x256 — below the minimums and below the default, so the
    // default wins and the panel stays usable rather than collapsing.
    const max = maxPanelSize(NOTE_DEFAULT)
    expect(max.width).toBe(NOTE_DEFAULT.width)
    expect(max.height).toBe(NOTE_DEFAULT.height)
  })
})
