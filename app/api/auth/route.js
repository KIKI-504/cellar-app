export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const STATIC_PINS = {
  admin: process.env.PIN_ADMIN,
  local:  process.env.PIN_LOCAL,
}

export async function POST(request) {
  const { pin } = await request.json()
  if (!pin) return NextResponse.json({ error: 'No PIN' }, { status: 400 })

  // 1. Static admin / local PINs
  for (const [role, p] of Object.entries(STATIC_PINS)) {
    if (p && pin === p) {
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
  }

  // 2. Legacy single buyer PIN (PIN_BUYER env var)
  if (process.env.PIN_BUYER && pin === process.env.PIN_BUYER) {
    const response = NextResponse.json({ role: 'buyer' })
    response.cookies.set('cellar_role', 'buyer', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7,
      path: '/',
    })
    return response
  }

  // 3. Per-buyer PINs from buyer_access table
  // Client created inside handler so env vars are available at runtime
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )

  const { data: buyer } = await supabase
    .from('buyer_access')
    .select('id')
    .eq('pin', pin)
    .maybeSingle()

  if (buyer) {
    const response = NextResponse.json({ role: 'buyer' })
    response.cookies.set('cellar_role', 'buyer', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7,
      path: '/',
    })
    return response
  }

  return NextResponse.json({ error: 'Invalid PIN' }, { status: 401 })
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true })
  response.cookies.delete('cellar_role')
  return response
}
