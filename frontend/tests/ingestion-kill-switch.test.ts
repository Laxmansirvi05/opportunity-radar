import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  OpportunityIngestionService,
  isPipelineDisabled,
} from '@/src/providers/opportunities/ingestion/OpportunityIngestionService'

/**
 * Regression cover for the ingestion kill switch (audit item A2).
 *
 * The pipeline sat switched off in production for weeks because
 * ENABLE_OPP_INGESTION was never set, and — worse — the cron endpoint still
 * answered HTTP 200 with `success: true`, so nothing ever looked broken.
 *
 * These tests pin down both halves of that failure: the switch itself, and the
 * requirement that a refused run is *loudly* recorded rather than silent.
 */

type InsertPayload = Record<string, unknown>

interface LoggedInsert {
  table: string
  payload: InsertPayload
}

type QueryResult = { data: unknown[]; error: null }

/** The subset of the Supabase query builder that runPipeline() actually calls. */
interface QueryBuilderStub {
  select: () => QueryBuilderStub
  insert: (payload: InsertPayload) => QueryBuilderStub
  update: () => QueryBuilderStub
  delete: () => QueryBuilderStub
  upsert: () => QueryBuilderStub
  eq: () => QueryBuilderStub
  in: () => QueryBuilderStub
  not: () => QueryBuilderStub
  lt: () => QueryBuilderStub
  ilike: () => QueryBuilderStub
  order: () => QueryBuilderStub
  range: (from: number, to: number) => QueryBuilderStub
  limit: () => QueryBuilderStub
  maybeSingle: () => QueryBuilderStub
  single: () => QueryBuilderStub
  then: (resolve: (value: QueryResult) => void) => void
}

/**
 * Minimal thenable stub of the Supabase client. Every query-builder method
 * returns itself, and awaiting the builder resolves to `{ data, error }`, which
 * covers the handful of chains runPipeline() uses.
 */
function createDbStub(selectData: unknown[] = []) {
  const inserts: LoggedInsert[] = []
  let currentTable = ''

  const builder: QueryBuilderStub = {
    select: () => builder,
    insert: (payload) => {
      inserts.push({ table: currentTable, payload })
      return builder
    },
    update: () => builder,
    delete: () => builder,
    upsert: () => builder,
    eq: () => builder,
    in: () => builder,
    not: () => builder,
    lt: () => builder,
    ilike: () => builder,
    order: () => builder,
    range: () => builder,
    limit: () => builder,
    maybeSingle: () => builder,
    single: () => builder,
    then: (resolve) => resolve({ data: selectData, error: null }),
  }

  return {
    inserts,
    client: {
      from: (table: string) => {
        currentTable = table
        return builder
      },
    },
  }
}

/** A provider that records whether it was ever asked to fetch anything. */
function createSpyProvider() {
  const fetchSpy = vi.fn(async (): Promise<unknown[]> => [])
  const provider = {
    fetchListPages: async () => [],
    fetchDetailPage: async () => ({}),
    fetch: fetchSpy,
    normalize: (raw: unknown) => raw,
    validate: () => true,
  }
  // The service only ever calls the members declared above, so this narrow
  // stub is a faithful stand-in for a real OpportunityProvider.
  return { fetchSpy, provider: provider as unknown as ConstructorParameters<
    typeof OpportunityIngestionService
  >[0][number] }
}

describe('ingestion kill switch', () => {
  beforeEach(() => {
    vi.unstubAllEnvs()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  describe('isIngestionEnabled', () => {
    it('refuses to run in production when the flag is unset', () => {
      vi.stubEnv('NODE_ENV', 'production')
      vi.stubEnv('ENABLE_OPP_INGESTION', '')
      expect(OpportunityIngestionService.isIngestionEnabled()).toBe(false)
    })

    it('refuses to run in production when the flag is not exactly "true"', () => {
      vi.stubEnv('NODE_ENV', 'production')
      for (const value of ['1', 'yes', 'TRUE', 'True', 'false']) {
        vi.stubEnv('ENABLE_OPP_INGESTION', value)
        expect(OpportunityIngestionService.isIngestionEnabled()).toBe(false)
      }
    })

    it('runs in production when the flag is exactly "true"', () => {
      vi.stubEnv('NODE_ENV', 'production')
      vi.stubEnv('ENABLE_OPP_INGESTION', 'true')
      expect(OpportunityIngestionService.isIngestionEnabled()).toBe(true)
    })

    it('runs outside production without any flag, so local dev needs no setup', () => {
      vi.stubEnv('NODE_ENV', 'development')
      vi.stubEnv('ENABLE_OPP_INGESTION', '')
      expect(OpportunityIngestionService.isIngestionEnabled()).toBe(true)
    })

    it('always allows dry runs, even in production with the flag off', () => {
      vi.stubEnv('NODE_ENV', 'production')
      vi.stubEnv('ENABLE_OPP_INGESTION', '')
      expect(OpportunityIngestionService.isIngestionEnabled(true)).toBe(true)
    })
  })

  describe('runPipeline when disabled', () => {
    it('returns a disabled result and never touches the providers', async () => {
      vi.stubEnv('NODE_ENV', 'production')
      vi.stubEnv('ENABLE_OPP_INGESTION', '')

      const { client } = createDbStub()
      const { fetchSpy, provider } = createSpyProvider()

      const result = await new OpportunityIngestionService([provider], client).runPipeline()

      expect(isPipelineDisabled(result)).toBe(true)
      expect(result.status).toBe('disabled')
      expect(fetchSpy).not.toHaveBeenCalled()
    })

    it('records the refused run in ingestion_logs so health checks can see it', async () => {
      vi.stubEnv('NODE_ENV', 'production')
      vi.stubEnv('ENABLE_OPP_INGESTION', '')

      const { client, inserts } = createDbStub()
      const { provider } = createSpyProvider()

      await new OpportunityIngestionService([provider], client).runPipeline()

      const logRows = inserts.filter((row) => row.table === 'ingestion_logs')
      expect(logRows).toHaveLength(1)
      expect(logRows[0].payload.status).toBe('DISABLED')
      expect(logRows[0].payload.error_message).toContain('ENABLE_OPP_INGESTION')
    })

    it('names ENABLE_OPP_INGESTION in the reason so the fix is obvious', async () => {
      vi.stubEnv('NODE_ENV', 'production')
      vi.stubEnv('ENABLE_OPP_INGESTION', '')

      const { client } = createDbStub()
      const { provider } = createSpyProvider()

      const result = await new OpportunityIngestionService([provider], client).runPipeline()

      expect(isPipelineDisabled(result) && result.reason).toContain('ENABLE_OPP_INGESTION')
    })
  })

  describe('runPipeline when enabled', () => {
    it('actually invokes the providers once the flag is set', async () => {
      vi.stubEnv('NODE_ENV', 'production')
      vi.stubEnv('ENABLE_OPP_INGESTION', 'true')

      const { client } = createDbStub()
      const { fetchSpy, provider } = createSpyProvider()

      const result = await new OpportunityIngestionService([provider], client).runPipeline()

      expect(fetchSpy).toHaveBeenCalledTimes(1)
      expect(isPipelineDisabled(result)).toBe(false)
      expect(result.status).toBe('completed')
    })

    it('does not write a DISABLED log row on a real run', async () => {
      vi.stubEnv('NODE_ENV', 'production')
      vi.stubEnv('ENABLE_OPP_INGESTION', 'true')

      const { client, inserts } = createDbStub()
      const { provider } = createSpyProvider()

      await new OpportunityIngestionService([provider], client).runPipeline()

      const disabledRows = inserts.filter(
        (row) => row.table === 'ingestion_logs' && row.payload.status === 'DISABLED'
      )
      expect(disabledRows).toHaveLength(0)
    })
  })
})
