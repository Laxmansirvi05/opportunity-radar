import StarterKit from '@tiptap/starter-kit'
import { TextStyleKit } from '@tiptap/extension-text-style'
import { TableKit } from '@tiptap/extension-table'
import { TaskList } from '@tiptap/extension-task-list'
import { TaskItem } from '@tiptap/extension-task-item'
import Placeholder from '@tiptap/extension-placeholder'
import Highlight from '@tiptap/extension-highlight'
import TextAlign from '@tiptap/extension-text-align'
import { ResizableImage } from './resizable-image'
import { FileAttachment } from './file-attachment'

/**
 * The one extension set, shared by the full note editor, the robot's Quick
 * Note composer, and the read-only renderer.
 *
 * Sharing it is what guarantees a document written in one surface renders
 * identically in the others — an extension present in the editor but missing
 * from the renderer doesn't error, it silently drops that formatting.
 *
 * Nothing here is a new dependency: StarterKit v3 already bundles bold,
 * italic, underline, strike, code, code blocks, blockquote, headings, lists,
 * horizontal rules, links and undo/redo, and TextStyleKit covers colour, font
 * size and line height. Verified against the installed packages' own type
 * definitions rather than assumed.
 */
export function buildNoteExtensions(placeholder?: string) {
  return [
    StarterKit.configure({
      heading: { levels: [1, 2, 3] },
      link: {
        openOnClick: false,
        autolink: true,
        // Matches sanitizeNoteContent's allowedSchemesByTag for anchors: a
        // scheme the sanitiser would strip on save should never be creatable
        // in the editor, or the link silently disappears on reload.
        protocols: ['http', 'https', 'mailto', 'tel'],
        HTMLAttributes: { rel: 'noopener noreferrer nofollow', target: '_blank' },
      },
      codeBlock: { HTMLAttributes: { class: 'note-code-block' } },
    }),
    TextStyleKit.configure({
      // fontFamily and backgroundColor are deliberately off: the note should
      // stay in Opportunity Radar's own typography, and highlighting already
      // has a dedicated control that the sanitiser understands.
      fontFamily: false,
      backgroundColor: false,
    }),
    TableKit.configure({
      table: { resizable: true, HTMLAttributes: { class: 'note-table' } },
    }),
    TaskList,
    // nested: true so a checklist can express sub-tasks, matching the
    // indent/outdent controls the toolbar exposes for ordinary lists.
    TaskItem.configure({ nested: true }),
    Highlight.configure({ multicolor: true }),
    TextAlign.configure({ types: ['heading', 'paragraph'] }),
    ResizableImage.configure({ inline: false, allowBase64: true }),
    FileAttachment,
    Placeholder.configure({ placeholder: placeholder ?? 'Start writing…' }),
  ]
}
