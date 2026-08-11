/**
 * Interviewer persona catalog — ported from DeepInterview's own
 * apps/web/lib/personas.ts (same 4 ids, names, and style copy; that file is
 * the source of truth if it ever changes).
 *
 * DeepInterview's real video avatars (Veo-rendered idle/speaking loops) are
 * themselves still placeholders with no rendered assets — its own live
 * setup screen shows blank boxes today. This uses a Material Symbols icon
 * + colour treatment per persona instead of trying to fake video that
 * doesn't exist anywhere yet.
 *
 * Confirmed by reading the agent's own code: persona choice is currently a
 * display-only concept — it does not change the interviewer's actual voice
 * or question style server-side (TTS voice selection is driven by
 * language, not persona, in apps/agent/src/deepinterview_agent/worker.py).
 * Presented here honestly as "interviewer style", not as something that
 * changes how the interview is conducted.
 */

export type PersonaId = 'anime' | 'superhero' | 'recruiter' | 'professor'

export interface Persona {
  id: PersonaId
  name: string
  style: string
  icon: string
  gradient: string
}

export const PERSONAS: Persona[] = [
  {
    id: 'anime',
    name: 'Mika',
    style: 'Bright, encouraging mentor who keeps the energy up.',
    icon: 'auto_awesome',
    gradient: 'from-pink-400/20 to-fuchsia-400/20',
  },
  {
    id: 'superhero',
    name: 'Vanguard',
    style: 'Bold coach who pushes you toward your best answer.',
    icon: 'bolt',
    gradient: 'from-amber-400/20 to-orange-400/20',
  },
  {
    id: 'recruiter',
    name: 'Dana',
    style: 'Calm, professional — true-to-life screening tone.',
    icon: 'work',
    gradient: 'from-blue-400/20 to-cyan-400/20',
  },
  {
    id: 'professor',
    name: 'Dr. Chen',
    style: 'Thoughtful and precise, probes deeply on fundamentals.',
    icon: 'school',
    gradient: 'from-violet-400/20 to-indigo-400/20',
  },
]

export const DEFAULT_PERSONA_ID: PersonaId = 'recruiter'

export function getPersona(id: string | null | undefined): Persona {
  return PERSONAS.find((p) => p.id === id) ?? PERSONAS.find((p) => p.id === DEFAULT_PERSONA_ID)!
}
