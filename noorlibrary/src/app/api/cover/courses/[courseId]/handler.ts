// src/app/api/cover/courses/[courseId]/route.ts
// Proxy endpoint for course cover images.
// Fetches the cover URL from Firestore, signs it if on Bunny CDN, and streams it back.

import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '../../../../../lib/firebase-admin';
import { getSignedUrl } from '../../../../../lib/bunny';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ courseId: string }> }
) {
  const { courseId } = await params;

  try {
    const courseDoc = await adminDb.collection('courses').doc(courseId).get();
    if (!courseDoc.exists) {
      return NextResponse.redirect(new URL('/noor_logo.png', request.url));
    }

    const data = courseDoc.data()!;
    const coverUrl = data.coverUrl as string;

    if (!coverUrl) {
      return NextResponse.redirect(new URL('/noor_logo.png', request.url));
    }

    // Check if it's a Bunny CDN URL — needs token signing
    if (coverUrl.includes('b-cdn.net') || coverUrl.includes('bunnycdn.com') || !coverUrl.startsWith('http')) {
      let path = coverUrl;
      if (coverUrl.startsWith('http')) {
        const urlObj = new URL(coverUrl);
        path = urlObj.pathname.substring(1); // remove leading slash
      }

      const signedUrl = await getSignedUrl(path, 3600);
      const res = await fetch(signedUrl);

      if (!res.ok) {
        return NextResponse.redirect(new URL('/noor_logo.png', request.url));
      }

      const headers = new Headers();
      headers.set('Content-Type', res.headers.get('Content-Type') || 'image/jpeg');
      headers.set('Cache-Control', 'public, max-age=86400'); // Cache for 24h
      return new NextResponse(res.body, { headers });
    }

    // Standard external URL — redirect directly
    return NextResponse.redirect(new URL(coverUrl, request.url));
  } catch {
    return NextResponse.redirect(new URL('/noor_logo.png', request.url));
  }
}
