/**
 * Carries the just-signed-up address from the signup form to /verify-email,
 * so that page can offer a real "resend" without asking for it again.
 *
 * sessionStorage rather than a query parameter: an email address in the URL
 * ends up in browser history, referrer headers and server logs, which is a
 * needless place for it to sit. sessionStorage also clears itself when the tab
 * closes, which is exactly the lifetime this needs.
 *
 * Every access is guarded — storage throws rather than returning null when it
 * is disabled (private browsing, blocked cookies), and a signup must not fail
 * because of that.
 */
const PENDING_VERIFICATION_EMAIL_KEY = 'pending-verification-email'

export function setPendingVerificationEmail(email: string): void {
  try {
    sessionStorage.setItem(PENDING_VERIFICATION_EMAIL_KEY, email)
  } catch {
    // Non-fatal: /verify-email falls back to its no-address state.
  }
}

export function readPendingVerificationEmail(): string | null {
  try {
    return sessionStorage.getItem(PENDING_VERIFICATION_EMAIL_KEY)
  } catch {
    return null
  }
}

export function clearPendingVerificationEmail(): void {
  try {
    sessionStorage.removeItem(PENDING_VERIFICATION_EMAIL_KEY)
  } catch {
    // Nothing to clean up if storage was never available.
  }
}
