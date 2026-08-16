import sanitizeHtml from 'sanitize-html'

/**
 * Notes content is stored as HTML (the rich editor's output) rather than
 * plain text. That HTML normally only ever comes from tiptap's own
 * schema-constrained editing, but the API is also reachable directly (bypassing
 * the editor entirely) — so every write still runs through an explicit
 * allowlist here, matching exactly what the editor's toolbar can produce and
 * nothing else, to close off a stored-XSS path a raw POST/PATCH could open.
 *
 * The rule for changing this file: an extension added to the editor must have
 * its rendered output allowed here in the same change, or its formatting is
 * silently destroyed on the first save — the failure is invisible at write
 * time and only shows up as the user's table/colour/link disappearing on
 * reload.
 *
 * Checklist items (@tiptap/extension-task-item) render as a specific fixed
 * structure — <li data-type data-checked><label><input><span></label>
 * <div>content</div></li> — and the tags/attributes for it are grouped below.
 */
export function sanitizeNoteContent(html: string): string {
  return sanitizeHtml(html, {
    allowedTags: [
      // Blocks
      'p', 'div', 'br', 'hr', 'blockquote', 'pre',
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      // Inline marks
      'strong', 'b', 'em', 'i', 'u', 's', 'del', 'code', 'mark', 'span', 'a', 'sub', 'sup',
      // Lists, including checklists
      'ul', 'ol', 'li', 'label', 'input',
      // Tables
      'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td', 'colgroup', 'col',
      // Media
      'img', 'figure', 'figcaption',
    ],
    allowedAttributes: {
      // width/height/data-align carry the editor's image resize and alignment
      // controls; without them a resized image silently snaps back on reload.
      img: ['src', 'alt', 'title', 'width', 'height', 'data-align', 'style'],
      a: ['href', 'target', 'rel', 'data-note-link', 'data-link-type', 'data-file-name', 'data-file-size'],
      ul: ['data-type'],
      ol: ['start', 'type'],
      li: ['data-type', 'data-checked'],
      input: ['type', 'checked', 'disabled'],
      p: ['style'],
      h1: ['style'], h2: ['style'], h3: ['style'], h4: ['style'], h5: ['style'], h6: ['style'],
      span: ['style', 'data-type'],
      mark: ['style', 'data-color'],
      code: ['class'],
      pre: ['class'],
      div: ['data-type'],
      table: ['style'],
      th: ['colspan', 'rowspan', 'colwidth', 'style'],
      td: ['colspan', 'rowspan', 'colwidth', 'style'],
      col: ['style'],
      figure: ['data-type'],
    },
    // The one place arbitrary CSS could otherwise get in. Every property is
    // pinned to a value pattern, so `style` can never carry url(), expression(),
    // position:fixed overlays, or anything else that escapes the note's own box.
    allowedStyles: {
      '*': {
        'text-align': [/^(left|right|center|justify)$/],
        'color': [/^#[0-9a-f]{3,8}$/i, /^rgb\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*\)$/i],
        'background-color': [/^#[0-9a-f]{3,8}$/i, /^rgb\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*\)$/i],
        'font-size': [/^\d{1,3}(\.\d+)?(px|pt|em|rem)$/],
        'line-height': [/^\d(\.\d+)?$/],
        'margin-left': [/^\d{1,3}px$/],
        'width': [/^\d{1,4}(px|%)$/],
        'height': [/^(auto|\d{1,4}px)$/],
        'min-width': [/^\d{1,4}px$/],
      },
    },
    // Images and files come from this project's own Supabase storage over
    // https; data: stays allowed because the drawing canvas hands the editor a
    // data URL for the instant between drawing and upload completing.
    allowedSchemes: ['https', 'data'],
    // A link is the one place a user types a URL by hand, so it gets the
    // wider — but still scheme-checked — set. javascript: is absent, which is
    // the whole point.
    allowedSchemesByTag: {
      a: ['https', 'http', 'mailto', 'tel'],
    },
    // Internal note links are relative ('/notes/<id>'), which sanitize-html
    // only preserves when relative URLs are explicitly permitted.
    allowedSchemesAppliedToAttributes: ['href', 'src'],
    allowProtocolRelative: false,
    transformTags: {
      // Every outbound link is forced to open safely regardless of what the
      // client sent: rel=noopener stops the opened page reaching back through
      // window.opener, and it is applied here rather than in the editor so a
      // direct API write cannot skip it.
      a: (tagName, attribs) => {
        const href = attribs.href ?? ''
        const isInternal = href.startsWith('/')
        return {
          tagName,
          attribs: {
            ...attribs,
            ...(isInternal ? {} : { target: '_blank', rel: 'noopener noreferrer nofollow' }),
          },
        }
      },
    },
  })
}
