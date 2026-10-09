import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'

const MIGRATIONS_DIR = path.resolve(__dirname, '../../supabase/migrations')

/** Strip `--` line comments so commented-out SQL is not read as a live policy. */
function stripComments(sql: string): string {
  return sql.replace(/--[^\n]*/g, '')
}

// Policy bodies contain no semicolons, so a non-greedy run up to the first one
// captures exactly the definition. `drop` matches the same shape with an empty
// body.
const POLICY_RE =
  /\b(create|drop)\s+policy\s+(?:if\s+exists\s+)?"([^"]+)"\s+on\s+storage\.objects\b([\s\S]*?);/gi

/**
 * Replay the migrations in the order Supabase applies them (alphabetical) and
 * return the `storage.objects` policies still standing at the end.
 *
 * Reading a single migration is not enough to know what is in force, which is
 * the whole reason these tests exist. Migrations are append-only, so a fixed
 * policy leaves the broken version in the history forever, and — as below — a
 * supersede that misspells the name leaves the broken version *live*.
 */
function effectiveStoragePolicies(): Map<string, { file: string; body: string }> {
  const files = readdirSync(MIGRATIONS_DIR)
    .filter((name) => name.endsWith('.sql'))
    .sort()

  const live = new Map<string, { file: string; body: string }>()
  for (const file of files) {
    const sql = stripComments(readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8'))
    for (const [, verb, name, body] of sql.matchAll(POLICY_RE)) {
      if (verb.toLowerCase() === 'drop') live.delete(name)
      else live.set(name, { file, body })
    }
  }
  return live
}

/** `<file>: <policy name>`, so a failure names the migration to go and edit. */
function locate(entries: Iterable<[string, { file: string; body: string }]>): string[] {
  return [...entries].map(([name, p]) => `${p.file}: ${name}`).sort()
}

describe('storage.objects policies', () => {
  const live = effectiveStoragePolicies()

  it('finds the policies at all', () => {
    // Guards against the walk silently matching nothing — every assertion below
    // is an "all of them" check and would pass vacuously on an empty map.
    expect(live.size).toBeGreaterThan(10)
  })

  /**
   * The regression this exists for. Six policies were keyed on `auth.uid() =
   * owner`, which grants on "you uploaded this" and says nothing about *where*
   * it was uploaded to — while all the application code writes to `<uid>/…` and
   * assumes the path is what is enforced.
   *
   * For `resumes` that was a permanent lockout: `profile-manager.tsx` upserts to
   * the fixed path `<uid>/resume.pdf`, so anyone could plant a file there, and
   * the owner check then denied the real user the update, the read *and* the
   * delete. For `avatars` it was an open upload into a world-readable bucket
   * with no size or MIME limit.
   *
   * The `avatars` four are also the reason this test replays history instead of
   * grepping: 20260809122000 meant to replace them and dropped
   * `"Users can upload their own avatar."` where init_schema had created
   * `"Users can upload their own avatars"` — singular versus plural, plus a
   * trailing period. The drop missed, and because RLS policies are permissive
   * and OR'd together, the weaker policy kept granting alongside the new one.
   * Nothing looked wrong in either migration read on its own.
   *
   * `owner` is also deprecated in Supabase Storage in favour of `owner_id`.
   */
  it('scopes to the object path, never to the uploader', () => {
    const ownerKeyed = [...live].filter(([, p]) => /\bowner\b/i.test(p.body))
    expect(locate(ownerKeyed)).toEqual([])
  })

  /**
   * Anything narrowing to a single user must do it through the path, so that the
   * `<uid>/` prefix the upload routes all write is the thing actually enforced.
   * Role-gated policies (`get_user_role() = 'admin'`) and open public-read
   * policies are untouched by this — they do not reference `auth.uid()`.
   *
   * A future policy could legitimately scope by joining another table instead.
   * That is fine, but it should be a decision someone makes on purpose, which is
   * what failing here forces.
   */
  it('narrows to a user only via storage.foldername', () => {
    const notPathScoped = [...live].filter(
      ([, p]) => /auth\.uid\(\)/i.test(p.body) && !/storage\.foldername/i.test(p.body)
    )
    expect(locate(notPathScoped)).toEqual([])
  })
})
