import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'

const APP_DIR = path.resolve(__dirname, '../app')

/**
 * Every file under `app/` that Next.js hands route params to. Only files on a
 * path containing a dynamic segment can receive them, so the walk keeps just
 * those — a `params` annotation anywhere else is somebody's own object.
 */
function dynamicRouteFiles(dir: string, hasDynamicAncestor = false): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      const dynamic = hasDynamicAncestor || entry.name.startsWith('[')
      out.push(...dynamicRouteFiles(full, dynamic))
    } else if (
      hasDynamicAncestor &&
      ['route.ts', 'route.tsx', 'page.tsx', 'layout.tsx'].includes(entry.name)
    ) {
      out.push(full)
    }
  }
  return out
}

/** Block and line comments describe past bugs; they are not type annotations. */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '')
}

describe('dynamic route params are awaited', () => {
  /**
   * The regression this exists for: `app/api/notifications/[id]/route.ts`
   * declared `{ params }: { params: { id: string } }` and read `params.id`
   * directly. In this version of Next.js `params` is a Promise, so `params.id`
   * was `undefined`, the delete went out as `id=eq.undefined` against a uuid
   * column, and deleting a notification returned 500 every single time — in
   * development as well as production. Nothing caught it: it is a type error,
   * but `typescript.ignoreBuildErrors` is on, so the build stayed green and the
   * only signal was a feature that had never once worked.
   *
   * A grep is the right shape of test here. The bug is not in any one handler's
   * logic, it is a convention that 26 of 27 handlers followed and one did not,
   * and the cost of the odd one out is a silently dead endpoint.
   */
  it('types every params annotation as a Promise', () => {
    const files = dynamicRouteFiles(APP_DIR)

    // Guard against the walk silently finding nothing if the layout moves.
    expect(files.length).toBeGreaterThan(10)

    const offenders = files.filter((file) => {
      const source = stripComments(readFileSync(file, 'utf8'))
      // `params:` in a type position that is not `params: Promise<...>`.
      return /\bparams\s*:\s*(?!Promise\b)[{A-Za-z]/.test(source)
    })

    expect(offenders.map((f) => path.relative(APP_DIR, f))).toEqual([])
  })

  /**
   * Typing it as a Promise but never awaiting it is the same bug wearing a
   * correct annotation, and it reads as fine at a glance.
   */
  it('awaits params in every file that declares them', () => {
    const files = dynamicRouteFiles(APP_DIR)

    const offenders = files.filter((file) => {
      const source = stripComments(readFileSync(file, 'utf8'))
      if (!/\bparams\s*:\s*Promise\b/.test(source)) return false
      return !/await\s+params\b/.test(source)
    })

    expect(offenders.map((f) => path.relative(APP_DIR, f))).toEqual([])
  })
})
