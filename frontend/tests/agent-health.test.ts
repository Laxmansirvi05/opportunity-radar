import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { checkAgents } from '@/lib/agent-health'

/**
 * The two AI features depend on services this app does not run, and the only
 * signal that one of them is misaddressed used to be a student clicking Start
 * and getting an error. These cases are the failure modes that actually
 * happened, not hypotheticals: an unset variable, and a localhost address left
 * over from development.
 */

const ORIGINAL = { ...process.env }

beforeEach(() => {
  vi.restoreAllMocks()
})

afterEach(() => {
  process.env = { ...ORIGINAL }
})

function setUrls(ai: string | undefined, interview: string | undefined) {
  if (ai === undefined) delete process.env.AI_AGENT_URL
  else process.env.AI_AGENT_URL = ai
  if (interview === undefined) delete process.env.INTERVIEW_AGENT_URL
  else process.env.INTERVIEW_AGENT_URL = interview
}

describe('checkAgents', () => {
  it('reports an unset variable as unconfigured, and names the variable', async () => {
    setUrls(undefined, undefined)
    const { healthy, probes } = await checkAgents()

    expect(healthy).toBe(false)
    expect(probes).toHaveLength(2)
    for (const p of probes) {
      expect(p.configured).toBe(false)
      expect(p.reachable).toBe(false)
      expect(p.detail).toContain(p.variable)
    }
  })

  /**
   * The specific mistake worth catching. A loopback address resolves fine and
   * would otherwise read as an ordinary connection error, which sends whoever
   * is debugging it looking at the agent instead of at the variable.
   */
  it('diagnoses a localhost address without attempting a request', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    setUrls('http://localhost:4300', 'http://127.0.0.1:8000')

    const { healthy, probes } = await checkAgents()

    expect(healthy).toBe(false)
    expect(fetchSpy).not.toHaveBeenCalled()
    expect(probes[0].host).toBe('localhost:4300')
    expect(probes[0].detail).toMatch(/this server, not the agent/)
    expect(probes[1].detail).toMatch(/this server, not the agent/)
  })

  it('treats any HTTP answer as reachable, including 401 and 404', async () => {
    setUrls('https://agent.example.com', 'https://interview.example.com')
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(null, { status: 401 }))
      .mockResolvedValueOnce(new Response(null, { status: 404 }))

    const { healthy, probes } = await checkAgents()

    expect(healthy).toBe(true)
    expect(probes[0]).toMatchObject({ reachable: true, status: 401, host: 'agent.example.com' })
    expect(probes[1]).toMatchObject({ reachable: true, status: 404 })
  })

  it('reports a refused connection as unreachable rather than throwing', async () => {
    setUrls('https://agent.example.com', 'https://interview.example.com')
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('fetch failed'))

    const { healthy, probes } = await checkAgents()

    expect(healthy).toBe(false)
    expect(probes[0].reachable).toBe(false)
    expect(probes[0].detail).toMatch(/refused the connection|could not be resolved/)
  })

  it('is unhealthy when only one of the two is down', async () => {
    setUrls('https://agent.example.com', 'https://interview.example.com')
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(null, { status: 200 }))
      .mockRejectedValueOnce(new TypeError('fetch failed'))

    const { healthy, probes } = await checkAgents()

    expect(healthy).toBe(false)
    expect(probes.filter((p) => p.reachable)).toHaveLength(1)
  })

  it('never reports more than the host, so a URL carrying a path or token stays out of the report', async () => {
    setUrls('https://agent.example.com/internal/abc123?token=secret', undefined)
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 200 }))

    const { probes } = await checkAgents()

    expect(probes[0].host).toBe('agent.example.com')
    expect(JSON.stringify(probes)).not.toContain('abc123')
    expect(JSON.stringify(probes)).not.toContain('secret')
  })

  it('rejects a malformed URL without treating it as reachable', async () => {
    setUrls('not-a-url', undefined)
    const { probes } = await checkAgents()

    expect(probes[0]).toMatchObject({ configured: true, reachable: false, host: null })
    expect(probes[0].detail).toMatch(/not a valid URL/)
  })
})
