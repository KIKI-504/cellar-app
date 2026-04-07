import { NextResponse } from 'next/server'

export function middleware(request) {
  const { pathname } = request.nextUrl
  const role = request.cookies.get('cellar_role')?.value

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
    '/admin/:path*',
    '/studio/:path*',
    '/boxes/:path*',
    '/labels/:path*',
    '/local/:path*',
    '/buyer/:path*',
  ],
}
