// src/app/api/cover/courses/[courseId]/route.ts
// Proxy endpoint for course cover images.
// Fetches the cover URL from Firestore, signs it if on Bunny CDN, and streams it back.

import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '../../../../../lib/firebase-admin';

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

    let destination = coverUrl;
    if (!coverUrl.startsWith('http')) {
      const cdnHost = process.env.BUNNY_CDN_HOSTNAME || 'noorlibrary.b-cdn.net';
      destination = `https://${cdnHost}/${coverUrl.startsWith('/') ? coverUrl.substring(1) : coverUrl}`;
    }

    // Redirect directly to the public URL (bypassing Vercel streaming/bandwidth)
    return NextResponse.redirect(new URL(destination, request.url));
  } catch {
    return NextResponse.redirect(new URL('/noor_logo.png', request.url));
  }
}
