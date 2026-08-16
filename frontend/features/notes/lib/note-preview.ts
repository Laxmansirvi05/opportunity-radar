import type { NotePreview } from '../types'

const SNIPPET_MAX = 160

/**
 * Strips tags to plain text for previews and search highlighting.
 *
 * Regex rather than DOMParser on purpose: this runs on the server (where
 * there is no DOM) and inside list rendering (where allocating a parser per
 * card would be wasteful). It is a *display* helper only — the content it
 * reads has already been through sanitizeNoteContent on write, so this is
 * never the thing standing between a script tag and the page.
 */
export function stripHtml(html: string): string {
  return html
    // A block boundary is a word boundary — without this, "</p><p>" would
    // fuse the last word of one paragraph to the first of the next.
    .replace(/<\/(p|div|li|h[1-6]|tr|blockquote|pre)>/gi, ' ')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
}

export function toSnippet(html: string, max = SNIPPET_MAX): string {
  const text = stripHtml(html)
  if (text.length <= max) return text
  // Cut on a word boundary rather than mid-word, but only if one is close
  // enough that we aren't throwing away most of the snippet to find it.
  const cut = text.slice(0, max)
  const lastSpace = cut.lastIndexOf(' ')
  return `${lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut}…`
}

/** First inline image in the document, used as a card thumbnail. */
export function firstImageUrl(html: string): string | null {
  const match = html.match(/<img[^>]+src=["']([^"']+)["']/i)
  return match ? match[1] : null
}

/** Checklist progress for a card badge, or null when the note has no checklist. */
export function checklistProgress(html: string): { done: number; total: number } | null {
  const items = html.match(/data-checked=["'](true|false)["']/gi)
  if (!items || items.length === 0) return null
  const done = items.filter((item) => /true/i.test(item)).length
  return { done, total: items.length }
}

export function hasAttachmentMarkup(html: string): boolean {
  return /<img\b/i.test(html) || /data-note-file=/i.test(html)
}

interface PreviewSource {
  id: string
  title: string
  content: string
  updated_at: string
  is_pinned: boolean
}

export function toNotePreview(row: PreviewSource): NotePreview {
  return {
    id: row.id,
    title: row.title,
    snippet: toSnippet(row.content ?? ''),
    image_url: firstImageUrl(row.content ?? ''),
    updated_at: row.updated_at,
    is_pinned: row.is_pinned,
  }
}
