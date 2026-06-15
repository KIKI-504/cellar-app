export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'

const STATIC_PINS = {
  admin: process.env.PIN_ADMIN,
  local:  process.env.PIN_LOCAL,
}

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
  // Use direct REST fetch rather than Supabase JS client to avoid
  // env var resolution issues in server-side routes
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (supabaseUrl && supabaseKey) {
    try {
      const res = await fetch(
        `${supabaseUrl}/rest/v1/buyer_access?pin=eq.${encodeURIComponent(pin)}&select=id&limit=1`,
        {
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
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
  }

  return NextResponse.json({ error: 'Invalid PIN' }, { status: 401 })
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true })
  response.cookies.delete('cellar_role')
  return response
}
