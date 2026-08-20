/**
 * Validates a `?next=` redirect target.
 *
 * Both the login screen and the auth callback take a caller-supplied path and
 * send the user to it after authenticating, which is the classic open-redirect
 * shape: a link to our own login page that lands the user on someone else's
 * site, still trusting the URL bar.
 *
 * The two had grown separate copies of this check with different rules — the
 * callback's version accepted `/\evil.com`, which the login screen rejected,
 * and carried a `startsWith('\\')` clause that could never fire because a
 * leading `/` was already required. This is the single shared rule.
 *
 * Only same-origin absolute paths are honoured. Anything else — a full URL, a
 * protocol-relative `//host`, a backslash variant browsers may normalise into
 * one, or nothing at all — falls back to `fallback`.
 */
export const DEFAULT_NEXT_PATH = '/dashboard'

/** Control characters: used to smuggle past naive prefix checks, and to split headers. */
const CONTROL_CHARS = /[\u0000-\u001F\u007F]/

export function safeNextPath(
  next: string | null | undefined,
  fallback: string = DEFAULT_NEXT_PATH
): string {
  if (!next) return fallback

  // Must be an absolute path on this origin.
  if (!next.startsWith('/')) return fallback

  // `//host` and `/\host` are both read as protocol-relative URLs by at least
  // one browser or URL parser, so neither is a same-origin path. A backslash
  // anywhere can be normalised to `/` by WHATWG URL parsing, so rather than
  // reason about each parser, refuse the character outright.
  if (next.startsWith('//') || next.includes('\\')) return fallback

  if (CONTROL_CHARS.test(next)) return fallback

  return next
}
