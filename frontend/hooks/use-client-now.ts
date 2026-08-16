'use client'

import { useEffect, useState } from 'react'

/**
 * The current time, but only after hydration.
 *
 * Reading the clock during render is a real, live-reproduced hydration bug in
 * this codebase (APP-15): the server renders once, the client hydrates a
 * moment later, and if those two reads land either side of a boundary the
 * rendered text differs and React throws #418. Returning null until after
 * mount makes the server render and the client's first render identical, and
 * the real value fills in a frame later.
 *
 * Callers render nothing (or an absolute date) while this is null.
 *
 * The same pattern is inlined in tracker-board.tsx and hub-message.tsx, which
 * predate this shared hook; they are left alone rather than refactored in an
 * unrelated change.
 */
export function useClientNow(): number | null {
  const [now, setNow] = useState<number | null>(null)
  // This IS the fix for the hydration mismatch described above, not the bug
  // the rule normally guards against — there is no server-safe value here.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setNow(Date.now()), [])
  return now
}
