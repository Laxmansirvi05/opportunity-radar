import { Node, mergeAttributes } from '@tiptap/core'

export interface FileAttachmentAttributes {
  href: string
  'data-file-name': string
  'data-file-size': string
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    fileAttachment: {
      insertFileAttachment: (attributes: { href: string; name: string; size: number }) => ReturnType
    }
  }
}

function formatSize(bytes: number): string {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

/**
 * A non-image attachment (PDF, doc, spreadsheet…) rendered as a chip in the
 * document flow.
 *
 * It serialises to a plain anchor carrying data-* attributes rather than a
 * bespoke tag, for two reasons: sanitizeNoteContent already allows exactly
 * this shape, and the read-only shared-note view renders stored HTML with no
 * editor loaded — so the chip has to still be a working link on its own.
 */
export const FileAttachment = Node.create({
  name: 'fileAttachment',
  group: 'block',
  atom: true,
  draggable: true,
  selectable: true,

  addAttributes() {
    return {
      href: { default: null },
      'data-file-name': { default: 'Attachment' },
      'data-file-size': { default: '' },
    }
  },

  parseHTML() {
    return [{ tag: 'a[data-note-file]' }]
  },

  renderHTML({ HTMLAttributes }) {
    const name = (HTMLAttributes['data-file-name'] as string) || 'Attachment'
    const size = (HTMLAttributes['data-file-size'] as string) || ''
    return [
      'a',
      mergeAttributes(HTMLAttributes, {
        'data-note-file': 'true',
        class: 'note-file-chip',
        target: '_blank',
        rel: 'noopener noreferrer',
      }),
      size ? `${name} · ${size}` : name,
    ]
  },

  addCommands() {
    return {
      insertFileAttachment:
        (attributes) =>
        ({ commands }) =>
          commands.insertContent({
            type: this.name,
            attrs: {
              href: attributes.href,
              'data-file-name': attributes.name,
              'data-file-size': formatSize(attributes.size),
            },
          }),
    }
  },
})
