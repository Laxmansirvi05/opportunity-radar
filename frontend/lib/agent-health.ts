/**
 * Reachability probe for the two external services the AI features depend on.
 *
 * AI Search and the voice interview are the only features in this app whose
 * failure mode lives entirely outside it: both post to a separate service
 * addressed by an environment variable, and if that variable points somewhere
 * dead the feature fails at the moment a student clicks Start. Nothing else
 * notices — the schema guard checks the database, not these.
 *
 * That gap was real. Both URLs sat at `http://localhost:...` in development
 * for weeks, which is unreachable from a deployment, and the only way to find
 * out was to try the feature by hand.
 *
 * What this deliberately does NOT do is exercise the agents' real endpoints.
 * Starting a prep run or a search costs provider quota and minutes of compute,
 * so a health check that did so would be worse than no health check. It asks
 * only whether something answers at that address.
 */

/** Hard ceiling per probe. A health check must never hang the caller. */
const PROBE_TIMEOUT_MS = 5000

export type AgentProbe = {
  name: string
  /** The env var that carries the address, for a report that names the fix. */
  variable: string
  configured: boolean
  reachable: boolean
  /** Host only — never the full URL, which can carry a path or a token. */
  host: string | null
  /** HTTP status, or null when nothing answered. */
  status: number | null
  detail: string
}

/**
 * A localhost address in a deployed environment is the specific mistake this
 * exists to catch, so it is reported as its own diagnosis rather than as a
 * generic connection failure.
 */
function isLoopback(host: string): boolean {
  const h = host.toLowerCase().split(':')[0]
  return h === 'localhost' || h === '127.0.0.1' || h === '0.0.0.0' || h === '::1' || h.endsWith('.local')
}

async function probe(name: string, variable: string): Promise<AgentProbe> {
  const raw = process.env[variable]

  if (!raw || raw.trim().length === 0) {
    return {
      name, variable, configured: false, reachable: false, host: null, status: null,
      detail: `${variable} is not set on this deployment.`,
    }
  }

  let host: string
  try {
    host = new URL(raw).host
  } catch {
    return {
      name, variable, configured: true, reachable: false, host: null, status: null,
      detail: `${variable} is not a valid URL.`,
    }
  }

  if (isLoopback(host)) {
    return {
      name, variable, configured: true, reachable: false, host, status: null,
      detail: `${variable} points at ${host}, which is this server, not the agent. Set it to the agent's public address.`,
    }
  }

  // Any answer at all is the signal — a 401/404 still proves something is
  // listening and reachable, which is what a misconfigured URL cannot produce.
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS)
  try {
    const res = await fetch(raw, { method: 'GET', signal: controller.signal, redirect: 'manual' })
    return {
      name, variable, configured: true, reachable: true, host, status: res.status,
      detail: `${host} answered ${res.status}.`,
    }
  } catch (err) {
    const aborted = err instanceof Error && err.name === 'AbortError'
    return {
      name, variable, configured: true, reachable: false, host, status: null,
      detail: aborted
        ? `${host} did not answer within ${PROBE_TIMEOUT_MS}ms.`
        : `${host} refused the connection or could not be resolved.`,
    }
  } finally {
    clearTimeout(timer)
  }
}

export async function checkAgents(): Promise<{ healthy: boolean; probes: AgentProbe[] }> {
  const probes = await Promise.all([
    probe('AI Search agent', 'AI_AGENT_URL'),
    probe('Interview agent', 'INTERVIEW_AGENT_URL'),
  ])
  return { healthy: probes.every((p) => p.reachable), probes }
}
