import { NextResponse } from 'next/server'
import sanitizeHtml from 'sanitize-html'

export async function GET() {
  try {
    const clean = sanitizeHtml('<b>Hello</b> <script>alert(1)</script>')
    return NextResponse.json({ success: true, clean })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
