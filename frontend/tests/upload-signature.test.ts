import { describe, it, expect } from 'vitest'
import { contentMatchesType } from '@/lib/upload-signature'

const file = (bytes: number[] | string, type: string) =>
  new File([typeof bytes === 'string' ? bytes : new Uint8Array(bytes)], 'f', { type })

const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]

describe('contentMatchesType', () => {
  it('accepts a real PNG, JPEG, GIF, WebP and PDF', async () => {
    expect(await contentMatchesType(file(PNG, 'image/png'))).toBe(true)
    expect(await contentMatchesType(file([0xff, 0xd8, 0xff, 0xe0], 'image/jpeg'))).toBe(true)
    expect(await contentMatchesType(file([0x47, 0x49, 0x46, 0x38, 0x39, 0x61], 'image/gif'))).toBe(true)
    expect(await contentMatchesType(file([0x52, 0x49, 0x46, 0x46, 1, 2, 3, 4, 0x57, 0x45, 0x42, 0x50], 'image/webp'))).toBe(true)
    expect(await contentMatchesType(file('%PDF-1.7 ...', 'application/pdf'))).toBe(true)
  })

  it('rejects an HTML page uploaded as a PNG (accepted on production before this check)', async () => {
    expect(await contentMatchesType(file('<html><script>alert(1)</script></html>', 'image/png'))).toBe(false)
  })

  it('rejects one image type presented as another', async () => {
    expect(await contentMatchesType(file(PNG, 'image/jpeg'))).toBe(false)
  })

  it('accepts a plain SVG and rejects an executable one', async () => {
    expect(await contentMatchesType(file('<svg xmlns="http://www.w3.org/2000/svg"><circle r="4"/></svg>', 'image/svg+xml'))).toBe(true)
    expect(await contentMatchesType(file('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>', 'image/svg+xml'))).toBe(false)
    expect(await contentMatchesType(file('<svg onload="alert(1)"></svg>', 'image/svg+xml'))).toBe(false)
    expect(await contentMatchesType(file('<html></html>', 'image/svg+xml'))).toBe(false)
  })

  it('accepts office documents by container signature and passes plain text through', async () => {
    expect(await contentMatchesType(file([0x50, 0x4b, 0x03, 0x04, 0, 0], 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'))).toBe(true)
    expect(await contentMatchesType(file('not a zip', 'application/zip'))).toBe(false)
    expect(await contentMatchesType(file('a,b\n1,2', 'text/csv'))).toBe(true)
  })
})
