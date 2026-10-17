import { NextResponse } from 'next/server'

const HOME_FOR_ROLE = {
  admin: '/studio',
  local: '/local',
  buyer: '/buyer',
}

export function middleware(request) {
  const { pathname } = request.nextUrl
  const role = request.cookies.get('cellar_role')?.value

  // Already signed in → skip the PIN screen and land on the role's home page.
  if (pathname === '/') {
    const home = role && HOME_FOR_ROLE[role]
    if (home) return NextResponse.redirect(new URL(home, request.url))
    return NextResponse.next()
  }

  const rules = [
    { prefix: '/admin', allowed: ['admin'] },
    { prefix: '/studio', allowed: ['admin'] },
    { prefix: '/boxes', allowed: ['admin'] },
    { prefix: '/labels', allowed: ['admin'] },
    { prefix: '/local', allowed: ['admin', 'local'] },
    { prefix: '/buyer', allowed: ['admin', 'buyer'] },
  ]

  for (const rule of rules) {
    if (pathname === rule.prefix || pathname.startsWith(rule.prefix + '/')) {
      if (!role || !rule.allowed.includes(role)) {
        return NextResponse.redirect(new URL('/', request.url))
      }
      return NextResponse.next()
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/',
    '/admin/:path*',
    '/studio/:path*',
    '/boxes/:path*',
    '/labels/:path*',
    '/local/:path*',
    '/buyer/:path*',
  ],
}
