import { describe, it, expect } from 'vitest'
import { pickReusableDraft } from '@/features/resume-toolkit/lib/reusable-draft'

const at = (s: string) => `2026-10-09T10:00:${s}.000Z`

describe('pickReusableDraft', () => {
  it('returns null when the user has no resumes', () => {
    expect(pickReusableDraft([])).toBeNull()
  })

  it('reuses an untouched blank draft instead of creating another', () => {
    expect(pickReusableDraft([{ id: 'a', file_name: 'Untitled Resume', created_at: at('00'), updated_at: at('00') }])).toBe('a')
  })

  it('picks the newest when several untouched drafts already exist', () => {
    expect(
      pickReusableDraft([
        { id: 'old', file_name: 'Untitled Resume', created_at: at('00'), updated_at: at('00') },
        { id: 'new', file_name: 'Untitled Resume', created_at: at('30'), updated_at: at('30') },
      ])
    ).toBe('new')
  })

  it('does not reuse a draft the user has edited', () => {
    expect(pickReusableDraft([{ id: 'a', file_name: 'Untitled Resume', created_at: at('00'), updated_at: at('45') }])).toBeNull()
  })

  it('does not reuse a resume the user has named', () => {
    expect(pickReusableDraft([{ id: 'a', file_name: 'Asha Rao - Backend', created_at: at('00'), updated_at: at('00') }])).toBeNull()
  })

  it('treats a missing updated_at as untouched', () => {
    expect(pickReusableDraft([{ id: 'a', file_name: 'Untitled Resume', created_at: at('00'), updated_at: null }])).toBe('a')
  })
})
