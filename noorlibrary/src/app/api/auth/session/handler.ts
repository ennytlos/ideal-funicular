// src/app/api/auth/session/route.ts
// Called by the client after Firebase sign-in to set a httpOnly session cookie.

import { NextRequest, NextResponse } from 'next/server';
import { adminAuth } from '../../../../lib/firebase-admin';

export async function POST(request: NextRequest) {
  try {
    const { idToken } = await request.json();

    if (!idToken) {
      return NextResponse.json({ error: 'Missing idToken' }, { status: 400 });
    }

    // Verify the token is genuine
    await adminAuth.verifyIdToken(idToken);

    const response = NextResponse.json({ status: 'ok' });

    // Set httpOnly cookie valid for 7 days
    response.cookies.set('noor_token', idToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7,
      path: '/',
    });

    return response;
  } catch {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
  }
}

export async function DELETE() {
  const response = NextResponse.json({ status: 'ok' });
  response.cookies.delete('noor_token');
  return response;
}
