import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { SESSION_COOKIE_NAME, verifySessionToken } from '@/lib/session'

export function proxy(request: NextRequest) {
  const authCookie = request.cookies.get(SESSION_COOKIE_NAME)
  const { pathname } = request.nextUrl
  
  const isLoginPage = pathname.startsWith('/login')
  const isHomePage = pathname === '/'

  const isAuthenticated = verifySessionToken(authCookie?.value);

  if (!isAuthenticated && !isLoginPage && !isHomePage) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // User is authenticated, redirect away from login page to dashboard
  if (isAuthenticated && isLoginPage) {
    return NextResponse.redirect(new URL('/', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    /*
     * Ignore Next.js static files, API routes, and image optimization files.
     * We only want to protect actual application views and routes.
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
}
