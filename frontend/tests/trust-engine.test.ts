import { describe, it, expect } from 'vitest'
import { detectSynthetic, describeVerdict } from '@/lib/ingestion/synthetic-detector'
import { canonicalizeUrl, fingerprintPosting } from '@/lib/ingestion/canonical-url'
import { classifyGeo, applyGeoQuota } from '@/lib/ingestion/geo'
import {
  deleteExpiredOpportunities,
  reconcileUnseen,
  RECONCILE_MIN_COVERAGE,
  type Db,
} from '@/lib/ingestion/reconciliation'

// ───────────────────────────────────────────────────────────────────────────
// Synthetic detection — replaying the real fabricated providers
// ───────────────────────────────────────────────────────────────────────────

/** Faithful reproduction of the deleted DevfolioProvider.fetch(). */
const fakeDevfolio = Array.from({ length: 25 }, (_, i) => ({
  source_id: `devfolio_hack_${1000 + i}`,
  title: `Global Web3 Hackathon 202${6 + (i % 2)} Vol ${i + 1}`,
  company: 'Devfolio',
  description:
    'Build the next generation of decentralized applications in this 48-hour hackathon. Huge prizes and bounties from top protocols.',
  apply_url: `https://devfolio.co/hackathons/${1000 + i}`,
}))

/** Faithful reproduction of the deleted CompanyProvider.fetch(). */
const fakeCompany = Array.from({ length: 10 }, (_, i) => ({
  source_id: `gh_${1000 + i}`,
  title: `Software Engineer L${(i % 3) + 3} - ${i % 2 === 0 ? 'Backend' : 'Frontend'}`,
  company: `TechCorp ${i + 1}`,
  description: `We are looking for an experienced engineer to join TechCorp ${i + 1}.`,
  apply_url: `https://techcorp${i + 1}.greenhouse.io/jobs/gh_${1000 + i}`,
}))

/** Faithful reproduction of the deleted Hack2SkillProvider.fetch(). */
const fakeHack2Skill = Array.from({ length: 25 }, (_, i) => ({
  source_id: `h2s_event_${5000 + i}`,
  title: `AI Innovators Hackathon v${i + 1}`,
  company: 'Hack2Skill',
  description: 'Join developers worldwide to build AI agents and tools. Prizes worth $100,000+.',
  apply_url: `https://hack2skill.com/hackathons/${5000 + i}`,
}))

/** Shape of a genuine Greenhouse batch (verified live against postman's board). */
const realGreenhouse = [
  { source_id: '7812973003', title: 'Senior Software Engineer, Platform', company: 'Postman', description: 'Postman is the world\'s leading API platform. You will own core services.', apply_url: 'https://job-boards.greenhouse.io/postman/jobs/7812973003' },
  { source_id: '7793001002', title: 'Engineering Manager, Collections', company: 'Postman', description: 'Lead a team building the collections experience used by millions of developers.', apply_url: 'https://job-boards.greenhouse.io/postman/jobs/7793001002' },
  { source_id: '7654220987', title: 'Product Designer', company: 'Postman', description: 'Shape how developers discover and consume APIs across the product surface.', apply_url: 'https://job-boards.greenhouse.io/postman/jobs/7654220987' },
  { source_id: '7511903344', title: 'Data Engineer II', company: 'Postman', description: 'Build the data pipelines behind product analytics and experimentation.', apply_url: 'https://job-boards.greenhouse.io/postman/jobs/7511903344' },
  { source_id: '7409112238', title: 'Technical Writer', company: 'Postman', description: 'Own developer-facing documentation for our API tooling.', apply_url: 'https://job-boards.greenhouse.io/postman/jobs/7409112238' },
  { source_id: '7322884410', title: 'Solutions Engineer, India', company: 'Postman', description: 'Partner with enterprise customers in India to deliver API-first solutions.', apply_url: 'https://job-boards.greenhouse.io/postman/jobs/7322884410' },
]

describe('synthetic detection', () => {
  it('catches the fabricated Devfolio batch', () => {
    const v = detectSynthetic(fakeDevfolio)
    expect(v.isSynthetic).toBe(true)
    expect(v.signals.map((s) => s.code)).toContain('sequential_source_ids')
  })

  it('catches the fabricated CompanyProvider batch on placeholder naming', () => {
    const v = detectSynthetic(fakeCompany)
    expect(v.isSynthetic).toBe(true)
    expect(v.signals.map((s) => s.code)).toContain('placeholder_vocabulary')
  })

  it('catches the fabricated Hack2Skill batch on identical descriptions', () => {
    const v = detectSynthetic(fakeHack2Skill)
    expect(v.isSynthetic).toBe(true)
    expect(v.signals.map((s) => s.code)).toContain('identical_descriptions')
  })

  it('does NOT flag a genuine Greenhouse batch', () => {
    const v = detectSynthetic(realGreenhouse)
    expect(v.isSynthetic).toBe(false)
    expect(v.score).toBeLessThan(1)
  })

  it('stays quiet on batches too small to judge', () => {
    expect(detectSynthetic([{ title: 'Intern', company: 'Acme Renewables', source_id: '1' }]).isSynthetic).toBe(false)
  })

  it('produces a log line naming the reason', () => {
    expect(describeVerdict(detectSynthetic(fakeDevfolio))).toMatch(/sequential_source_ids/)
  })
})

// ───────────────────────────────────────────────────────────────────────────
// Canonical URLs
// ───────────────────────────────────────────────────────────────────────────

describe('canonicalizeUrl', () => {
  it('collapses tracking params, www, scheme and trailing slash', () => {
    const a = canonicalizeUrl('http://www.Example.com/jobs/123/?utm_source=x&gh_src=y')
    const b = canonicalizeUrl('https://example.com/jobs/123')
    expect(a).toBe(b)
  })

  it('is order-insensitive for meaningful params', () => {
    expect(canonicalizeUrl('https://x.com/j?b=2&a=1')).toBe(canonicalizeUrl('https://x.com/j?a=1&b=2'))
  })

  it('keeps params that identify the posting', () => {
    expect(canonicalizeUrl('https://stripe.com/jobs/search?gh_jid=8023928')).toContain('gh_jid=8023928')
  })

  it('does not merge two different postings', () => {
    expect(canonicalizeUrl('https://x.com/jobs/1')).not.toBe(canonicalizeUrl('https://x.com/jobs/2'))
  })

  it('rejects junk and non-http schemes', () => {
    expect(canonicalizeUrl('not a url')).toBeNull()
    expect(canonicalizeUrl('javascript:alert(1)')).toBeNull()
    expect(canonicalizeUrl(null)).toBeNull()
  })
})

describe('fingerprintPosting', () => {
  it('matches the same role written two ways', () => {
    expect(fingerprintPosting('Acme Technologies Pvt Ltd', 'Software Engineer Intern (Bangalore)', 'Bangalore'))
      .toBe(fingerprintPosting('Acme', 'software engineer', 'Bangalore'))
  })

  it('separates different companies', () => {
    expect(fingerprintPosting('Acme', 'SDE Intern', 'Pune'))
      .not.toBe(fingerprintPosting('Globex', 'SDE Intern', 'Pune'))
  })
})

// ───────────────────────────────────────────────────────────────────────────
// Geography
// ───────────────────────────────────────────────────────────────────────────

describe('classifyGeo', () => {
  it('recognises Indian cities', () => {
    for (const loc of ['Bengaluru, Karnataka, India', 'Hyderabad', 'Gurugram', 'Navi Mumbai']) {
      const g = classifyGeo(loc)
      expect(g.country).toBe('IN')
      expect(g.publishable).toBe(true)
    }
  })

  it('publishes international roles only when genuinely remote', () => {
    expect(classifyGeo('San Francisco, California, United States').publishable).toBe(false)
    expect(classifyGeo('Remote').publishable).toBe(true)
  })

  it('rejects "Remote - US", which an Indian student cannot take', () => {
    const g = classifyGeo('Remote - US')
    expect(g.isRemote).toBe(true)
    expect(g.publishable).toBe(false)
  })

  it('rejects an unlocated, non-remote listing rather than guessing', () => {
    expect(classifyGeo('').publishable).toBe(false)
    expect(classifyGeo('', { mode: 'Remote' }).publishable).toBe(true)
  })
})

describe('applyGeoQuota', () => {
  it('keeps everything when international is already a small share', () => {
    const items = [
      ...Array.from({ length: 90 }, () => ({ country: 'IN' })),
      ...Array.from({ length: 5 }, () => ({ country: 'INTL' })),
    ]
    expect(applyGeoQuota(items).trimmed).toHaveLength(0)
  })

  it('trims international down to roughly 15%', () => {
    const items = [
      ...Array.from({ length: 85 }, () => ({ country: 'IN' })),
      ...Array.from({ length: 200 }, () => ({ country: 'INTL' })),
    ]
    const { kept } = applyGeoQuota(items)
    const share = kept.filter((i) => i.country !== 'IN').length / kept.length
    expect(share).toBeLessThanOrEqual(0.16)
  })

  it('keeps the most trusted international listings when trimming', () => {
    const items = [
      ...Array.from({ length: 10 }, () => ({ country: 'IN', trust_tier: 3 })),
      { country: 'INTL', trust_tier: 1 },
      ...Array.from({ length: 20 }, () => ({ country: 'INTL', trust_tier: 3 })),
    ]
    const { kept } = applyGeoQuota(items)
    expect(kept.some((i) => i.country === 'INTL' && i.trust_tier === 1)).toBe(true)
  })
})

// ───────────────────────────────────────────────────────────────────────────
// Reconciliation — the deletion policy
// ───────────────────────────────────────────────────────────────────────────

interface Row { id: string; source?: string; deadline?: string | null; last_seen_at?: string | null }

function createDb(opts: {
  opportunities: Row[]
  trackerProtected?: string[]
  trackerFails?: boolean
}) {
  const deleted: string[] = []
  const expired: string[] = []

  const client = {
    from(table: string) {
      const state: { op: string; ids?: string[]; payload?: Record<string, unknown> } = { op: 'select' }
      const b: Record<string, (...args: never[]) => unknown> & { then: (r: (v: unknown) => void) => void } = {
        select: () => b,
        delete: () => { state.op = 'delete'; return b },
        update: (p: Record<string, unknown>) => { state.op = 'update'; state.payload = p; return b },
        eq: () => b,
        not: () => b,
        lt: () => b,
        or: () => b,
        in: (_col: string, vals: string[]) => { state.ids = vals; return b },
        range: () => b,
        then: (res: (v: unknown) => void) => {
          if (table === 'application_tracker') {
            if (opts.trackerFails) return res({ data: null, error: { message: 'permission denied' } })
            return res({ data: (opts.trackerProtected ?? []).map((id) => ({ opportunity_id: id, status: 'Applied' })), error: null })
          }
          if (state.op === 'delete') { deleted.push(...(state.ids ?? [])); return res({ data: null, error: null, count: (state.ids ?? []).length }) }
          if (state.op === 'update') { expired.push(...(state.ids ?? [])); return res({ data: null, error: null }) }
          return res({ data: opts.opportunities.map((o) => ({ id: o.id })), error: null })
        },
      }
      return b
    },
  }
  return { client: client as unknown as Db, deleted, expired }
}

describe('deleteExpiredOpportunities', () => {
  it('deletes past-deadline listings', async () => {
    const { client, deleted } = createDb({ opportunities: [{ id: 'a' }, { id: 'b' }] })
    const r = await deleteExpiredOpportunities(client)
    expect(deleted.sort()).toEqual(['a', 'b'])
    expect(r.deleted).toBe(2)
  })

  it('preserves a listing a student has APPLIED to, marking it Expired instead', async () => {
    const { client, deleted, expired } = createDb({
      opportunities: [{ id: 'a' }, { id: 'applied-one' }],
      trackerProtected: ['applied-one'],
    })
    const r = await deleteExpiredOpportunities(client)
    expect(deleted).toEqual(['a'])
    expect(expired).toEqual(['applied-one'])
    expect(r.preserved).toBe(1)
  })

  it('deletes NOTHING if the tracker cannot be read', async () => {
    const { client, deleted, expired } = createDb({ opportunities: [{ id: 'a' }], trackerFails: true })
    const r = await deleteExpiredOpportunities(client)
    expect(deleted).toHaveLength(0)
    expect(expired).toHaveLength(0)
    expect(r.skipped).toBe(true)
    expect(r.reason).toMatch(/refusing to delete/)
  })
})

describe('reconcileUnseen', () => {
  const RUN = '2026-08-09T00:00:00Z'

  it('deletes listings the source no longer advertises', async () => {
    const { client, deleted } = createDb({ opportunities: [{ id: 'gone' }] })
    const r = await reconcileUnseen(client, 'unstop', RUN, 100, 100)
    expect(deleted).toEqual(['gone'])
    expect(r.skipped).toBe(false)
  })

  it('refuses to reconcile after a partial scrape', async () => {
    const { client, deleted } = createDb({ opportunities: [{ id: 'gone' }] })
    // Saw 10 where the source previously had 1000 — almost certainly a failure,
    // and deleting here would erase the source's entire catalogue.
    const r = await reconcileUnseen(client, 'unstop', RUN, 10, 1000)
    expect(r.skipped).toBe(true)
    expect(deleted).toHaveLength(0)
    expect(r.reason).toMatch(/partial/)
  })

  it('reconciles at exactly the coverage threshold', async () => {
    const { client } = createDb({ opportunities: [] })
    const r = await reconcileUnseen(client, 'unstop', RUN, RECONCILE_MIN_COVERAGE * 1000, 1000)
    expect(r.skipped).toBe(false)
  })

  it('runs on a first-ever scrape, when there is no previous volume', async () => {
    const { client } = createDb({ opportunities: [] })
    expect((await reconcileUnseen(client, 'newsource', RUN, 5, 0)).skipped).toBe(false)
  })
})
