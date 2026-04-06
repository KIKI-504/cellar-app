import { NextResponse } from 'next/server'

const PINS = {
  admin: process.env.PIN_ADMIN,
  buyer: process.env.PIN_BUYER,
  local: process.env.PIN_LOCAL,
}

export async function POST(request) {
  const { pin } = await request.json()

  let role = null
  for (const [r, p] of Object.entries(PINS)) {
    if (p && pin === p) { role = r; break }
  }

  if (!role) {
    return NextResponse.json({ error: 'Invalid PIN' }, { status: 401 })
  }

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

export async function DELETE() {
  const response = NextResponse.json({ ok: true })
  response.cookies.delete('cellar_role')
  return response
}
