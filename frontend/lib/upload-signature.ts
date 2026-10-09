/**
 * Does a file's content match the type it was uploaded as?
 *
 * The upload routes trusted `file.type`, which the browser (or any script)
 * sets freely: an HTML page sent as image/png was stored and served from the
 * public bucket as a PNG, and an SVG carrying a <script> was accepted as an
 * image. These checks read the leading bytes.
 */
const startsWith = (bytes: Uint8Array, signature: number[], offset = 0) =>
  signature.every((byte, i) => bytes[offset + i] === byte)

const ZIP = [0x50, 0x4b, 0x03, 0x04]
const OLE = [0xd0, 0xcf, 0x11, 0xe0] // legacy .doc / .xls / .ppt

const SIGNATURES: Record<string, (bytes: Uint8Array) => boolean> = {
  'image/png': (b) => startsWith(b, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  'image/jpeg': (b) => startsWith(b, [0xff, 0xd8, 0xff]),
  'image/gif': (b) => startsWith(b, [0x47, 0x49, 0x46, 0x38]),
  'image/webp': (b) => startsWith(b, [0x52, 0x49, 0x46, 0x46]) && startsWith(b, [0x57, 0x45, 0x42, 0x50], 8),
  'application/pdf': (b) => startsWith(b, [0x25, 0x50, 0x44, 0x46]),
  'application/zip': (b) => startsWith(b, ZIP),
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': (b) => startsWith(b, ZIP),
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': (b) => startsWith(b, ZIP),
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': (b) => startsWith(b, ZIP),
  'application/msword': (b) => startsWith(b, OLE),
  'application/vnd.ms-excel': (b) => startsWith(b, OLE),
  'application/vnd.ms-powerpoint': (b) => startsWith(b, OLE),
}

/** Markup that makes an SVG executable when opened directly. */
const ACTIVE_SVG = /<script[\s>]|\son[a-z]+\s*=|javascript:|<foreignObject[\s>]|<iframe[\s>]/i

export async function contentMatchesType(file: File): Promise<boolean> {
  const type = file.type
  if (type === 'image/svg+xml') {
    const text = await file.text()
    return /<svg[\s>]/i.test(text) && !ACTIVE_SVG.test(text)
  }
  const check = SIGNATURES[type]
  // Plain text formats (txt, csv, md) have no signature to check.
  if (!check) return true
  const head = new Uint8Array(await file.slice(0, 16).arrayBuffer())
  return check(head)
}
