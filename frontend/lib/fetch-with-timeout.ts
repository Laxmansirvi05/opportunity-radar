/**
 * A plain `fetch()` with no timeout leaves a slow or dropped connection
 * indistinguishable from a UI that's simply frozen — the caller sees nothing
 * until the browser's own (often very long, sometimes effectively unbounded)
 * connection timeout eventually fires, if it ever does. AI-backed routes can
 * legitimately take 20-60s+ depending on provider fallback, so this needs to
 * be generous — the point isn't to cut off a slow-but-working request, it's
 * to guarantee the user gets SOME answer instead of an indefinite spinner.
 */
export async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit = {},
  timeoutMs = 90_000
): Promise<Response> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

  try {
    return await fetch(input, { ...init, signal: controller.signal })
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new Error(
        `This is taking longer than expected (over ${Math.round(timeoutMs / 1000)}s) and was stopped. This can happen when multiple AI providers are slow to respond — please try again.`
      )
    }
    throw err
  } finally {
    clearTimeout(timeoutId)
  }
}
