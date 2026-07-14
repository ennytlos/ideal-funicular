// src/proxy.ts
// Protects /admin and /dashboard routes using a Firebase ID token stored in a cookie.
// The cookie is set by the client after sign-in (see AppContext loginWithGoogle/login).

import { NextRequest, NextResponse } from 'next/server';

const PROTECTED_ROUTES = ['/admin', '/dashboard'];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 1. First, handle route protection for admin and dashboard
  const isProtected = PROTECTED_ROUTES.some((route) => pathname.startsWith(route));
  let response: NextResponse;

  if (isProtected) {
    // We store the Firebase ID token in a httpOnly cookie named "noor_token"
    // (set by the /api/auth/session route after sign-in)
    const token = request.cookies.get('noor_token')?.value;

    if (!token) {
      const loginUrl = new URL('/', request.url);
      loginUrl.searchParams.set('auth', '1'); // signal the homepage to open auth modal
      response = NextResponse.redirect(loginUrl);
    } else {
      response = NextResponse.next();
    }
  } else {
    response = NextResponse.next();
  }

  // 2. Add CORS headers to all responses for API routes
  if (pathname.startsWith('/api/')) {
    response.headers.set('Access-Control-Allow-Origin', '*');
    response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
    response.headers.set('Access-Control-Max-Age', '3600');
  }

  // 3. Set security headers globally
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'SAMEORIGIN');
  response.headers.set('X-XSS-Protection', '1; mode=block');
  response.headers.set('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');

  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|manifest.json|sw.js).*)',
  ],
};
