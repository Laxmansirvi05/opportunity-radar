/**
 * Minimal fake of the Supabase SSR client, for testing the actual Next.js
 * route handlers rather than only the lib functions they call.
 *
 * Every query builder call (select/insert/update/eq/order/limit/single) is
 * recorded and returns the same chain object; resolving the chain (it's
 * thenable, matching supabase-js) hands the full call trail to a per-test
 * `responder` so each test controls exactly what each table+operation
 * returns without needing a real database.
 */

export interface RecordedCall {
  op: string
  args: unknown[]
}

export interface QueryCall {
  table: string
  op: 'select' | 'insert' | 'upsert' | 'update' | 'delete'
  trail: RecordedCall[]
}

export type Responder = (call: QueryCall) => { data: unknown; error: unknown }

const PRIMARY_OPS = ['select', 'insert', 'upsert', 'update', 'delete'] as const

function makeChain(table: string, responder: Responder) {
  const trail: RecordedCall[] = []
  // Every filter the routes actually chain. A method missing here fails as
  // "x.is is not a function" at the call site rather than as a clear test
  // failure, so the list is kept in step with the routes deliberately.
  const methods = [
    'select', 'insert', 'update', 'delete', 'upsert',
    'eq', 'neq', 'in', 'or', 'is', 'not', 'ilike', 'contains',
    'order', 'limit', 'range', 'single', 'maybeSingle',
  ] as const

  const chain: Record<string, unknown> = {}
  for (const m of methods) {
    chain[m] = (...args: unknown[]) => {
      trail.push({ op: m, args })
      return chain
    }
  }
  chain.then = (resolve: (v: { data: unknown; error: unknown }) => void) => {
    const primary = trail.find((c) => (PRIMARY_OPS as readonly string[]).includes(c.op))
    const op = (primary?.op ?? 'select') as QueryCall['op']
    resolve(responder({ table, op, trail }))
  }
  return chain
}

export function makeFakeSupabase(opts: {
  userId: string | null
  responder: Responder
}) {
  return {
    auth: {
      getUser: async () => ({
        data: { user: opts.userId ? { id: opts.userId } : null },
      }),
    },
    from: (table: string) => makeChain(table, opts.responder),
  }
}

/** Convenience: pull the value passed to a given .eq()/.in() call by column name. */
export function eqValue(trail: RecordedCall[], column: string): unknown {
  const call = trail.find((c) => (c.op === 'eq' || c.op === 'in') && c.args[0] === column)
  return call?.args[1]
}

/** Convenience: the payload object passed to .insert()/.upsert()/.update(). */
export function payloadOf(trail: RecordedCall[]): Record<string, unknown> {
  const call = trail.find((c) => c.op === 'insert' || c.op === 'upsert' || c.op === 'update')
  return (call?.args[0] as Record<string, unknown>) ?? {}
}
