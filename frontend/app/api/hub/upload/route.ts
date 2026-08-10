import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

const MAX_SIZE = 8 * 1024 * 1024
const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])

/**
 * POST /api/hub/upload
 *
 * Uploads a single image to the public `hub-attachments` bucket and returns
 * its public URL. Separate from /api/hub/send: sending a message and
 * uploading its attachment are two different failure modes (a slow upload
 * should not block the text draft, and a failed upload should not silently
 * post an empty message).
 */
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const formData = await req.formData().catch(() => null)
  const file = formData?.get('file')
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'No file provided.' }, { status: 400 })
  }
  if (!ALLOWED_TYPES.has(file.type)) {
    return NextResponse.json({ error: 'Upload a JPEG, PNG, WebP, or GIF image.' }, { status: 422 })
  }
  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: 'Image must be under 8MB.' }, { status: 422 })
  }

  const extension = file.type === 'image/png' ? 'png'
    : file.type === 'image/webp' ? 'webp'
    : file.type === 'image/gif' ? 'gif'
    : 'jpg'
  const path = `${user.id}/${crypto.randomUUID()}.${extension}`

  const { error } = await supabase.storage.from('hub-attachments').upload(path, file, {
    contentType: file.type,
    upsert: false,
  })

  if (error) {
    console.error('[Hub] Image upload failed:', error)
    return NextResponse.json({ error: 'Image upload failed.' }, { status: 500 })
  }

  const { data: publicUrlData } = supabase.storage.from('hub-attachments').getPublicUrl(path)

  return NextResponse.json({ url: publicUrlData.publicUrl }, { status: 201 })
}
