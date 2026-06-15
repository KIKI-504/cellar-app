export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'

const STATIC_PINS = {
  admin: process.env.PIN_ADMIN,
  local:  process.env.PIN_LOCAL,
}

// Supabase connection — hardcoded since NEXT_PUBLIC_ vars are
// not reliably available in Next.js App Router API routes at runtime
const SUPABASE_URL = 'https://unteoesmedxvwrmnhlkz.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVudGVvZXNtZWR4dndybW5obGt6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM2MjAwNjksImV4cCI6MjA4OTE5NjA2OX0.RSV9s8-5IM0kUcdAESH15ABWu_h-_Up6Dg6j4qzcB-o'

function makeCookieResponse(role) {
  const response = NextResponse.json({ role })
  response.cookies.set('cellar_role', role, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7,
    path: '/',
  })
  return response
}

export async function POST(request) {
  const { pin } = await request.json()
  if (!pin) return NextResponse.json({ error: 'No PIN' }, { status: 400 })

  // 1. Static admin / local PINs
  for (const [role, p] of Object.entries(STATIC_PINS)) {
    if (p && pin === p) return makeCookieResponse(role)
  }

  // 2. Legacy single buyer PIN (PIN_BUYER env var)
  if (process.env.PIN_BUYER && pin === process.env.PIN_BUYER) {
    return makeCookieResponse('buyer')
  }

  // 3. Per-buyer PINs from buyer_access table
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/buyer_access?pin=eq.${encodeURIComponent(pin)}&select=id&limit=1`,
      {
        headers: {
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          'Accept': 'application/json',
        },
      }
    )
    if (res.ok) {
      const rows = await res.json()
      if (rows.length > 0) return makeCookieResponse('buyer')
    }
  } catch (err) {
    console.error('buyer_access lookup failed:', err)
  }

  return NextResponse.json({ error: 'Invalid PIN' }, { status: 401 })
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true })
  response.cookies.delete('cellar_role')
  return response
}
