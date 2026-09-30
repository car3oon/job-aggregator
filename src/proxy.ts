import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function proxy(request: NextRequest) {
  const authCookie = request.cookies.get('job_auth')
  const { pathname } = request.nextUrl
  
  const isLoginPage = pathname.startsWith('/login')
  const isHomePage = pathname === '/'

  // Protection: No cookie = redirect to login, EXCEPT for login page and home page
  if (!authCookie && !isLoginPage && !isHomePage) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // User is authenticated, redirect away from login page to dashboard
  if (authCookie && isLoginPage) {
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
