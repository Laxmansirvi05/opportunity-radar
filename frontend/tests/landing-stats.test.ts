import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import path from 'path'
import { formatStat } from '@/lib/landing/stats'

describe('formatStat', () => {
  it('rounds down so the printed claim is never above the real count', () => {
    expect(formatStat(2996)).toBe('2,900+')
    expect(formatStat(3000)).toBe('3,000+')
    expect(formatStat(4712)).toBe('4,700+')
    expect(formatStat(349)).toBe('300+')
    expect(formatStat(350)).toBe('350+')
  })

  it('shows small counts exactly, without a plus', () => {
    expect(formatStat(42)).toBe('42')
    expect(formatStat(99)).toBe('99')
  })

  it('never prints a negative or non-numeric figure', () => {
    expect(formatStat(0)).toBe('0')
    expect(formatStat(-5)).toBe('0')
    expect(formatStat(Number.NaN)).toBe('0')
  })
})

describe('landing page', () => {
  it('has no hardcoded catalogue figures', () => {
    const src = readFileSync(path.resolve(__dirname, '../app/page.tsx'), 'utf8')
    const jsx = src.replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    expect(jsx).not.toMatch(/>\s*[\d,]{3,}\+\s*</)
  })
})
