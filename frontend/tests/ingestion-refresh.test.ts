import { describe, it, expect, beforeEach, vi } from 'vitest'
import { OpportunityIngestionService } from '@/src/providers/opportunities/ingestion/OpportunityIngestionService'

/**
 * Regression cover for audit item A4 — the reason opportunities never refreshed.
 *
 * runPipeline() preloads every existing opportunity into a fingerprint/URL set,
 * then skipped any scraped item already in those sets. Since a listing that is
 * already stored is (by definition) already in them, every returning listing
 * was skipped BEFORE reaching upsert(). New rows could be inserted, but nothing
 * already in the database was ever updated — deadlines, descriptions and
 * closures went stale permanently.
 *
 * upsert() itself was always correct; it was simply unreachable for refreshes.
 */

interface OppRow {
  id: string
  title: string
  company_name: string
  apply_url: string
  source: string
  source_id: string
  status?: string
  deadline?: string | null
  posted_at?: string | null
}

/** Records every write the pipeline attempts, so tests can assert on intent. */
interface Recorder {
  inserted: Record<string, unknown>[]
  updated: { id: string; payload: Record<string, unknown> }[]
  logs: Record<string, unknown>[]
  preloadPages: number
}

/** The subset of the Supabase query builder the pipeline actually calls. */
interface FakeBuilder {
  select: () => FakeBuilder
  insert: (p: unknown) => FakeBuilder
  update: (p: unknown) => FakeBuilder
  upsert: (p: unknown) => FakeBuilder
  delete: () => FakeBuilder
  eq: (col: string, val: unknown) => FakeBuilder
  in: () => FakeBuilder
  not: () => FakeBuilder
  lt: () => FakeBuilder
  or: () => FakeBuilder
  ilike: () => FakeBuilder
  order: () => FakeBuilder
  range: (a: number, b: number) => FakeBuilder
  limit: (n: number) => FakeBuilder
  maybeSingle: () => FakeBuilder
  single: () => FakeBuilder
  then: (res: (v: unknown) => void) => void
}

function createFakeDb(existing: OppRow[]) {
  const rows = [...existing]
  const rec: Recorder = { inserted: [], updated: [], logs: [], preloadPages: 0 }
  let nextId = rows.length + 1

  function makeBuilder(table: string) {
    const state: {
      op: 'select' | 'insert' | 'update' | 'upsert' | 'delete'
      payload: unknown
      eq: Record<string, unknown>
      range?: [number, number]
      limit?: number
      single: boolean
    } = { op: 'select', payload: null, eq: {}, single: false }

    const resolve = () => {
      if (table === 'ingestion_logs') {
        if (state.op === 'insert') rec.logs.push(state.payload as Record<string, unknown>)
        return { data: null, error: null }
      }
      if (table === 'opportunity_tags') return { data: null, error: null }
      if (table === 'companies') {
        if (state.op === 'insert') return { data: { id: 'company-1' }, error: null }
        // Pretend the company already exists so the pipeline moves on quickly.
        return { data: { id: 'company-1', logo_url: 'x' }, error: null }
      }

      // ── opportunities ────────────────────────────────────────────────
      if (state.op === 'insert') {
        const raw = state.payload
        const payload = (Array.isArray(raw) ? raw[0] : raw) as Record<string, unknown>
        const id = `new-${nextId++}`
        rec.inserted.push(payload)
        rows.push({ id, ...payload } as unknown as OppRow)
        return { data: { id }, error: null }
      }
      if (state.op === 'update') {
        const id = String(state.eq.id ?? '')
        if (id) rec.updated.push({ id, payload: state.payload as Record<string, unknown> })
        return { data: [], error: null }
      }
      if (state.op === 'select') {
        // upsert()'s existence probe: .eq(source).eq(source_id).maybeSingle()
        if (state.eq.source !== undefined && state.eq.source_id !== undefined) {
          const hit = rows.find(
            (r) => r.source === state.eq.source && r.source_id === state.eq.source_id
          )
          return { data: hit ? { id: hit.id, posted_at: hit.posted_at ?? null } : null, error: null }
        }
        // expireOpportunities()'s link-check sample — keep it empty so no
        // real HTTP requests are made from a unit test.
        if (state.eq.status !== undefined) return { data: [], error: null }
        // loadExistingIndex()'s paginated preload
        if (state.range) {
          rec.preloadPages++
          const [from, to] = state.range
          return { data: rows.slice(from, to + 1), error: null }
        }
        return { data: [], error: null }
      }
      return { data: null, error: null }
    }

    const builder: FakeBuilder = {
      select: () => builder,
      insert: (p: unknown) => { state.op = 'insert'; state.payload = p; return builder },
      update: (p: unknown) => { state.op = 'update'; state.payload = p; return builder },
      upsert: (p: unknown) => { state.op = 'upsert'; state.payload = p; return builder },
      delete: () => { state.op = 'delete'; return builder },
      eq: (col: string, val: unknown) => { state.eq[col] = val; return builder },
      in: () => builder,
      not: () => builder,
      lt: () => builder,
      or: () => builder,
      ilike: () => builder,
      order: () => builder,
      range: (a: number, b: number) => { state.range = [a, b]; return builder },
      limit: (n: number) => { state.limit = n; return builder },
      maybeSingle: () => { state.single = true; return builder },
      single: () => { state.single = true; return builder },
      then: (res: (v: unknown) => void) => res(resolve()),
    }
    return builder
  }

  return { rec, rows, client: { from: (t: string) => makeBuilder(t) } }
}

/** A provider that emits exactly the items given. */
function providerEmitting(source: string, items: Partial<OppRow>[]) {
  return {
    fetchListPages: async () => [],
    fetchDetailPage: async () => ({}),
    fetch: async () => items,
    normalize: (raw: Partial<OppRow>) => ({
      title: raw.title,
      company: raw.company_name,
      apply_url: raw.apply_url,
      source,
      source_id: raw.source_id,
      description: 'A description long enough to pass validation checks.',
      location: 'Remote',
      category: 'Internship',
      skills: [],
      requirements: [],
      deadline: raw.deadline ?? null,
      posted_at: raw.posted_at ?? null,
    }),
    validate: () => true,
  } as unknown as ConstructorParameters<typeof OpportunityIngestionService>[0][number]
}

const EXISTING: OppRow = {
  id: 'opp-1',
  title: 'Frontend Engineer Intern',
  company_name: 'Acme Corp',
  apply_url: 'https://acme.example/jobs/1',
  source: 'unstop',
  source_id: 'U-1',
}

describe('ingestion refresh (A4)', () => {
  beforeEach(() => {
    vi.unstubAllEnvs()
    vi.stubEnv('NODE_ENV', 'test')
  })

  it('UPDATES a listing that comes back from the same source', async () => {
    const { rec, client } = createFakeDb([EXISTING])
    const provider = providerEmitting('unstop', [
      { ...EXISTING, deadline: '2027-01-01T00:00:00Z' },
    ])

    const result = await new OpportunityIngestionService([provider], client).runPipeline()

    // This is the whole bug: before the fix this was 0 updates and 1 skip.
    expect(rec.updated).toHaveLength(1)
    expect(rec.updated[0].id).toBe('opp-1')
    expect(rec.inserted).toHaveLength(0)
    expect(result.status).toBe('completed')
    expect(result).toMatchObject({ updated: 1, skipped_dup: 0 })
  })

  it('propagates a changed deadline through to the update payload', async () => {
    const { rec, client } = createFakeDb([EXISTING])
    const provider = providerEmitting('unstop', [
      { ...EXISTING, deadline: '2027-06-30T00:00:00Z' },
    ])

    await new OpportunityIngestionService([provider], client).runPipeline()

    expect(rec.updated[0].payload).toMatchObject({ deadline: '2027-06-30T00:00:00Z' })
  })

  it('still INSERTS a genuinely new listing', async () => {
    const { rec, client } = createFakeDb([EXISTING])
    const provider = providerEmitting('unstop', [
      {
        title: 'Backend Engineer Intern',
        company_name: 'Globex',
        apply_url: 'https://globex.example/jobs/9',
        source_id: 'U-9',
      },
    ])

    const result = await new OpportunityIngestionService([provider], client).runPipeline()

    expect(rec.inserted).toHaveLength(1)
    expect(rec.updated).toHaveLength(0)
    expect(result).toMatchObject({ inserted: 1 })
  })

  it('still SKIPS the same job advertised by a different source', async () => {
    const { rec, client } = createFakeDb([EXISTING])
    // Same company + title, different provider and a different URL.
    const provider = providerEmitting('internshala', [
      {
        title: 'Frontend Engineer Intern',
        company_name: 'Acme Corp',
        apply_url: 'https://internshala.example/jobs/77',
        source_id: 'I-77',
      },
    ])

    const result = await new OpportunityIngestionService([provider], client).runPipeline()

    expect(rec.inserted).toHaveLength(0)
    expect(rec.updated).toHaveLength(0)
    expect(result).toMatchObject({ skipped_dup: 1 })
  })

  it('does not let two providers in one run insert the same job twice', async () => {
    const { rec, client } = createFakeDb([])
    const job = {
      title: 'Data Analyst Intern',
      company_name: 'Initech',
      apply_url: 'https://initech.example/jobs/5',
    }
    const a = providerEmitting('unstop', [{ ...job, source_id: 'U-5' }])
    const b = providerEmitting('internshala', [{ ...job, source_id: 'I-5' }])

    const result = await new OpportunityIngestionService([a, b], client).runPipeline()

    expect(rec.inserted).toHaveLength(1)
    expect(result).toMatchObject({ inserted: 1, skipped_dup: 1 })
  })

  it('indexes every existing row, not just the first 1000', async () => {
    // 2400 rows — the old single-shot select silently stopped at PostgREST's
    // 1000-row cap, leaving most of the catalogue invisible to deduplication.
    const many: OppRow[] = Array.from({ length: 2400 }, (_, i) => ({
      id: `opp-${i}`,
      title: `Role ${i}`,
      company_name: `Company ${i}`,
      apply_url: `https://example.com/jobs/${i}`,
      source: 'unstop',
      source_id: `U-${i}`,
    }))
    const { rec, client } = createFakeDb(many)

    // Ask it to refresh the very last row, which lives well past the cap.
    const provider = providerEmitting('unstop', [{ ...many[2399] }])

    await new OpportunityIngestionService([provider], client).runPipeline()

    expect(rec.preloadPages).toBeGreaterThanOrEqual(3) // 1000 + 1000 + 400
    expect(rec.updated).toHaveLength(1)
    expect(rec.updated[0].id).toBe('opp-2399')
  })

  it('reports updates in the run stats so a broken refresh is visible', async () => {
    const { client } = createFakeDb([EXISTING])
    const provider = providerEmitting('unstop', [{ ...EXISTING }])

    const result = await new OpportunityIngestionService([provider], client).runPipeline()

    expect(result.status).toBe('completed')
    if (result.status === 'completed') {
      expect(result.updated).toBe(1)
      expect(result.upserted).toBe(1)
      // A nightly run over a stable catalogue should be updates, not inserts.
      expect(result.inserted).toBe(0)
    }
  })
})
