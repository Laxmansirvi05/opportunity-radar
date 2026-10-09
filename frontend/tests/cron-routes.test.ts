import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, existsSync } from 'node:fs'
import path from 'node:path'

const CRON_DIR = path.resolve(__dirname, '../app/api/cron')
const VERCEL_JSON = path.resolve(__dirname, '../vercel.json')

/**
 * Structural cover for the /api/cron/* surface.
 *
 * tests/cron-auth.test.ts proves denyIfNotCron behaves correctly. It cannot
 * prove that a route actually calls it, and that was the real gap: two routes
 * — sweep-interviews and purge-interviews — kept a hand-rolled gate reading
 *
 *   if (cronSecret && req.headers.get('authorization') !== `Bearer ${secret}`)
 *
 * where the `cronSecret &&` short-circuit skipped authorisation entirely
 * whenever CRON_SECRET was unset. Both then used the service-role key to hard
 * delete or mass-update interview sessions. Ten sibling routes had already been
 * migrated to the shared guard; nothing noticed the two that had not.
 *
 * These are greps rather than behavioural tests on purpose. The invariant is
 * "every route in this directory follows the convention", and that is a property
 * of the directory, not of any one handler.
 */

function cronRoutes(): { name: string; file: string; source: string }[] {
  return readdirSync(CRON_DIR, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => ({ name: e.name, file: path.join(CRON_DIR, e.name, 'route.ts') }))
    .filter((r) => existsSync(r.file))
    .map((r) => ({ ...r, source: readFileSync(r.file, 'utf8') }))
}

/** Comments quote the old broken patterns; they are not code. */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '')
}

describe('cron route conventions', () => {
  const routes = cronRoutes()

  it('finds the cron routes', () => {
    // Guard against a directory move turning every test below vacuous.
    expect(routes.length).toBeGreaterThan(8)
  })

  it('authorises every route through the shared fail-closed guard', () => {
    const offenders = routes
      .filter((r) => !stripComments(r.source).includes('denyIfNotCron('))
      .map((r) => r.name)
    expect(offenders).toEqual([])
  })

  /**
   * The specific shape that broke: any inline comparison against CRON_SECRET
   * is a hand-rolled gate, and every hand-rolled version of this so far has
   * been wrong in one of two ways — fail-open on an unset secret, or a
   * non-constant-time `!==`.
   */
  it('leaves no hand-rolled CRON_SECRET check anywhere', () => {
    const offenders = routes
      .filter((r) => /CRON_SECRET/.test(stripComments(r.source)))
      .map((r) => r.name)
    expect(offenders).toEqual([])
  })

  /**
   * Vercel Cron issues GET. A route exporting only POST is not "protected", it
   * is unreachable: the scheduled job 405s and the work silently never happens.
   * That is how the 30-day retention policy on voice transcripts — the most
   * sensitive data in the product — went unenforced for its whole life.
   */
  it('exports GET from every route', () => {
    const offenders = routes
      .filter((r) => !/export\s+async\s+function\s+GET\b/.test(r.source))
      .map((r) => r.name)
    expect(offenders).toEqual([])
  })

  it('runs the guard before constructing any Supabase client', () => {
    const offenders = routes
      .filter((r) => {
        const src = stripComments(r.source)
        const guard = src.indexOf('denyIfNotCron(')
        const client = src.indexOf('createClient(')
        if (guard === -1 || client === -1) return false
        return client < guard
      })
      .map((r) => r.name)
    expect(offenders).toEqual([])
  })
})

describe('vercel.json cron schedules', () => {
  const config = JSON.parse(readFileSync(VERCEL_JSON, 'utf8'))
  const crons: { path: string; schedule: string }[] = config.crons ?? []

  it('points every schedule at a route that exists on disk', () => {
    const onDisk = new Set(cronRoutes().map((r) => `/api/cron/${r.name}`))
    const missing = crons.map((c) => c.path).filter((p) => !onDisk.has(p))
    expect(missing).toEqual([])
  })

  /**
   * This project is on the Hobby plan, which permits once-daily crons only. A
   * more frequent schedule is not throttled — it fails the deployment, so a
   * stray `*` in the minute field takes production down rather than degrading
   * anything. A comment in sweep-interviews recommended a fifteen-minute
   * schedule long after that had been established as build-breaking.
   */
  it('schedules nothing more often than once a day', () => {
    const tooOften = crons.filter((c) => {
      const [minute, hour] = c.schedule.split(/\s+/)
      // Both minute and hour must name a single fixed value; anything else
      // (`*`, a list, a step, a range) fires more than once per day.
      return !/^\d+$/.test(minute) || !/^\d+$/.test(hour)
    })
    expect(tooOften.map((c) => `${c.path} (${c.schedule})`)).toEqual([])
  })

  it('gives every schedule five cron fields', () => {
    const malformed = crons.filter((c) => c.schedule.trim().split(/\s+/).length !== 5)
    expect(malformed.map((c) => c.path)).toEqual([])
  })
})
