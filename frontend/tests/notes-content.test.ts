import { describe, it, expect } from 'vitest'
import { sanitizeNoteContent } from '@/features/notes/lib/sanitize-note-content'
import { checklistProgress, firstImageUrl, hasAttachmentMarkup, stripHtml, toSnippet } from '@/features/notes/lib/note-preview'
import { FOLDER_COLORS, isFolderColor } from '@/features/notes/types'
import { FOLDER_PALETTES, paletteFor } from '@/features/notes/lib/folder-colors'
import { NOTE_TEMPLATES } from '@/features/notes/lib/note-templates'

describe('sanitizeNoteContent — the stored-XSS boundary', () => {
  it('strips script tags entirely', () => {
    const out = sanitizeNoteContent('<p>hi</p><script>alert(1)</script>')
    expect(out).not.toMatch(/script/i)
    expect(out).toContain('hi')
  })

  it('drops javascript: hrefs while keeping the link text', () => {
    const out = sanitizeNoteContent('<a href="javascript:alert(1)">click</a>')
    expect(out).not.toMatch(/javascript:/i)
    expect(out).toContain('click')
  })

  it('removes inline event handlers', () => {
    const out = sanitizeNoteContent('<p onclick="steal()">text</p>')
    expect(out).not.toMatch(/onclick/i)
  })

  it('refuses a style property that is not on the allowlist', () => {
    const out = sanitizeNoteContent('<p style="position:fixed;top:0;background-image:url(javascript:x)">x</p>')
    expect(out).not.toMatch(/position/i)
    expect(out).not.toMatch(/background-image/i)
  })

  it('keeps the styles the toolbar actually produces', () => {
    const out = sanitizeNoteContent('<p style="text-align:center"><span style="color:#2563eb">blue</span></p>')
    expect(out).toContain('text-align:center')
    expect(out).toContain('#2563eb')
  })

  it('forces rel/target onto external links but leaves internal ones alone', () => {
    const external = sanitizeNoteContent('<a href="https://example.com">x</a>')
    expect(external).toContain('rel="noopener noreferrer nofollow"')
    expect(external).toContain('target="_blank"')

    const internal = sanitizeNoteContent('<a href="/notes/abc">x</a>')
    expect(internal).not.toContain('target="_blank"')
  })

  // Every one of these is formatting the editor can emit. A tag missing from
  // the allowlist is invisible at write time and only shows up as the user's
  // work disappearing on reload, so the round trip is pinned here.
  it('round-trips everything the editor can produce', () => {
    const cases: [string, RegExp][] = [
      ['<h1>Title</h1>', /<h1>/],
      ['<h3>Sub</h3>', /<h3>/],
      ['<u>under</u>', /<u>/],
      ['<s>struck</s>', /<s>/],
      ['<code>x</code>', /<code>/],
      ['<pre><code>block</code></pre>', /<pre>/],
      ['<blockquote><p>q</p></blockquote>', /<blockquote>/],
      ['<hr />', /<hr/],
      ['<mark>hl</mark>', /<mark>/],
      ['<table><tbody><tr><th>H</th><td>C</td></tr></tbody></table>', /<table>/],
      ['<img src="https://x.test/a.png" alt="a" width="300" data-align="center" />', /data-align="center"/],
      ['<a data-note-file="true" href="https://x.test/f.pdf" data-file-name="f.pdf">f.pdf</a>', /data-file-name/],
    ]
    for (const [input, expected] of cases) {
      expect(sanitizeNoteContent(input), input).toMatch(expected)
    }
  })

  it('preserves a checklist item\'s exact structure', () => {
    const checklist =
      '<ul data-type="taskList"><li data-type="taskItem" data-checked="true">' +
      '<label><input type="checkbox" checked><span></span></label><div><p>done</p></div></li></ul>'
    const out = sanitizeNoteContent(checklist)
    expect(out).toContain('data-type="taskList"')
    expect(out).toContain('data-checked="true"')
    expect(out).toContain('<input')
    expect(out).toContain('done')
  })
})

describe('note preview helpers', () => {
  it('treats a block boundary as a word boundary', () => {
    // Without this, "</p><p>" fuses the two words into "oneTwo".
    expect(stripHtml('<p>one</p><p>Two</p>')).toBe('one Two')
  })

  it('decodes the entities the editor emits', () => {
    expect(stripHtml('<p>a&nbsp;&amp;&nbsp;b</p>')).toBe('a & b')
  })

  it('truncates on a word boundary and marks the cut', () => {
    const snippet = toSnippet('<p>' + 'alpha beta gamma delta '.repeat(20) + '</p>', 40)
    expect(snippet.length).toBeLessThanOrEqual(41)
    expect(snippet.endsWith('…')).toBe(true)
    expect(snippet).not.toMatch(/\s…$/)
  })

  it('does not truncate content that already fits', () => {
    expect(toSnippet('<p>short</p>', 40)).toBe('short')
  })

  it('finds the first image for a card thumbnail', () => {
    expect(firstImageUrl('<p>x</p><img src="https://x.test/1.png"><img src="https://x.test/2.png">'))
      .toBe('https://x.test/1.png')
    expect(firstImageUrl('<p>no images</p>')).toBeNull()
  })

  it('counts checklist progress, and returns null when there is no checklist', () => {
    const html = '<li data-checked="true"></li><li data-checked="false"></li><li data-checked="true"></li>'
    expect(checklistProgress(html)).toEqual({ done: 2, total: 3 })
    expect(checklistProgress('<p>plain</p>')).toBeNull()
  })

  it('detects both images and file chips as attachments', () => {
    expect(hasAttachmentMarkup('<img src="x">')).toBe(true)
    expect(hasAttachmentMarkup('<a data-note-file="true" href="x">f</a>')).toBe(true)
    expect(hasAttachmentMarkup('<p>nothing</p>')).toBe(false)
  })
})

describe('folder colours', () => {
  it('has a palette for every colour the database will accept', () => {
    for (const color of FOLDER_COLORS) {
      expect(FOLDER_PALETTES[color], color).toBeDefined()
    }
  })

  it('falls back to a real palette rather than undefined for a bad value', () => {
    // A folder stored before a palette existed must still render.
    expect(paletteFor('chartreuse').back).toBeTruthy()
    expect(paletteFor(null).back).toBeTruthy()
  })

  it('validates colours the same way the API does', () => {
    expect(isFolderColor('purple')).toBe(true)
    expect(isFolderColor('chartreuse')).toBe(false)
    expect(isFolderColor(null)).toBe(false)
  })
})

describe('note templates', () => {
  it('survives sanitisation unchanged in substance', () => {
    // A template whose markup the sanitiser strips would silently create an
    // empty note — the template is only useful if it round-trips.
    for (const template of NOTE_TEMPLATES) {
      if (!template.content) continue
      const out = sanitizeNoteContent(template.content)
      expect(stripHtml(out).length, template.id).toBeGreaterThan(0)
    }
  })

  it('offers a blank option so templates are never forced', () => {
    const blank = NOTE_TEMPLATES.find((template) => template.id === 'blank')
    expect(blank).toBeDefined()
    expect(blank!.content).toBe('')
  })

  it('has unique ids', () => {
    const ids = NOTE_TEMPLATES.map((template) => template.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})
