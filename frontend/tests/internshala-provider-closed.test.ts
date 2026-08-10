import { describe, it, expect, vi, afterEach } from 'vitest'
import { InternshalaProvider } from '../src/providers/opportunities/providers/InternshalaProvider'

/**
 * DATA-02: Internshala returns 200 (not 404) with a banner in place of the
 * apply flow for a closed posting. This proves the queue-path detail fetch
 * (fetchDetailPage, the same detection used inline in fetch()) actually
 * rejects a closed posting instead of silently normalizing it as live.
 */

const closedHtml = `
  <html><body>
    <div class="profile_on_detail_page">Some Internship</div>
    <div class="company_name">Some Co</div>
    <div>Applications are closed for this internship. Click here to browse more internships.</div>
  </body></html>
`

const openHtml = `
  <html><body>
    <div class="profile_on_detail_page">Backend Development Internship</div>
    <div class="company_name">Some Co</div>
    <div class="internship_details">Build things.</div>
  </body></html>
`

describe('InternshalaProvider.fetchDetailPage', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('rejects a closed posting instead of returning it as normal data', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(closedHtml, { status: 200 })))
    const provider = new InternshalaProvider()

    await expect(
      provider.fetchDetailPage('https://internshala.com/internship/detail/some-closed-one123')
    ).rejects.toThrow(/closed/i)
  })

  it('returns normally for an open posting', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(openHtml, { status: 200 })))
    const provider = new InternshalaProvider()

    const item = await provider.fetchDetailPage('https://internshala.com/internship/detail/some-open-one456')
    expect(item.title).toBe('Backend Development Internship')
  })
})
