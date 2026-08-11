import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { mintInterviewToken, livekitConfigured } from '@/lib/interview/livekit'
import { messageForCode } from '@/lib/interview/agent-client'

/**
 * POST /api/interview/:sessionId/token — mint a LiveKit join token.
 *
 * Deliberately no general-purpose token endpoint: a caller cannot mint a
 * token for an arbitrary room or identity. This one only ever mints for the
 * caller's OWN session (ownership-checked below), with `identity` pinned to
 * their authenticated Supabase user id and `room` pinned to the external
 * session id DeepInterview's own /api/prep returned — never values the
 * client supplies.
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: { code: 'UNAUTHORIZED', message: 'Please sign in.' } }, { status: 401 })
  }

  if (!livekitConfigured()) {
    return NextResponse.json(
      { error: { code: 'AGENT_UNREACHABLE', message: messageForCode('AGENT_UNREACHABLE') } },
      { status: 503 }
    )
  }

  const { data: session } = await supabase
    .from('interview_sessions')
    .select('id, external_session_id, status')
    .eq('id', sessionId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (!session?.external_session_id) {
    return NextResponse.json(
      { error: { code: 'SESSION_NOT_FOUND', message: messageForCode('SESSION_NOT_FOUND') } },
      { status: 404 }
    )
  }

  if (session.status !== 'pending' && session.status !== 'in_progress') {
    return NextResponse.json(
      { error: { code: 'SESSION_NOT_FOUND', message: 'This interview has already ended.' } },
      { status: 409 }
    )
  }

  const token = await mintInterviewToken({
    room: session.external_session_id,
    identity: user.id,
    name: user.email ?? user.id,
  })

  return NextResponse.json({
    token,
    url: process.env.LIVEKIT_URL,
    room: session.external_session_id,
  })
}
