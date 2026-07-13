// src/proxy.ts
// Protects /admin and /dashboard routes using a Firebase ID token stored in a cookie.
// The cookie is set by the client after sign-in (see AppContext loginWithGoogle/login).

import { NextRequest, NextResponse } from 'next/server';

const PROTECTED_ROUTES = ['/admin', '/dashboard'];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isProtected = PROTECTED_ROUTES.some((route) => pathname.startsWith(route));
  if (!isProtected) return NextResponse.next();

  // We store the Firebase ID token in a httpOnly cookie named "noor_token"
  // (set by the /api/auth/session route after sign-in)
  const token = request.cookies.get('noor_token')?.value;

  if (!token) {
    const loginUrl = new URL('/', request.url);
    loginUrl.searchParams.set('auth', '1'); // signal the homepage to open auth modal
    return NextResponse.redirect(loginUrl);
  }

  // Token existence check only in proxy (edge runtime).
  // Full verification (role check for /admin) happens inside the page via server component
  // or via the /api/auth/me route.
  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*', '/dashboard/:path*'],
};
