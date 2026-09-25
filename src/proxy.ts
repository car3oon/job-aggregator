import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function proxy(request: NextRequest) {
  const authCookie = request.cookies.get('job_auth')
  const isLoginPage = request.nextUrl.pathname.startsWith('/login')

  // Protection: No cookie = redirect to login
  if (!authCookie && !isLoginPage) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // User is authenticated, no need to visit the login page
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
