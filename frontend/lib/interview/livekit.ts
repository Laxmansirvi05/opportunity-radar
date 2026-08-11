import { AccessToken } from 'livekit-server-sdk'

/**
 * Mints a LiveKit join token, server-side only — never in a route the
 * browser could call to get a token for an arbitrary room or identity.
 * `identity` is always the authenticated Supabase user id, and `room` is
 * always the external session id DeepInterview's own /api/prep returned
 * (OPPORTUNITY_RADAR_INTEGRATION.md §5: "The room name MUST be the
 * session_id"). Short-lived by design (LiveKit's default TTL) — a fresh
 * token is minted per join, never cached or reused across sessions.
 */
export async function mintInterviewToken(params: {
  room: string
  identity: string
  name: string
}): Promise<string> {
  const apiKey = process.env.LIVEKIT_API_KEY
  const apiSecret = process.env.LIVEKIT_API_SECRET
  if (!apiKey || !apiSecret) {
    throw new Error('LIVEKIT_API_KEY / LIVEKIT_API_SECRET are not configured')
  }

  const at = new AccessToken(apiKey, apiSecret, {
    identity: params.identity,
    name: params.name,
  })
  at.addGrant({
    room: params.room,
    roomJoin: true,
    canPublish: true,
    canSubscribe: true,
    canPublishData: true,
  })
  return at.toJwt()
}

export function livekitConfigured(): boolean {
  return Boolean(process.env.LIVEKIT_URL && process.env.LIVEKIT_API_KEY && process.env.LIVEKIT_API_SECRET)
}
