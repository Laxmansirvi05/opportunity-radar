/**
 * True when a parsed résumé carries none of the sections that make it a
 * résumé: no experience, education, skills or projects.
 *
 * Used to reject an AI parse that "succeeded" on a truncated answer. The
 * shape is the Reactive Resume document: sections.<name>.items[].
 */
export function isHollowResume(data: unknown): boolean {
  const sections = (data as { sections?: Record<string, { items?: unknown }> } | null)?.sections
  if (!sections || typeof sections !== 'object') return true
  return ['experience', 'education', 'skills', 'projects'].every((name) => {
    const items = sections[name]?.items
    return !Array.isArray(items) || items.length === 0
  })
}
