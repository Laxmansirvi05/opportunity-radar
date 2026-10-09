import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'fs'
import path from 'path'
import { resolveStatusOnSighting } from '@/src/providers/opportunities/ingestion/OpportunityIngestionService'

const NOW = new Date('2026-10-09T12:00:00Z')
const URL_A = 'https://example.com/jobs/1'

describe('resolveStatusOnSighting', () => {
  it('publishes a new listing with no deadline', () => {
    expect(resolveStatusOnSighting({ apply_url: URL_A }, null, NOW)).toBe('Published')
  })

  it('publishes a listing whose deadline is in the future', () => {
    expect(resolveStatusOnSighting({ apply_url: URL_A, deadline: '2026-11-01T00:00:00Z' }, null, NOW)).toBe('Published')
  })

  it('does not republish a listing whose deadline has passed', () => {
    expect(
      resolveStatusOnSighting({ apply_url: URL_A, deadline: '2026-10-01T00:00:00Z' }, { status: 'Published' }, NOW)
    ).toBe('Expired')
  })

  it('keeps a dead-link listing expired while the source still sends the same URL', () => {
    for (const link_status of [404, 410]) {
      expect(
        resolveStatusOnSighting({ apply_url: URL_A }, { status: 'Expired', link_status, apply_url: URL_A }, NOW)
      ).toBe('Expired')
    }
  })

  it('republishes a dead-link listing once the source supplies a different URL', () => {
    expect(
      resolveStatusOnSighting(
        { apply_url: 'https://example.com/jobs/1-reposted' },
        { status: 'Expired', link_status: 404, apply_url: URL_A },
        NOW
      )
    ).toBe('Published')
  })

  it('republishes a listing that was expired for a reason other than a dead link', () => {
    expect(
      resolveStatusOnSighting({ apply_url: URL_A }, { status: 'Expired', link_status: 200, apply_url: URL_A }, NOW)
    ).toBe('Published')
  })

  it('ignores an unparseable deadline rather than expiring on it', () => {
    expect(resolveStatusOnSighting({ apply_url: URL_A, deadline: 'not-a-date' }, null, NOW)).toBe('Published')
  })
})

describe('provider names survive minification', () => {
  const dir = path.resolve(__dirname, '../src/providers/opportunities/providers')

  it.each(readdirSync(dir).filter((f) => f.endsWith('.ts')))('%s declares a literal providerName', (file) => {
    const src = readFileSync(path.join(dir, file), 'utf8')
    const cls = src.match(/export class (\w+) extends OpportunityProvider/)?.[1]
    expect(cls).toBeTruthy()
    expect(src).toContain(`readonly providerName = '${cls}'`)
  })
})
